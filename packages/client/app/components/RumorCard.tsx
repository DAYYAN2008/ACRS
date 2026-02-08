'use client';

<<<<<<< HEAD
import { ArrowBigUp, ShieldAlert, ShieldCheck } from 'lucide-react';
import DecryptingText from './DecryptingText';

interface Rumor {
   id: string;
   text: string;
   time: number;
}

interface RumorCardProps {
   rumor: Rumor;
   onVote: (text: string, id: string, isTrue: boolean) => Promise<void>;
   isVoting: boolean;
   trustScore?: number; // Optional if we want to show specific rumor trust
}

export default function RumorCard({ rumor, onVote, isVoting }: RumorCardProps) {
   // Mocking trust state for visual demo - in real app this would come from props/contract
   // Using ID hash to simulate different states for demo purposes
   const isVerified = rumor.id.length % 3 === 0;
   const isDisputed = rumor.id.length % 5 === 0 && !isVerified;

   return (
      <article className={`
      relative group overflow-hidden rounded-xl border p-6 transition-all duration-500
      ${isVerified ? 'border-emerald-500/30 glow-green' : isDisputed ? 'border-rose-500/30 glow-red animate-glitch' : 'border-white/5'}
      glass-dark hover:border-accent-purple/40
    `}>
         {/* Background Decorative Element */}
         <div className="absolute top-0 right-0 p-2 opacity-5 font-mono text-[10px] select-none pointer-events-none">
            ENCRYPTED_PACKET_{rumor.id.slice(0, 8).toUpperCase()}
         </div>

         <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-mono tracking-widest text-text-secondary uppercase">
                  Captured: {new Date(rumor.time).toLocaleTimeString()}
               </span>
               <div className="flex items-center gap-1.5">
                  {isVerified && (
                     <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                        <ShieldCheck size={12} /> Verified
                     </span>
                  )}
                  {isDisputed && (
                     <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase tracking-tighter line-through decoration-rose-500/50">
                        <ShieldAlert size={12} /> Disputed
                     </span>
                  )}
               </div>
            </div>

            <p className="text-text-primary text-base leading-relaxed font-light">
               <DecryptingText text={rumor.text} speed={20} />
            </p>

            <div className="flex items-center justify-between pt-2">
               <div className="flex gap-3">
                  <button
                     onClick={() => onVote(rumor.text, rumor.id, true)}
                     disabled={isVoting}
                     className={`
                group/btn flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide
                transition-all duration-300 border
                ${isVoting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40
              `}
                  >
                     <ArrowBigUp size={16} className="group-hover/btn:animate-pulse-subtle" />
                     Confirm
                  </button>
                  <button
                     onClick={() => onVote(rumor.text, rumor.id, false)}
                     disabled={isVoting}
                     className={`
                group/btn flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide
                transition-all duration-300 border
                ${isVoting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40
              `}
                  >
                     <ShieldAlert size={14} className="group-hover/btn:animate-shake" />
                     Refute
                  </button>
               </div>
               <span className="text-[10px] font-mono text-text-secondary/50">
                  Source: P2P_NODE_0X...{rumor.id.slice(-4)}
               </span>
            </div>
         </div>

         {/* Hover Glow Effect */}
         <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </article>
   );
=======
import { CheckCircle, XCircle, Loader2, Gavel, Gift } from 'lucide-react';

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

  const getTrustColor = () => {
    if (!hasAnyVotes) return 'bg-gray-500/50';
    if (trustPercent >= 70) return 'bg-emerald-500';
    if (trustPercent >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getTrustLabel = () => {
    if (votes?.isResolved) {
      return votes.consensus ? 'Verified ✓' : 'Disputed ✗';
    }
    if (!hasAnyVotes) return 'Unverified';
    if (trustPercent >= 70) return 'Likely True';
    if (trustPercent >= 40) return 'Uncertain';
    return 'Disputed';
  };

  const getTrustBorderColor = () => {
    if (votes?.isResolved) {
      return votes.consensus ? 'border-emerald-500/50' : 'border-rose-500/50';
    }
    if (!hasAnyVotes) return 'border-gray-500/30';
    if (trustPercent >= 70) return 'border-emerald-500/40';
    if (trustPercent >= 40) return 'border-amber-500/40';
    return 'border-rose-500/40';
  };

  const getLabelColor = () => {
    if (votes?.isResolved) {
      return votes.consensus ? 'text-emerald-400' : 'text-rose-400';
    }
    if (!hasAnyVotes) return 'text-gray-400';
    if (trustPercent >= 70) return 'text-emerald-400';
    if (trustPercent >= 40) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <article className={`rounded-lg border ${getTrustBorderColor()} bg-[#0d0d14] p-5 hover:border-cyan-500/40 transition-colors`}>
      {/* Resolution Badge */}
      {votes?.isResolved && (
        <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-3 ${
          votes.consensus
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
        }`}>
          {votes.consensus ? 'COMMUNITY VERIFIED' : 'COMMUNITY DISPUTED'}
        </div>
      )}

      {/* Rumor Content */}
      <p className="text-cyan-100 leading-relaxed mb-4">{text}</p>

      {/* Trust Score Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cyan-500/70">Trust Score</span>
          <span className={`text-xs font-medium ${getLabelColor()}`}>
            {getTrustLabel()} ({trustPercent}%)
          </span>
        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${getTrustColor()} transition-all duration-500`}
            style={{ width: `${trustPercent}%` }}
          />
        </div>

        {hasAnyVotes && (
          <div className="flex items-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400/70">
              <CheckCircle className="w-3 h-3" />
              {votes!.trueCount} verified (w: {votes!.weightedTrue})
            </span>
            <span className="flex items-center gap-1 text-rose-400/70">
              <XCircle className="w-3 h-3" />
              {votes!.falseCount} disputed (w: {votes!.weightedFalse})
            </span>
          </div>
        )}
      </div>

      {/* Footer: Time + Action Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-cyan-500/70">
          {new Date(time).toLocaleTimeString()} · P2P
        </span>

        <div className="flex gap-2 flex-wrap">
          {/* Resolve Button — anyone can call once threshold met */}
          {votes?.canResolve && !votes.isResolved && isConnected && (
            <button onClick={onResolve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 transition-colors">
              <Gavel className="w-3 h-3" />
              Resolve
            </button>
          )}

          {/* Claim Reward Button — after resolution, if voted and not claimed */}
          {votes?.isResolved && votes.hasVoted && !votes.hasClaimed && isConnected && (
            <button onClick={onClaim}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                votes.votedWithConsensus
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300'
              }`}>
              <Gift className="w-3 h-3" />
              {votes.votedWithConsensus ? 'Claim +2 Trust' : 'Accept -1 Penalty'}
            </button>
          )}

          {/* Claimed status */}
          {votes?.isResolved && votes.hasVoted && votes.hasClaimed && (
            <span className={`px-3 py-1.5 rounded text-xs font-medium ${
              votes.votedWithConsensus
                ? 'bg-emerald-500/10 text-emerald-400/70'
                : 'bg-rose-500/10 text-rose-400/70'
            }`}>
              {votes.votedWithConsensus ? 'Rewarded +2' : 'Penalized -1'}
            </span>
          )}

          {/* Already Voted indicator */}
          {votes?.hasVoted && !votes.isResolved ? (
            <span className="px-3 py-1.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
              Voted · Awaiting Resolution
            </span>
          ) : !votes?.hasVoted && !votes?.isResolved ? (
            <>
              <button onClick={onVerify} disabled={!isConnected || isVoting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isVoting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Verify
              </button>
              <button onClick={onDispute} disabled={!isConnected || isVoting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isVoting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Dispute
              </button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
>>>>>>> a200b9ea0bf2181050cb2ea0d65c756dbd2691c0
}
