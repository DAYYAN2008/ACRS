'use client';

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
}
