/**
 * ACRS Local Relay Server
 * 
 * Run this on any device connected to your campus WiFi to create a local
 * P2P relay that all devices on the same network can use.
 * 
 * Usage:
 *   npm install
 *   npm start
 * 
 * Then set NEXT_PUBLIC_LOCAL_RELAY=http://<YOUR_IP>:8765/gun in the client.
 */

const http = require('http');
const Gun = require('gun');
const os = require('os');

const PORT = process.env.PORT || 8765;
const GUN_PEERS = process.env.GUN_PEERS ? process.env.GUN_PEERS.split(',') : [];

// Get local IP addresses for display
function getLocalIPs() {
   const interfaces = os.networkInterfaces();
   const ips = [];

   for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
         // Skip internal and non-IPv4
         if (iface.family === 'IPv4' && !iface.internal) {
            ips.push({ name, address: iface.address });
         }
      }
   }
   return ips;
}

// Create HTTP server
const server = http.createServer((req, res) => {
   // CORS headers — MUST be set on ALL responses for browser clients
   res.setHeader('Access-Control-Allow-Origin', '*');
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers', '*');

   if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
   }

   // Health check endpoint
   if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
         status: 'ok',
         service: 'acrs-relay',
         peers: GUN_PEERS.length,
         timestamp: Date.now(),
         uptime: process.uptime()
      }));
      return;
   }

   // Default response
   res.writeHead(200, { 'Content-Type': 'text/html' });
   res.end('<h1>ACRS GunDB Relay — Running</h1>');
});

// Attach GunJS to the server
const gun = Gun({
   web: server,
   peers: GUN_PEERS,
   radisk: true,  // Enable persistent storage on the relay
});

// Global error handling for Gun
gun.on('error', (err) => {
   console.error('[Gun Error]:', err);
});

// Start server
server.on('error', (err) => {
   console.error('[Server Error]:', err);
});

server.listen(PORT, '0.0.0.0', () => {
   console.log('\n╔════════════════════════════════════════════════════════════════╗');
   console.log('║           ACRS LOCAL RELAY SERVER - RUNNING                    ║');
   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log(`║  Port: ${PORT.toString().padEnd(52)}║`);
   if (GUN_PEERS.length > 0) {
      console.log(`║  Upstream Peers: ${GUN_PEERS.length.toString().padEnd(46)}║`);
   }
   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log('║  Connect using one of these URLs:                              ║');

   const ips = getLocalIPs();
   if (ips.length === 0) {
      console.log(`║    http://localhost:${PORT}/gun`.padEnd(65) + '║');
   } else {
      ips.forEach(({ name, address }) => {
         const url = `http://${address}:${PORT}/gun`;
         const line = `║    ${url} [${name}]`;
         console.log(line.padEnd(65) + '║');
      });
   }

   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log('║  To use in your ACRS app:                                      ║');
   console.log('║                                                                ║');
   console.log('║  1. Create a .env.local file in packages/client/               ║');
   console.log(`║  2. Add: NEXT_PUBLIC_LOCAL_RELAY=http://<IP>:${PORT}/gun          ║`);
   console.log('║  3. Restart the Next.js dev server                             ║');
   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log('║  Press Ctrl+C to stop the relay                                ║');
   console.log('╚════════════════════════════════════════════════════════════════╝\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
   console.log('\n👋 Shutting down relay server...');

   // Close the server first to stop new connections
   server.close(() => {
      console.log('✅ HTTP Server stopped.');

      // Gun doesn't have a simple close(), but we can try to let it finish its work
      // and then exit. 
      setTimeout(() => {
         console.log('✅ Relay shutdown complete.');
         process.exit(0);
      }, 500);
   });
});

process.on('uncaughtException', (err) => {
   console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
   console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

