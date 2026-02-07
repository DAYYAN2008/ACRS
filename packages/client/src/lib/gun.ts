/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// RELAY CONFIGURATION
// =============================================================================

// Local relay — this is the ONLY relay used for campus LAN P2P.
// Set via NEXT_PUBLIC_LOCAL_RELAY in .env.local, or falls back to the hardcoded LAN IP.
// Public relays are intentionally excluded — they are unreliable and cause sync issues.
const LOCAL_RELAY = process.env.NEXT_PUBLIC_LOCAL_RELAY || 'http://10.7.48.61:8765/gun';

// Peer list — only the local campus relay
const RELAY_PEERS = [LOCAL_RELAY];

// =============================================================================
// CONNECTION STATE MANAGEMENT
// =============================================================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface GunConnectionState {
  status: ConnectionStatus;
  peerCount: number;
  lastSync: number | null;
  error: string | null;
  activeRelay: string | null;
}

type ConnectionCallback = (state: GunConnectionState) => void;
const connectionCallbacks: Set<ConnectionCallback> = new Set();

let connectionState: GunConnectionState = {
  status: 'connecting',
  peerCount: 0,
  lastSync: null,
  error: null,
  activeRelay: null,
};

// =============================================================================
// GUN INSTANCE
// =============================================================================

function createGunInstance() {
  if (typeof window === 'undefined') return null;

  // Use require inside the function to prevent server-side initialization
  const Gun = require('gun');

  console.log('[ACRS] Connecting to local relay:', LOCAL_RELAY);

  const gun = Gun({
    peers: RELAY_PEERS,
    localStorage: true,
    radisk: false, // Disabled for Next.js compatibility
    axe: false,    // Disable AXE to prevent server-side backgrounds
    multicast: false, // Disable multicast to prevent server-side logs
  });

  return gun;
}

const gun: any = createGunInstance();

// =============================================================================
// CONNECTION MONITORING
// =============================================================================

let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

function startConnectionMonitoring() {
  if (connectionCheckInterval) return;

  updateConnectionState({ status: 'connecting' });

  connectionCheckInterval = setInterval(() => {
    checkConnectionHealth();
  }, 5000);

  setTimeout(checkConnectionHealth, 1000);
}

function checkConnectionHealth() {
  if (!gun) return;

  const testKey = `__health_${Date.now()}`;
  const testValue = { ping: Date.now() };

  gun.get('acrs-health').get(testKey).put(testValue as any, (ack: any) => {
    if (ack && ack.err) {
      updateConnectionState({
        status: 'error',
        error: ack.err,
      });
    } else {
      updateConnectionState({
        status: 'connected',
        lastSync: Date.now(),
        error: null,
      });
    }
  });

  estimatePeerCount();
}

function estimatePeerCount() {
  if (!gun) return;

  let responsesReceived = 0;

  gun.get('acrs-channel').map().once(() => {
    responsesReceived++;
  });

  setTimeout(() => {
    const estimatedPeers = responsesReceived > 0 ? Math.min(responsesReceived, RELAY_PEERS.length) : 0;
    updateConnectionState({ peerCount: estimatedPeers });
  }, 2000);
}

function updateConnectionState(updates: Partial<GunConnectionState>) {
  connectionState = { ...connectionState, ...updates };
  notifyConnectionListeners();
}

function notifyConnectionListeners() {
  connectionCallbacks.forEach(callback => callback(connectionState));
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function subscribeToConnection(callback: ConnectionCallback): () => void {
  connectionCallbacks.add(callback);
  callback(connectionState);

  return () => {
    connectionCallbacks.delete(callback);
  };
}

export function getConnectionState(): GunConnectionState {
  return { ...connectionState };
}

export function reconnect() {
  updateConnectionState({ status: 'connecting', error: null });
  checkConnectionHealth();
}

export function getConfiguredRelays(): string[] {
  return [...RELAY_PEERS];
}

// Start monitoring when module loads (browser only)
if (typeof window !== 'undefined') {
  startConnectionMonitoring();
}

export default gun;