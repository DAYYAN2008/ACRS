'use client';

import { ArrowBigUp, ShieldAlert, ShieldCheck, CheckCircle, XCircle, Loader2, Gavel, Gift } from 'lucide-react';
import DecryptingText from './DecryptingText';

export interface RumorVotes {
  weightedTrue: number;
  weightedFalse: number;
  trueCount: number;
  falseCount: number;
  trustScore: number; // 0-100
  hasVoted: boolean;
  canResolve: boolean;
  isResolved: boolean;
  consensus: boolean;
  hasClaimed: boolean;
  votedWithConsensus: boolean;
  epoch: number;
}

interface RumorCardProps {
  id: string;
  text: string;
  time: number;
  votes: RumorVotes | null;
  isConnected: boolean;
  isVoting: boolean;
  onVerify: () => void;
  onDispute: () => void;
  onResolve: () => void;
  onClaim: () => void;
}

export function RumorCard({
  id,
  text,
  time,
  votes,
  isConnected,
  isVoting,
  onVerify,
  onDispute,
  onResolve,
  onClaim,
}: RumorCardProps) {
  const trustPercent = votes?.trustScore ?? 50;
  const hasAnyVotes = votes && (votes.trueCount > 0 || votes.falseCount > 0);

  const isVerified = votes?.isResolved ? votes.consensus : trustPercent >= 70 && hasAnyVotes;
  const isDisputed = votes?.isResolved ? !votes.consensus : trustPercent < 40 && hasAnyVotes;

  const getTrustColor = () => {
    if (!hasAnyVotes) return 'bg-white/10';
    if (trustPercent >= 70) return 'bg-emerald-500';
    if (trustPercent >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTrustLabel = () => {
    if (votes?.isResolved) {
      return votes.consensus ? 'Verified ✓' : 'Disputed ✗';
    }
    if (!hasAnyVotes) return 'Scanning...';
    if (trustPercent >= 70) return 'Highly Probable';
    if (trustPercent >= 40) return 'Unverified';
    return 'Likely False';
  };

  return (
    <article className={`
      relative group overflow-hidden rounded-xl border p-6 transition-all duration-500
      ${isVerified ? 'border-emerald-500/30 glow-green' : isDisputed ? 'border-rose-500/30 glow-red animate-glitch' : 'border-white/5'}
      glass-dark hover:border-accent-purple/40
    `}>
      {/* Background Decorative Element */}
      <div className="absolute top-0 right-0 p-2 opacity-5 font-mono text-[10px] select-none pointer-events-none">
        ENCRYPTED_PACKET_{id.slice(0, 8).toUpperCase()}
      </div>

      <div className="flex flex-col gap-4">
        {/* Header: Badge + Timestamp */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase">
              {new Date(time).toLocaleTimeString()}
            </span>
            {votes?.isResolved && (
              <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tracking-tighter uppercase border ${votes.consensus
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                {votes.consensus ? 'Decrypted' : 'Compromised'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isVerified && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                <ShieldCheck size={12} /> Authenticated
              </span>
            )}
            {isDisputed && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase tracking-tighter line-through decoration-rose-500/50">
                <ShieldAlert size={12} /> Refuted
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-text-primary text-base leading-relaxed font-light">
          <DecryptingText text={text} speed={20} />
        </p>

        {/* Trust Indicators */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-tight text-text-secondary">
            <span>Probability Matrix</span>
            <span className={isVerified ? 'text-emerald-400' : isDisputed ? 'text-rose-400' : ''}>
              {getTrustLabel()} ({trustPercent}%)
            </span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full ${getTrustColor()} transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
              style={{ width: `${trustPercent}%` }}
            />
          </div>
          {hasAnyVotes && (
            <div className="flex gap-4 text-[9px] font-mono text-text-secondary/60">
              <span className="flex items-center gap-1">
                <CheckCircle size={10} className="text-emerald-500/40" /> {votes.trueCount} Confirmations ({votes.weightedTrue}W)
              </span>
              <span className="flex items-center gap-1">
                <XCircle size={10} className="text-rose-500/40" /> {votes.falseCount} Refutations ({votes.weightedFalse}W)
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2 flex-wrap">
            {/* Resolve: Available when threshold reached */}
            {votes?.canResolve && !votes.isResolved && isConnected && (
              <button
                onClick={onResolve}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider 
                bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all"
              >
                <Gavel size={12} /> Resolve Packet
              </button>
            )}

            {/* Claim Reward/Penalty */}
            {votes?.isResolved && votes.hasVoted && !votes.hasClaimed && isConnected && (
              <button
                onClick={onClaim}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border
                ${votes.votedWithConsensus
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40'
                  }`}
              >
                <Gift size={12} /> {votes.votedWithConsensus ? 'Claim Data Credits' : 'Accept Penalty'}
              </button>
            )}

            {/* Status if claimed */}
            {votes?.isResolved && votes.hasVoted && votes.hasClaimed && (
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border
                ${votes.votedWithConsensus ? 'border-emerald-500/10 text-emerald-400/50' : 'border-rose-500/10 text-rose-400/50'}`}>
                {votes.votedWithConsensus ? '+2 Trust Gained' : '-1 Trust Lost'}
              </span>
            )}

            {/* Already Voted feedback */}
            {votes?.hasVoted && !votes.isResolved ? (
              <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-text-secondary/50 border border-white/5">
                Voted · Awaiting Consensus
              </span>
            ) : !votes?.hasVoted && !votes?.isResolved ? (
              <div className="flex gap-2">
                <button
                  onClick={onVerify}
                  disabled={!isConnected || isVoting}
                  className={`
                    group/btn flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide
                    transition-all duration-300 border
                    ${!isConnected || isVoting ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                    bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40
                  `}
                >
                  {isVoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowBigUp size={16} className="group-hover/btn:animate-pulse-subtle" />}
                  Confirm
                </button>
                <button
                  onClick={onDispute}
                  disabled={!isConnected || isVoting}
                  className={`
                    group/btn flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide
                    transition-all duration-300 border
                    ${!isConnected || isVoting ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                    bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40
                  `}
                >
                  {isVoting ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} className="group-hover/btn:animate-shake" />}
                  Refute
                </button>
              </div>
            ) : null}
          </div>
          <span className="text-[9px] font-mono text-text-secondary/40 hidden sm:block">
            P2P_SIG_0X...{id.slice(-4).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Hover Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </article>
  );
}

export default RumorCard;
