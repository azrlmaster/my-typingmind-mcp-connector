// start-mcp.js (Revised for OAuth GSC integration)
const fs = require('node:fs');
const path = require('node:path');
const os =require('node:os');
const { spawn } = require('node:child_process');

// --- Try to import and initialize gscService ---
// This service uses GSC_OAUTH_* environment variables
let gscService;
try {
    gscService = require('./gscService'); // Assumes gscService.js is in the same directory
    if (gscService && gscService.isAuthInitialized) {
        console.log('[MCP-WRAPPER-GSC_OAUTH] gscService.js loaded and OAuth client initialized successfully.');
    } else if (gscService) {
        console.warn('[MCP-WRAPPER-GSC_OAUTH] gscService.js loaded, but OAuth client NOT initialized. Check GSC_OAUTH_* env vars.');
    } else {
        console.warn('[MCP-WRAPPER-GSC_OAUTH] Failed to load gscService.js. OAuth GSC features will be unavailable.');
    }
} catch (error) {
    console.error('[MCP-WRAPPER-GSC_OAUTH] CRITICAL: Error requiring gscService.js:', error);
    gscService = { isAuthInitialized: false }; // Ensure gscService object exists to prevent further errors
}

function prepareEnvironmentAndLaunch() {
    console.log('[MCP-WRAPPER] Starting environment preparation...');

    // --- 1. GSC Credentials ---
    // Prioritize new OAuth method. If GSC_OAUTH_REFRESH_TOKEN is set, gscService will use it.
    // We then AVOID setting GOOGLE_APPLICATION_CREDENTIALS for the child process to prevent conflict
    // or unintended Service Account usage by @typingmind/mcp for GSC.
    if (process.env.GSC_OAUTH_REFRESH_TOKEN) {
        console.log('[MCP-WRAPPER-GSC] GSC_OAUTH_REFRESH_TOKEN is set. gscService will handle GSC via OAuth.');
        console.log('[MCP-WRAPPER-GSC] GOOGLE_APPLICATION_CREDENTIALS will NOT be set from GOOGLE_APPLICATION_CREDENTIALS_STRING to prioritize OAuth.');
        // Ensure GOOGLE_APPLICATION_CREDENTIALS is not set if we are using OAuth primarily for GSC
        // to avoid @typingmind/mcp using it for GSC.
        // However, if @typingmind/mcp uses GOOGLE_APPLICATION_CREDENTIALS for *other* Google services (not GSC),
        // this might need adjustment. For now, assuming GSC is the primary concern for this env var.
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS; // Unset it if it was somehow already set
    } else {
            console.warn('[MCP-WRAPPER-GSC-SA] WARNING: GOOGLE_APPLICATION_CREDENTIALS Heroku env var not set or empty. If @typingmind/mcp needs GSC via SA, it will likely fail.');
        }
    }

    // --- 2. Google Analytics Private Key (Base64 method) ---
    // (This section remains unchanged, assuming GA uses its own service account or key distinct from GSC's new OAuth)
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        try {
            process.env.GOOGLE_PRIVATE_KEY = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
            console.log('[MCP-WRAPPER-GA] GOOGLE_PRIVATE_KEY decoded from Base64 and set for GA.');
        } catch (error) {
            console.error('[MCP-WRAPPER-GA] CRITICAL: Failed to decode GOOGLE_PRIVATE_KEY_BASE64:', error);
        }
    }

    // --- Other Credentials (DataForSEO, Firecrawl) ---
    // (These sections remain unchanged)

    // --- Log final state of key env vars before spawning @typingmind/mcp ---
    console.log('[MCP-WRAPPER_PRE_SPAWN_ENV] Verifying key environment variables:');
    // GSC OAuth Vars
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_CLIENT_ID: ${(process.env.GSC_OAUTH_CLIENT_ID ? 'SET' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_CLIENT_SECRET: ${(process.env.GSC_OAUTH_CLIENT_SECRET ? 'SET (value hidden)' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_REFRESH_TOKEN: ${(process.env.GSC_OAUTH_REFRESH_TOKEN ? 'SET (value hidden)' : 'NOT SET')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GSC_OAUTH_REDIRECT_URI: ${process.env.GSC_OAUTH_REDIRECT_URI || 'NOT SET'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   gscService Initialized (OAuth): ${gscService && gscService.isAuthInitialized}`);
    // GSC Service Account (Fallback or for other Google Services used by @typingmind/mcp)
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_APPLICATION_CREDENTIALS (for child process): ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET / Unset due to OAuth priority'}`);
    // GA Vars
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_PRIVATE_KEY (for GA): ${(process.env.GOOGLE_PRIVATE_KEY ? 'SET (content hidden)' : 'NOT SET')}`);
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
        env: { ...process.env } // Pass a copy of the current, modified environment
    });

    mcpProcess.on('close', (code) => {
        console.log(`[MCP-WRAPPER] @typingmind/mcp process exited with code ${code}. Wrapper script also exiting.`);
        process.exit(code); // Exit with the child's code
    });

    mcpProcess.on('error', (err) => {
        console.error('[MCP-WRAPPER] Failed to start @typingmind/mcp process:', err);
        process.exit(1); // Exit with an error code
    });
}

// Run the preparation and launch
prepareEnvironmentAndLaunch();
