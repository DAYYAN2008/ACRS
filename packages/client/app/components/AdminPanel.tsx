'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, SkipForward, Slash, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { ethers } from 'ethers';

interface AdminPanelProps {
  account: string;
  getContract: (needsSigner?: boolean) => Promise<ethers.Contract | null>;
  onAction: () => void;
}

/**
 * AdminPanel — Owner-only controls for epoch management and user slashing.
 * Only renders if the connected wallet is the contract owner.
 */
export function AdminPanel({ account, getContract, onAction }: AdminPanelProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isSlashing, setIsSlashing] = useState(false);
  const [slashAddress, setSlashAddress] = useState('');
  const [slashAmount, setSlashAmount] = useState('5');
  const [slashReason, setSlashReason] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const checkOwnership = useCallback(async () => {
    try {
      const contract = await getContract();
      if (!contract) return;
      const owner = await contract.owner();
      setIsOwner(owner.toLowerCase() === account.toLowerCase());
      const epoch = await contract.currentEpoch();
      setCurrentEpoch(Number(epoch));
    } catch (err) {
      console.error('Error checking ownership:', err);
    }
  }, [account, getContract]);

  useEffect(() => {
    checkOwnership();
  }, [checkOwnership]);

  // Only show the panel to the contract owner
  if (!isOwner) return null;

  const advanceEpoch = async () => {
    setIsAdvancing(true);
    setResult(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const tx = await contract.advanceEpoch();
      await tx.wait();
      setCurrentEpoch((prev) => prev + 1);
      setResult({ type: 'success', message: `Epoch advanced to ${currentEpoch + 1}` });
      onAction();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ type: 'error', message: 'Failed to advance epoch: ' + msg.slice(0, 60) });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSlash = async () => {
    if (!slashAddress || !ethers.isAddress(slashAddress)) {
      setResult({ type: 'error', message: 'Enter a valid address to slash.' });
      return;
    }
    setIsSlashing(true);
    setResult(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const tx = await contract.slash(slashAddress, parseInt(slashAmount), slashReason || 'Admin action');
      await tx.wait();
      setResult({
        type: 'success',
        message: `Slashed ${slashAddress.slice(0, 6)}...${slashAddress.slice(-4)} by ${slashAmount} points`,
      });
      setSlashAddress('');
      setSlashReason('');
      onAction();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotRegistered')) {
        setResult({ type: 'error', message: 'That address is not registered.' });
      } else if (msg.includes('TrustScoreOutOfBounds')) {
        setResult({ type: 'error', message: 'Slash amount exceeds user trust score.' });
      } else {
        setResult({ type: 'error', message: 'Slash failed: ' + msg.slice(0, 60) });
      }
    } finally {
      setIsSlashing(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-[#0d0d14] border border-amber-500/30">
      <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Admin Panel · Epoch {currentEpoch}
      </h3>

      <div className="space-y-4">
        {/* Advance Epoch */}
        <div className="flex items-center gap-3">
          <button
            onClick={advanceEpoch}
            disabled={isAdvancing}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 disabled:opacity-50 transition-colors"
          >
            {isAdvancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <SkipForward className="w-3 h-3" />}
            Advance Epoch
          </button>
          <span className="text-xs text-cyan-500/50">Resets vote tallies for a new time window</span>
        </div>

        {/* Slash User */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={slashAddress}
              onChange={(e) => setSlashAddress(e.target.value)}
              placeholder="0x... address to slash"
              className="flex-1 bg-[#0a0a0f] border border-rose-500/30 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-500/40 focus:outline-none focus:border-rose-400/60"
            />
            <input
              type="number"
              value={slashAmount}
              onChange={(e) => setSlashAmount(e.target.value)}
              min="1"
              max="100"
              className="w-20 bg-[#0a0a0f] border border-rose-500/30 rounded px-2 py-2 text-sm text-cyan-100 text-center focus:outline-none focus:border-rose-400/60"
            />
            <button
              onClick={handleSlash}
              disabled={isSlashing || !slashAddress.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 disabled:opacity-50 transition-colors"
            >
              {isSlashing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Slash className="w-3 h-3" />}
              Slash
            </button>
          </div>
          <input
            type="text"
            value={slashReason}
            onChange={(e) => setSlashReason(e.target.value)}
            placeholder="Reason for slashing (optional)"
            className="w-full bg-[#0a0a0f] border border-rose-500/30 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-500/40 focus:outline-none focus:border-rose-400/60"
          />
        </div>
      </div>

      {result && (
        <div className={`flex items-center gap-2 mt-3 text-xs ${result.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {result.type === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
