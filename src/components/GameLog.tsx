import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './GameLog.module.css';

interface GameLogProps {
  log: string[];
}

export default function GameLog({ log }: GameLogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className={styles.log} ref={ref}>
      <AnimatePresence initial={false}>
        {log?.map((entry, i) => (
          <motion.p
            key={entry + i}
            className={styles.entry}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            {entry}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
