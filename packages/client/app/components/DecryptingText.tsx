'use client';

import { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';

interface DecryptingTextProps {
   text: string;
   speed?: number;
   delay?: number;
   className?: string;
}

export default function DecryptingText({ text, speed = 40, delay = 0, className }: DecryptingTextProps) {
   const [displayText, setDisplayText] = useState('');
   const [isDecrypting, setIsDecrypting] = useState(true);

   useEffect(() => {
      let iteration = 0;
      let interval: NodeJS.Timeout;

      const startTimeout = setTimeout(() => {
         interval = setInterval(() => {
            setDisplayText((prev) =>
               text
                  .split('')
                  .map((char, index) => {
                     if (index < iteration) {
                        return text[index];
                     }
                     return CHARS[Math.floor(Math.random() * CHARS.length)];
                  })
                  .join('')
            );

            if (iteration >= text.length) {
               clearInterval(interval);
               setIsDecrypting(false);
               setDisplayText(text);
            }

            iteration += 1 / 3;
         }, speed);
      }, delay);

      return () => {
         clearTimeout(startTimeout);
         if (interval) clearInterval(interval);
      };
   }, [text, speed, delay]);

   return (
      <span className={`${className} ${isDecrypting ? 'animate-decrypt' : ''}`}>
         {displayText}
      </span>
   );
}
