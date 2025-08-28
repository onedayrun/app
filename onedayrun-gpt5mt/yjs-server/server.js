const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Y.js WebSocket Server');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req, {
    gc: true,
    gcFilter: () => true,
  });
});

const PORT = process.env.PORT || 4444;
server.listen(PORT, () => {
  console.log(`Y.js WebSocket server running on port ${PORT}`);
});
