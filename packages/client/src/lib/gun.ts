/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// RELAY CONFIGURATION
// =============================================================================

// Local relay - set this to your campus relay when running locally
const LOCAL_RELAY = process.env.NEXT_PUBLIC_LOCAL_RELAY || null;

// Public community relays (fallback when local relay unavailable)
const PUBLIC_RELAYS = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://gun-us.herokuapp.com/gun',
  'https://relay.1234.as/gun',
  'https://gun-matrix.herokuapp.com/gun',
  'https://gundb-relay-mlccl.ondigitalocean.app/gun',
  'https://gun-ams1.maddiex.wtf/gun',
  'https://gun-sjc1.maddiex.wtf/gun',
];

// Build peer list: local relay first (if configured), then public relays
const RELAY_PEERS = LOCAL_RELAY
  ? [LOCAL_RELAY, ...PUBLIC_RELAYS]
  : PUBLIC_RELAYS;

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

  console.log('[GunJS] Connecting to relays:', RELAY_PEERS.slice(0, 3).join(', '), '...');

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