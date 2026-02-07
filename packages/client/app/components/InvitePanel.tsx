'use client';

import { useState } from 'react';
import { UserPlus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';

interface InvitePanelProps {
  account: string;
  trustScore: number;
  getContract: (needsSigner?: boolean) => Promise<ethers.Contract | null>;
  onInviteSuccess: () => void;
}

/**
 * InvitePanel — Lets registered users invite friends into the trust network.
 * Staking INVITE_STAKE (5) trust points per invite as Sybil resistance.
 */
export function InvitePanel({ account, trustScore, getContract, onInviteSuccess }: InvitePanelProps) {
  const [inviteeAddress, setInviteeAddress] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canInvite = trustScore >= 5; // INVITE_STAKE = 5

  const handleInvite = async () => {
    if (!inviteeAddress || !ethers.isAddress(inviteeAddress)) {
      setResult({ type: 'error', message: 'Please enter a valid Ethereum address.' });
      return;
    }

    if (inviteeAddress.toLowerCase() === account.toLowerCase()) {
      setResult({ type: 'error', message: 'You cannot invite yourself.' });
      return;
    }

    setIsInviting(true);
    setResult(null);

    try {
      const contract = await getContract(true);
      if (!contract) return;

      // Generate a commitment for the invitee (hash of their address + timestamp)
      const commitment = ethers.keccak256(
        ethers.solidityPacked(['address', 'uint256'], [inviteeAddress, Date.now()])
      );

      const tx = await contract.inviteUser(inviteeAddress, commitment);
      await tx.wait();

      setResult({
        type: 'success',
        message: `Invited ${inviteeAddress.slice(0, 6)}...${inviteeAddress.slice(-4)} — they can now vote!`,
      });
      setInviteeAddress('');
      onInviteSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AlreadyRegistered')) {
        setResult({ type: 'error', message: 'This address is already registered.' });
      } else if (msg.includes('InsufficientTrustToInvite')) {
        setResult({ type: 'error', message: 'Your trust score is too low to invite (need ≥5).' });
      } else if (msg.includes('CannotInviteSelf')) {
        setResult({ type: 'error', message: 'You cannot invite yourself.' });
      } else {
        setResult({ type: 'error', message: 'Invite failed: ' + msg.slice(0, 80) });
      }
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-[#0d0d14] border border-cyan-500/20">
      <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
        <UserPlus className="w-4 h-4" />
        Invite a Friend
      </h3>

      {!canInvite ? (
        <p className="text-xs text-amber-400/70">
          You need a trust score of at least 5 to invite others. Current: {trustScore}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteeAddress}
              onChange={(e) => setInviteeAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="0x... friend's wallet address"
              className="flex-1 bg-[#0a0a0f] border border-cyan-500/30 rounded px-3 py-2 text-sm text-cyan-100 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400/60"
            />
            <button
              onClick={handleInvite}
              disabled={isInviting || !inviteeAddress.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isInviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
              {isInviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
          <p className="text-xs text-cyan-500/50 mt-2">
            Inviting stakes 5 trust points. If they misbehave, you lose those points.
          </p>
        </>
      )}

      {result && (
        <div className={`flex items-center gap-2 mt-3 text-xs ${result.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {result.type === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

export default InvitePanel;
