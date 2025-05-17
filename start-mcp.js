// start-mcp.js
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function prepareEnvironmentAndLaunch() {
    console.log('[MCP-WRAPPER] Starting environment preparation...');

    // --- 1. Prepare GSC Credentials ---
    const gscCredentialsJsonString = process.env.GOOGLE_APPLICATION_CREDENTIALS_STRING;
    const tempGscCredentialsFileName = 'gsc-sa-key.json';
    const tempGscCredentialsPath = path.join(os.tmpdir(), tempGscCredentialsFileName);

    console.log(`[MCP-WRAPPER-GSC] Target temporary GSC credentials file: ${tempGscCredentialsPath}`);
    if (gscCredentialsJsonString && gscCredentialsJsonString.trim() !== "") {
        console.log(`[MCP-WRAPPER-GSC] GOOGLE_APPLICATION_CREDENTIALS_STRING is set (length: ${gscCredentialsJsonString.length}).`);
        try {
            fs.writeFileSync(tempGscCredentialsPath, gscCredentialsJsonString, { encoding: 'utf8', mode: 0o600 });
            console.log(`[MCP-WRAPPER-GSC] Successfully wrote GSC credentials to ${tempGscCredentialsPath}.`);
            // Set the environment variable for child processes spawned from this script
            process.env.GOOGLE_APPLICATION_CREDENTIALS = tempGscCredentialsPath;
            console.log(`[MCP-WRAPPER-GSC] GOOGLE_APPLICATION_CREDENTIALS set to: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        } catch (error) {
            console.error('[MCP-WRAPPER-GSC] CRITICAL: Failed to write GSC credentials file:', error);
            // Consider exiting if this is critical, or let @typingmind/mcp handle the resulting error.
        }
    } else {
        console.warn('[MCP-WRAPPER-GSC] WARNING: GOOGLE_APPLICATION_CREDENTIALS_STRING env var not set or empty. GSC server may fail.');
    }

    // --- 2. Prepare Google Analytics Private Key (if using Base64 method) ---
    const gaPrivateKeyBase64 = process.env.GOOGLE_PRIVATE_KEY_BASE64;
    if (gaPrivateKeyBase64) {
        console.log('[MCP-WRAPPER-GA] GOOGLE_PRIVATE_KEY_BASE64 is set. Attempting to decode.');
        try {
            const decodedPrivateKey = Buffer.from(gaPrivateKeyBase64, 'base64').toString('utf-8');
            process.env.GOOGLE_PRIVATE_KEY = decodedPrivateKey; // Override for child processes
            console.log('[MCP-WRAPPER-GA] Successfully decoded and set GOOGLE_PRIVATE_KEY from Base64.');
        } catch (error) {
            console.error('[MCP-WRAPPER-GA] CRITICAL: Failed to decode GOOGLE_PRIVATE_KEY_BASE64:', error);
        }
    } else if (process.env.GOOGLE_PRIVATE_KEY) {
         console.log('[MCP-WRAPPER-GA] GOOGLE_PRIVATE_KEY is already set. Assuming Heroku handles newlines or it is single-line.');
    } else {
        console.warn('[MCP-WRAPPER-GA] WARNING: Neither GOOGLE_PRIVATE_KEY_BASE64 nor GOOGLE_PRIVATE_KEY found. GA server may fail.');
    }
    // Ensure other GA env vars are passed if @typingmind/mcp doesn't automatically pass all process.env
    // For safety, we rely on process.env being inherited by the child process, which is default for spawn.

    // --- 3. Launch @typingmind/mcp ---
    // Determine the command and arguments needed to run @typingmind/mcp
    // This might be 'npx', '@typingmind/mcp', plus any arguments like '--config', 'your-config-file.json'
    // Or it might be 'node', 'node_modules/.bin/typingmind-mcp-cli', ...
    // Check your package.json "scripts" for how it's typically started, or @typingmind/mcp docs.

    // Example: If @typingmind/mcp is typically run via npx and finds its config automatically, or via a default config name
    const command = 'npx';
    const args = ['-y', '@typingmind/mcp']; // Add any specific args @typingmind/mcp needs
                                      // e.g., ['-y', '@typingmind/mcp', 'start', '--config', './mcp-servers.json']

    console.log(`[MCP-WRAPPER] Launching @typingmind/mcp with command: ${command} ${args.join(' ')}`);
    console.log(`[MCP-WRAPPER] Current relevant environment variables for child process:`);
    console.log(`[MCP-WRAPPER]   GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'Not set'}`);
    console.log(`[MCP-WRAPPER]   GOOGLE_PRIVATE_KEY: ${(process.env.GOOGLE_PRIVATE_KEY ? 'Set (content hidden)' : 'Not set')}`);


    const mcpProcess = spawn(command, args, {
        stdio: 'inherit', // This pipes the child's stdin, stdout, stderr directly to this wrapper's.
                          // This means you'll see all output from @typingmind/mcp in Heroku logs.
        env: process.env  // This is crucial: it passes the *current* environment,
                          // which includes GOOGLE_APPLICATION_CREDENTIALS we just set,
                          // and the decoded GOOGLE_PRIVATE_KEY.
    });

    mcpProcess.on('close', (code) => {
        console.log(`[MCP-WRAPPER] @typingmind/mcp process exited with code ${code}. Wrapper script also exiting.`);
        process.exit(code); // Exit the wrapper script with the same code as the child process
    });

    mcpProcess.on('error', (err) => {
        console.error('[MCP-WRAPPER] Failed to start @typingmind/mcp process:', err);
        process.exit(1); // Exit with an error code
    });
}

// Run the preparation and launch
prepareEnvironmentAndLaunch();
