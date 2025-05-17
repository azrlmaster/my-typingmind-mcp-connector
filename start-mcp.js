// start-mcp.js
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function prepareEnvironmentAndLaunch() {
    console.log('[MCP-WRAPPER] Starting environment preparation...');

    // --- 1. GSC Credentials ---
    const gscCredentialsJsonString = process.env.GSC_CREDENTIALS_JSON_STRING; // From Heroku
    if (gscCredentialsJsonString && gscCredentialsJsonString.trim() !== "") {
        const tempGscPath = path.join(os.tmpdir(), 'gsc-sa-key.json');
        try {
            fs.writeFileSync(tempGscPath, gscCredentialsJsonString, { encoding: 'utf8', mode: 0o600 });
            process.env.GOOGLE_APPLICATION_CREDENTIALS = tempGscPath; // Set for child
            console.log(`[MCP-WRAPPER-GSC] GOOGLE_APPLICATION_CREDENTIALS set to: ${tempGscPath}`);
        } catch (error) { console.error('[MCP-WRAPPER-GSC] CRITICAL: Failed to write GSC credentials file:', error); }
    } else { console.warn('[MCP-WRAPPER-GSC] WARNING: GSC_CREDENTIALS_JSON_STRING env var not set/empty.'); }

    // --- 2. Google Analytics Private Key (Base64 method) ---
    if (process.env.GOOGLE_PRIVATE_KEY_BASE64) { // From Heroku
        try {
            process.env.GOOGLE_PRIVATE_KEY = Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64, 'base64').toString('utf-8'); // Set for child
            console.log('[MCP-WRAPPER-GA] Decoded and set GOOGLE_PRIVATE_KEY from Base64.');
        } catch (error) { console.error('[MCP-WRAPPER-GA] CRITICAL: Failed to decode GOOGLE_PRIVATE_KEY_BASE64:', error); }
    } // process.env.GOOGLE_CLIENT_EMAIL and process.env.GA_PROPERTY_ID are assumed to be directly from Heroku env

    // --- 3. DataForSEO Credentials ---
    // Ensure Heroku config vars are named, e.g., D4SEO_PASSWORD_ACTUAL, D4SEO_USERNAME_ACTUAL
    // The child process mcp-server-dataforseo expects DATAFORSEO_PASSWORD and DATAFORSEO_USERNAME
    if (process.env.D4SEO_PW_ACTUAL) { // This is your Heroku Config Var name
        process.env.DATAFORSEO_PASSWORD = process.env.D4SEO_PW_ACTUAL; // Set for child
        console.log('[MCP-WRAPPER-DFS] DATAFORSEO_PASSWORD set.');
    } else { console.warn('[MCP-WRAPPER-DFS] WARNING: D4SEO_PW_ACTUAL env var not set for DataForSEO.'); }

    if (process.env.D4SEO_UN_ACTUAL) { // This is your Heroku Config Var name
        process.env.DATAFORSEO_USERNAME = process.env.D4SEO_UN_ACTUAL; // Set for child
        console.log('[MCP-WRAPPER-DFS] DATAFORSEO_USERNAME set.');
    } else { console.warn('[MCP-WRAPPER-DFS] WARNING: D4SEO_UN_ACTUAL env var not set for DataForSEO.'); }

    // --- 4. Firecrawl API Key ---
    // The child process mcp-server-firecrawl expects FIRECRAWL_API_KEY
    if (process.env.FIRECRAWL_API_KEY_ACTUAL) { // This is your Heroku Config Var name
        process.env.FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY_ACTUAL; // Set for child
        console.log('[MCP-WRAPPER-FC] FIRECRAWL_API_KEY set.');
    } else { console.warn('[MCP-WRAPPER-FC] WARNING: FIRECRAWL_API_KEY_ACTUAL env var not set.'); }

    // --- 5. Launch @typingmind/mcp ---
    const command = 'npx';
    const args = ['-y', '@typingmind/mcp']; // Add any other args @typingmind/mcp needs

    console.log(`[MCP-WRAPPER] Launching @typingmind/mcp with command: ${command} ${args.join(' ')}`);
    // Log key environment variables to confirm they are set before spawn
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV] GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not set'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV] DATAFORSEO_USERNAME: ${process.env.DATAFORSEO_USERNAME || 'Not set'}`);
    console.log(`[MCP-WRAPPER_PRE_SPAWN_ENV] FIRECRAWL_API_KEY: ${(process.env.FIRECRAWL_API_KEY ? 'Set (value hidden)' : 'Not set')}`);

    const mcpProcess = spawn(command, args, {
        stdio: 'inherit',
        env: process.env // Pass the modified environment
    });
    mcpProcess.on('close', (code) => { /* ... */ });
    mcpProcess.on('error', (err) => { /* ... */ });
}
prepareEnvironmentAndLaunch();
