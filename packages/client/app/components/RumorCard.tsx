'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface RumorVotes {
   weightedTrue: number;
   weightedFalse: number;
   trueCount: number;
   falseCount: number;
   trustScore: number; // 0-100
   hasVoted: boolean;
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
}

/**
 * RumorCard - Individual rumor display with trust score visualization
 * Shows rumor content, trust score bar, vote counts, and voting buttons
 */
export function RumorCard({
   id,
   text,
   time,
   votes,
   isConnected,
   isVoting,
   onVerify,
   onDispute,
}: RumorCardProps) {
   // Calculate trust percentage for the progress bar
   const trustPercent = votes?.trustScore ?? 50;

   // Determine trust level color
   const getTrustColor = () => {
      if (!votes || (votes.trueCount === 0 && votes.falseCount === 0)) {
         return 'bg-gray-500/50'; // Neutral - no votes
      }
      if (trustPercent >= 70) return 'bg-emerald-500';
      if (trustPercent >= 40) return 'bg-amber-500';
      return 'bg-rose-500';
   };

   const getTrustLabel = () => {
      if (!votes || (votes.trueCount === 0 && votes.falseCount === 0)) {
         return 'Unverified';
      }
      if (trustPercent >= 70) return 'Likely True';
      if (trustPercent >= 40) return 'Uncertain';
      return 'Disputed';
   };

   const getTrustBorderColor = () => {
      if (!votes || (votes.trueCount === 0 && votes.falseCount === 0)) {
         return 'border-gray-500/30';
      }
      if (trustPercent >= 70) return 'border-emerald-500/40';
      if (trustPercent >= 40) return 'border-amber-500/40';
      return 'border-rose-500/40';
   };

   return (
      <article
         className={`rounded-lg border ${getTrustBorderColor()} bg-[#0d0d14] p-5 hover:border-cyan-500/40 transition-colors`}
      >
         {/* Rumor Content */}
         <p className="text-cyan-100 leading-relaxed mb-4">{text}</p>

         {/* Trust Score Section */}
         <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs text-cyan-500/70">Trust Score</span>
               <span className={`text-xs font-medium ${trustPercent >= 70 ? 'text-emerald-400' :
                     trustPercent >= 40 ? 'text-amber-400' :
                        votes && (votes.trueCount > 0 || votes.falseCount > 0) ? 'text-rose-400' :
                           'text-gray-400'
                  }`}>
                  {getTrustLabel()} ({trustPercent}%)
               </span>
            </div>

            {/* Trust Score Progress Bar */}
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
               <div
                  className={`h-full ${getTrustColor()} transition-all duration-500`}
                  style={{ width: `${trustPercent}%` }}
               />
            </div>

            {/* Vote Counts */}
            {votes && (votes.trueCount > 0 || votes.falseCount > 0) && (
               <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400/70">
                     <CheckCircle className="w-3 h-3" />
                     {votes.trueCount} verified
                  </span>
                  <span className="flex items-center gap-1 text-rose-400/70">
                     <XCircle className="w-3 h-3" />
                     {votes.falseCount} disputed
                  </span>
               </div>
            )}
         </div>

         {/* Footer: Time + Voting Buttons */}
         <div className="flex items-center justify-between">
            <span className="text-xs text-cyan-500/70">
               {new Date(time).toLocaleTimeString()} · P2P
            </span>

            <div className="flex gap-2">
               {votes?.hasVoted ? (
                  <span className="px-3 py-1.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                     Already Voted
                  </span>
               ) : (
                  <>
                     <button
                        onClick={onVerify}
                        disabled={!isConnected || isVoting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                        {isVoting ? (
                           <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                           <CheckCircle className="w-3 h-3" />
                        )}
                        Verify
                     </button>
                     <button
                        onClick={onDispute}
                        disabled={!isConnected || isVoting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                     >
                        {isVoting ? (
                           <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                           <XCircle className="w-3 h-3" />
                        )}
                        Dispute
                     </button>
                  </>
               )}
            </div>
         </div>
      </article>
   );
}

export default RumorCard;
