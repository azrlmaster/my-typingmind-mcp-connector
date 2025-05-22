// start-mcp.js (Revised for "GSC OAuth or Nothing" strategy)
const fs = require('node:fs');        // Still needed for GA service account if used for GA
const path = require('node:path');    // Still needed for GA service account if used for GA
const os = require('node:os');        // Still needed for GA service account if used for GA
const { spawn } = require('node:child_process');

// --- GSC OAuth Initialization Attempt ---
// This section attempts to load and use your gscService.js for GSC OAuth.
// It assumes mcp-server-gsc will then pick up authentication via this service
// or by reading GSC_OAUTH_* environment variables itself.

let gscService; // Will hold the loaded gscService module
let gscServiceAuthInitialized = false; // Flag to track if your gscService.js successfully inits OAuth

if (process.env.GSC_OAUTH_REFRESH_TOKEN) {
    console.log('[MCP-WRAPPER-GSC_OAUTH] GSC_OAUTH_REFRESH_TOKEN is set. Attempting to use OAuth for GSC via gscService.js.');
    try {
        gscService = require('./gscService.js'); // Ensure gscService.js is in the same directory or correct path

        // Check if gscService.js exposed an initialization status method or property
        if (gscService && typeof gscService.isAuthInitialized === 'function') {
            gscServiceAuthInitialized = gscService.isAuthInitialized(); // Call it if it's a function
        } else if (gscService && typeof gscService.isAuthInitialized === 'boolean') {
            gscServiceAuthInitialized = gscService.isAuthInitialized; // Use it if it's a boolean property
        }

        if (gscServiceAuthInitialized) {
            console.log('[MCP-WRAPPER-GSC_OAUTH] gscService.js reports OAuth client as INITIALIZED.');
        } else if (gscService) {
            console.warn('[MCP-WRAPPER-GSC_OAUTH] gscService.js loaded, but OAuth client reported as NOT INITIALIZED or status unknown. Check gscService.js logic and required GSC_OAUTH_* env vars.');
        } else { // Should not be reached if require didn't throw but good for robustness
             console.warn('[MCP-WRAPPER-GSC_OAUTH] require("./gscService.js") did not return a module. OAuth for GSC will not work.');
        }
    } catch (error) {
        console.error('[MCP-WRAPPER-GSC_OAUTH] CRITICAL: Error requiring or processing gscService.js. GSC OAuth will not work. Error:', error.message);
        // If 'googleapis' is missing, the error.code will be 'MODULE_NOT_FOUND'
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error("[MCP-WRAPPER-GSC_OAUTH] The 'googleapis' module (or another dependency of gscService.js) is likely missing. Please install it (`npm install googleapis`).");
        }
        // gscServiceAuthInitialized remains false
    }
} else {
    console.log('[MCP-WRAPPER-GSC] GSC_OAUTH_REFRESH_TOKEN is NOT set. GSC will not be configured for OAuth by the wrapper.');
    // In "OAuth or nothing", we don't set up Service Account for GSC here.
}

function prepareEnvironmentAndLaunch() {
    console.log('[MCP-WRAPPER] Starting environment preparation phase...');

    // --- 1. GSC Authentication Strategy ---
    // For "GSC OAuth or nothing":
    // If GSC_OAUTH_REFRESH_TOKEN was set and gscService initialized, GSC should use OAuth.
    // If not, GSC will not have explicit auth configured by this wrapper.
    // We ensure GOOGLE_APPLICATION_CREDENTIALS is not set for GSC to avoid confusion.
    console.log('[MCP-WRAPPER-GSC] Ensuring GOOGLE_APPLICATION_CREDENTIALS is not set for GSC due to "OAuth or Nothing" strategy.');
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // --- 2. Google Analytics Service Account Credentials (Assumed to be separate from GSC) ---
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) { // Expects GOOGLE_PRIVATE_KEY_BASE64 in Heroku for GA
        try {
            process.env.GOOGLE_PRIVATE_KEY = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
            console.log('[MCP-WRAPPER-GA] GOOGLE_PRIVATE_KEY (for GA) decoded from Base64 and set.');
        } catch (error) {
            console.error('[MCP-WRAPPER-GA] CRITICAL: Failed to decode GOOGLE_PRIVATE_KEY_BASE64 for GA:', error);
        }
    }
    // Other GA vars like GOOGLE_CLIENT_EMAIL and GA_PROPERTY_ID are assumed to be directly in Heroku env.

    // Other essential environment variables (DATAFORSEO_USERNAME, DATAFORSEO_PASSWORD, FIRECRAWL_API_KEY)
    // are assumed to be set in Heroku with these exact names and will be passed through via process.env.

    // --- Log final state of key env vars before spawning @typingmind/mcp ---
    console.log('[MCP-WRAPPER_PRE_SPAWN_ENV] Verifying key environment variables before spawning @typingmind/mcp:');
    // GSC OAuth Vars (read directly from Heroku's process.env by child processes if mcp-server-gsc uses them)
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_CLIENT_ID: ${(process.env.GSC_OAUTH_CLIENT_ID ? 'SET' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_CLIENT_SECRET: ${(process.env.GSC_OAUTH_CLIENT_SECRET ? 'SET (value hidden)' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_REFRESH_TOKEN: ${(process.env.GSC_OAUTH_REFRESH_TOKEN ? 'SET (value hidden)' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_REDIRECT_URI: ${process.env.GSC_OAUTH_REDIRECT_URI || 'NOT SET'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   gscServiceAuthInitialized (by wrapper): ${gscServiceAuthInitialized}`);
    // GSC Service Account (explicitly NOT set by this script for GSC)
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_APPLICATION_CREDENTIALS (for GSC): ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET (as intended for GSC OAuth or no GSC auth)'}`);
    // GA Vars
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_PRIVATE_KEY (for GA): ${(process.env.GOOGLE_PRIVATE_KEY ? 'SET (content hidden)' : 'NOT SET or decode failed')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_CLIENT_EMAIL (for GA): ${process.env.GOOGLE_CLIENT_EMAIL || 'NOT SET'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GA_PROPERTY_ID: ${process.env.GA_PROPERTY_ID || 'NOT SET'}`);
    // Other Services
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   DATAFORSEO_USERNAME: ${process.env.DATAFORSEO_USERNAME || 'NOT SET'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   DATAFORSEO_PASSWORD: ${(process.env.DATAFORSEO_PASSWORD ? 'SET (value hidden)' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   FIRECRAWL_API_KEY: ${(process.env.FIRECRAWL_API_KEY ? 'SET (value hidden)' : 'NOT SET')}`);

    // --- Launch @typingmind/mcp ---
    const command = 'npx';
    const args = ['-y', '@typingmind/mcp']; // Add any other args @typingmind/mcp needs

    console.log(`[MCP-WRAPPER] Launching @typingmind/mcp with command: ${command} ${args.join(' ')}`);

    const mcpProcess = spawn(command, args, {
        stdio: 'inherit',
        env: { ...process.env } // Pass a shallow copy of the current, modified environment
    });

    mcpProcess.on('close', (code) => {
        console.log(`[MCP-WRAPPER] @typingmind/mcp process exited with code ${code}. Wrapper script also exiting.`);
        process.exit(code);
    });
    mcpProcess.on('error', (err) => {
        console.error('[MCP-WRAPPER] Failed to start @typingmind/mcp process:', err);
        process.exit(1);
    });
}

// Run the preparation and launch
prepareEnvironmentAndLaunch();
