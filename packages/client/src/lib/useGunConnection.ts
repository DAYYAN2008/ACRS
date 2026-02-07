'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribeToConnection, reconnect, getConnectionState, GunConnectionState, ConnectionStatus } from './gun';

export interface UseGunConnectionReturn {
   status: ConnectionStatus;
   peerCount: number;
   lastSync: number | null;
   error: string | null;
   isConnected: boolean;
   reconnect: () => void;
}

/**
 * React hook for tracking GunJS P2P connection status
 * Provides real-time updates on connection health and peer count
 */
export function useGunConnection(): UseGunConnectionReturn {
   const [connectionState, setConnectionState] = useState<GunConnectionState>(getConnectionState);

   useEffect(() => {
      // Subscribe to connection state changes
      const unsubscribe = subscribeToConnection((state) => {
         setConnectionState(state);
      });

      return unsubscribe;
   }, []);

   const handleReconnect = useCallback(() => {
      reconnect();
   }, []);

   return {
      status: connectionState.status,
      peerCount: connectionState.peerCount,
      lastSync: connectionState.lastSync,
      error: connectionState.error,
      isConnected: connectionState.status === 'connected',
      reconnect: handleReconnect,
   };
}

export default useGunConnection;
