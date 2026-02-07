# ACRS Local Relay Server

A local GunJS relay that allows all devices on your WiFi network to communicate directly without relying on public relays.

## Quick Start

```bash
# Navigate to relay folder
cd packages/relay

# Install dependencies
npm install

# Start the relay
npm start
```

## How It Works

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Phone (WiFi)  │      │  Laptop (WiFi)  │      │  Desktop (WiFi) │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │   YOUR LOCAL RELAY       │
                    │   (Any WiFi device)      │
                    │   http://192.168.x.x:8765│
                    └──────────────────────────┘
```

## Configuration

After starting the relay, you'll see output like:

```
║  Connect using one of these URLs:
║    http://192.168.1.105:8765/gun    [WiFi]
```

### Option 1: Environment Variable (Recommended)

Create `packages/client/.env.local`:

```
NEXT_PUBLIC_LOCAL_RELAY=http://192.168.1.105:8765/gun
```

Then restart the Next.js dev server.

### Option 2: Temporary Override

In your browser console:
```javascript
localStorage.setItem('LOCAL_RELAY', 'http://192.168.1.105:8765/gun');
location.reload();
```

## Running on Different Devices

### On a Laptop/Desktop

```bash
npm start
```

### On a Raspberry Pi

```bash
# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Navigate and start
cd packages/relay
npm install
npm start
```

### As a Background Service (Linux)

```bash
# Using PM2
npm install -g pm2
pm2 start server.js --name acrs-relay
pm2 save
pm2 startup
```

## Firewall Notes

If other devices can't connect, ensure port 8765 is open:

**Windows:**
```powershell
netsh advfirewall firewall add rule name="ACRS Relay" dir=in action=allow protocol=TCP localport=8765
```

**Linux:**
```bash
sudo ufw allow 8765/tcp
```

**Mac:**
Usually works by default. Accept the popup if prompted.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Check if relay is running, check firewall |
| Can't find IP | Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) |
| Devices not syncing | Ensure all devices are on same WiFi network |
| Relay crashes | Check if port 8765 is already in use |
