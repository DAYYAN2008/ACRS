'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Lock, Unlock } from 'lucide-react';

interface FloatingDockProps {
   account: string | null;
   trustScore: number;
   onConnect: () => void;
   onPost: (text: string) => void;
   inputValue: string;
   onInputChange: (value: string) => void;
}

export default function FloatingDock({
   account,
   trustScore,
   onConnect,
   onPost,
   inputValue,
   onInputChange
}: FloatingDockProps) {
   const [isVisible, setIsVisible] = useState(true);
   const [lastScrollY, setLastScrollY] = useState(0);
   const [isExpanded, setIsExpanded] = useState(false);

   const handleScroll = useCallback(() => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
         setIsVisible(false);
         setIsExpanded(false);
      } else {
         setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
   }, [lastScrollY]);

   useEffect(() => {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
   }, [handleScroll]);

   return (
      <div className={`
      fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out
      ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'}
      w-[90%] max-w-lg
    `}>
         <div className={`
        relative glass-dark rounded-2xl border border-white/10 p-2 transition-all duration-500 shadow-2xl
        ${isExpanded ? 'h-40' : 'h-16'}
      `}>
            <div className="flex items-center gap-3 h-12 px-2">
               {/* Wallet / Trust Section */}
               <button
                  onClick={onConnect}
                  className={`
              flex items-center gap-2 px-4 h-10 rounded-xl transition-all
              ${account ? 'bg-accent-purple/20 border-accent-purple/30 text-accent-purple' : 'bg-white/5 border-white/10 text-text-secondary hover:bg-white/10'}
              border font-mono text-xs
            `}
               >
                  {account ? (
                     <>
                        <Lock size={14} className="animate-pulse-subtle" />
                        <span className="hidden sm:inline">SECURE: {trustScore}</span>
                        <span className="sm:hidden">{trustScore}</span>
                     </>
                  ) : (
                     <>
                        <Unlock size={14} />
                        <span>Connect</span>
                     </>
                  )}
               </button>

               {/* Quick Post / Expand Trigger */}
               <div className="flex-1 relative group">
                  <input
                     type="text"
                     placeholder="Broadcast rumor..."
                     value={inputValue}
                     onChange={(e) => onInputChange(e.target.value)}
                     onFocus={() => setIsExpanded(true)}
                     className="w-full h-10 bg-white/5 border border-white/5 rounded-xl px-4 text-xs focus:outline-none focus:border-accent-teal/50 transition-all"
                  />
               </div>

               <button
                  onClick={() => onPost(inputValue)}
                  disabled={!inputValue.trim()}
                  className={`
              w-10 h-10 flex items-center justify-center rounded-xl transition-all
              ${inputValue.trim() ? 'bg-accent-teal text-black shadow-lg shadow-accent-teal/20' : 'bg-white/5 text-text-secondary opacity-50'}
            `}
               >
                  <Send size={16} />
               </button>
            </div>

            {/* Expanded Content */}
            <div className={`
          mt-4 px-4 overflow-hidden transition-all duration-500
          ${isExpanded ? 'opacity-100 h-20' : 'opacity-0 h-0'}
        `}>
               <p className="text-[10px] text-text-secondary mb-2 font-mono uppercase tracking-widest">
                  Anonymous Broadcast · End-to-End Encrypted
               </p>
               <div className="flex justify-between items-center">
                  <span className="text-xs text-text-primary/70">
                     {account ? `Linked: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Gateway restricted'}
                  </span>
                  <button
                     onClick={() => setIsExpanded(false)}
                     className="text-[10px] text-accent-purple hover:underline"
                  >
                     Minimize
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
}
