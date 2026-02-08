import Gun from 'gun';

// We need to connect to public "Relay Nodes" so users can find each other.
// These are free, community-run servers that just bounce signals.
const peers = [
  'https://3f1fb3bf-99e3-415b-83ae-8821402ae4dd-00-cau89310wj6w.sisko.replit.dev/gun',
  'https://gun-manhattan.herokuapp.com/gun', // The main community relay
  'https://relay.1234.as/gun',              // Backup relay
  'https://gun-us.herokuapp.com/gun'        // Backup relay
];

const localRelay = process.env.NEXT_PUBLIC_LOCAL_RELAY;
if (localRelay) {
  peers.unshift(localRelay);
}

const gun = Gun({
  peers: peers
});


export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface GunConnectionState {
  status: ConnectionStatus;
  peerCount: number;
  lastSync: number | null;
  error: string | null;
}

const state: GunConnectionState = {
  status: 'disconnected',
  peerCount: 0,
  lastSync: null,
  error: null
};

const listeners = new Set<(state: GunConnectionState) => void>();

export const getConnectionState = (): GunConnectionState => state;

export const subscribeToConnection = (cb: (state: GunConnectionState) => void) => {
  listeners.add(cb);
  cb(state);
  return () => { listeners.delete(cb); };
};


const notify = () => {
  listeners.forEach(cb => cb({ ...state }));
};

// @ts-ignore - Gun types can be tricky
gun.on('hi', () => {
  state.peerCount++;
  state.status = 'connected';
  state.lastSync = Date.now();
  notify();
});

// @ts-ignore
gun.on('bye', () => {
  state.peerCount = Math.max(0, state.peerCount - 1);
  if (state.peerCount === 0) state.status = 'disconnected';
  notify();
});

export const reconnect = () => {
  state.status = 'connecting';
  notify();
  // Gun internals handle actual reconnection, we just update local state
};

export default gun;