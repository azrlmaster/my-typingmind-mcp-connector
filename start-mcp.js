// start-mcp.js (Revised for clarity and direct passthrough)
const fs = require('node:fs');
const path = require('node:path');
const os =require('node:os');
const { spawn } = require('node:child_process');

function prepareEnvironmentAndLaunch() {
    console.log('[MCP-WRAPPER] Starting environment preparation...');

    // --- 1. GSC Credentials ---
    // Reads GSC_CREDENTIALS_JSON_STRING from Heroku, writes to /tmp, then sets GOOGLE_APPLICATION_CREDENTIALS.
    const gscCredentialsJsonString = process.env.GSC_CREDENTIALS_JSON_STRING;
    if (gscCredentialsJsonString && gscCredentialsJsonString.trim() !== "") {
        const tempGscPath = path.join(os.tmpdir(), 'gsc-sa-key.json');
        try {
            fs.writeFileSync(tempGscPath, gscCredentialsJsonString, { encoding: 'utf8', mode: 0o600 });
            process.env.GOOGLE_APPLICATION_CREDENTIALS = tempGscPath; // Set for @typingmind/mcp and its children
            console.log(`[MCP-WRAPPER-GSC] GOOGLE_APPLICATION_CREDENTIALS prepared and set to: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        } catch (error) {
            console.error('[MCP-WRAPPER-GSC] CRITICAL: Failed to write GSC credentials file:', error);
        }
    } else {
        console.warn('[MCP-WRAPPER-GSC] WARNING: GSC_CREDENTIALS_JSON_STRING Heroku env var not set or empty. GSC server will likely fail.');
    }

    // --- 2. Google Analytics Private Key (Base64 method) ---
    // Reads GOOGLE_PRIVATE_KEY_BASE64 from Heroku, decodes it, then sets GOOGLE_PRIVATE_KEY.
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
        try {
            process.env.GOOGLE_PRIVATE_KEY = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8'); // Set for @typingmind/mcp and its children
            console.log('[MCP-WRAPPER-GA] GOOGLE_PRIVATE_KEY decoded from Base64 and set.');
        } catch (error) {
            console.error('[MCP-WRAPPER-GA] CRITICAL: Failed to decode GOOGLE_PRIVATE_KEY_BASE64:', error);
        }
    }
    // Note: GOOGLE_CLIENT_EMAIL and GA_PROPERTY_ID are assumed to be set directly in Heroku
    // and will be part of process.env passed to the child process.

    // --- For DATAFORSEO_USERNAME, DATAFORSEO_PASSWORD, FIRECRAWL_API_KEY ---
    // These are assumed to be ALREADY SET in Heroku with these EXACT names.
    // The `start-mcp.js` doesn't need to rename or copy them if the Heroku var names
    // already match what the child servers expect. They will be part of `process.env`
    // passed to the `spawn` call.

    // --- Log final state of key env vars before spawning @typingmind/mcp ---
    console.log('[MCP-WRAPPER_PRE_SPAWN_ENV] Verifying key environment variables:');
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET in wrapper env'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_PRIVATE_KEY: ${(process.env.GOOGLE_PRIVATE_KEY ? 'SET (content hidden)' : 'NOT SET in wrapper env')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GOOGLE_CLIENT_EMAIL: ${(process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET in wrapper env')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   GA_PROPERTY_ID: ${(process.env.GA_PROPERTY_ID ? 'SET' : 'NOT SET in wrapper env')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   DATAFORSEO_USERNAME: ${process.env.DATAFORSEO_USERNAME || 'NOT SET in wrapper env'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   DATAFORSEO_PASSWORD: ${(process.env.DATAFORSEO_PASSWORD ? 'SET (value hidden)' : 'NOT SET in wrapper env')}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV]   FIRECRAWL_API_KEY: ${(process.env.FIRECRAWL_API_KEY ? 'SET (value hidden)' : 'NOT SET in wrapper env')}`);

    // --- Launch @typingmind/mcp ---
    const command = 'npx';
    // Ensure you include any arguments @typingmind/mcp needs.
    // For example, if it needs a config file: const args = ['-y', '@typingmind/mcp', '--config', './your-mcp-config.json'];
    const args = ['-y', '@typingmind/mcp'];

    console.log(`[MCP-WRAPPER] Launching @typingmind/mcp with command: ${command} ${args.join(' ')}`);

    const mcpProcess = spawn(command, args, {
        stdio: 'inherit', // Pipes child's stdio to this process's stdio for logging
        env: process.env  // Passes the entire current (modified) environment of start-mcp.js
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
