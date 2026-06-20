import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLACEHOLDER_PROMPTS } from '@/lib/constants';

export function AnimatedPlaceholder({ visible }: { visible: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="absolute left-4 top-4 pointer-events-none select-none">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          className="text-sm text-adam-text-tertiary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {PLACEHOLDER_PROMPTS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
