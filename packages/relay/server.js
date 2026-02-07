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
         peers: 'active',
         timestamp: Date.now()
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
   radisk: true,  // Enable persistent storage on the relay
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
   console.log('\n╔════════════════════════════════════════════════════════════════╗');
   console.log('║           ACRS LOCAL RELAY SERVER - RUNNING                    ║');
   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log(`║  Port: ${PORT}                                                    ║`);
   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log('║  Connect using one of these URLs:                              ║');

   const ips = getLocalIPs();
   if (ips.length === 0) {
      console.log(`║    http://localhost:${PORT}/gun                                  ║`);
   } else {
      ips.forEach(({ name, address }) => {
         const url = `http://${address}:${PORT}/gun`;
         const padding = ' '.repeat(Math.max(0, 48 - url.length));
         console.log(`║    ${url}${padding}[${name}] ║`);
      });
   }

   console.log('╠════════════════════════════════════════════════════════════════╣');
   console.log('║  To use in your ACRS app:                                      ║');
   console.log('║                                                                 ║');
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
   server.close(() => {
      console.log('✅ Relay stopped.');
      process.exit(0);
   });
});
