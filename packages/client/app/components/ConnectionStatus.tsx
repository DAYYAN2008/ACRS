'use client';

import { Wifi, WifiOff, RefreshCw, Circle } from 'lucide-react';
import { useGunConnection } from '@/src/lib/useGunConnection';

/**
 * ConnectionStatus - Displays P2P network connection health
 * Shows connection status, peer count, and allows manual reconnection
 */
export function ConnectionStatus() {
   const { status, peerCount, lastSync, isConnected, reconnect } = useGunConnection();

   const getStatusColor = () => {
      switch (status) {
         case 'connected':
            return 'text-emerald-400';
         case 'connecting':
            return 'text-amber-400';
         case 'disconnected':
         case 'error':
            return 'text-rose-400';
         default:
            return 'text-gray-400';
      }
   };

   const getStatusIcon = () => {
      switch (status) {
         case 'connected':
            return <Wifi className="w-4 h-4" />;
         case 'connecting':
            return <RefreshCw className="w-4 h-4 animate-spin" />;
         case 'disconnected':
         case 'error':
            return <WifiOff className="w-4 h-4" />;
         default:
            return <Circle className="w-4 h-4" />;
      }
   };

   const getStatusText = () => {
      switch (status) {
         case 'connected':
            return `Connected · ${peerCount} peer${peerCount !== 1 ? 's' : ''}`;
         case 'connecting':
            return 'Connecting to P2P network...';
         case 'disconnected':
            return 'Disconnected from network';
         case 'error':
            return 'Connection error';
         default:
            return 'Unknown status';
      }
   };

   const formatLastSync = () => {
      if (!lastSync) return '';
      const seconds = Math.floor((Date.now() - lastSync) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      return `${Math.floor(seconds / 60)}m ago`;
   };

   return (
      <div className="flex items-center gap-3">
         <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d0d14] border border-cyan-500/20 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-xs font-medium">{getStatusText()}</span>
         </div>

         {lastSync && isConnected && (
            <span className="text-xs text-cyan-500/50">
               Synced {formatLastSync()}
            </span>
         )}

         {(status === 'disconnected' || status === 'error') && (
            <button
               onClick={reconnect}
               className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors"
            >
               <RefreshCw className="w-3 h-3" />
               Retry
            </button>
         )}
      </div>
   );
}

export default ConnectionStatus;
