const http = require('http');
const PORT = process.env.PORT || 8080; // Use Railway's port or default

const server = http.createServer((req, res) => {
  console.log(`[Simple Server] Received request: ${req.method} ${req.url} at ${new Date().toISOString()}`);
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from simple server!', status: 'ok' }));
    console.log('[Simple Server] Responded to /ping successfully.');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    console.log(`[Simple Server] Responded 404 to ${req.url}`);
  }
});

server.listen(PORT, '0.0.0.0', () => { // Listen on 0.0.0.0 for container environments
  console.log(`[Simple Server] Server is listening on port ${PORT}`);
});
