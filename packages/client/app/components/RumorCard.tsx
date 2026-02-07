'use client';

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
}

export default RumorCard;
