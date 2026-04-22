import { motion, AnimatePresence } from 'framer-motion';
import { CHAR_CONFIG } from './charConfig';

export default function ActionOverlay({ action, active }) {
  if (!action) return null;

  const cfg = CHAR_CONFIG[action.claimedCharacter] || { icon: '⚡', label: action.label, color: '#ffd600' };
  
  const variants = {
    initial: { opacity: 0, scale: 0.5, y: 50, rotateX: 45 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      rotateX: 0,
      transition: { type: 'spring', stiffness: 400, damping: 25 } 
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      y: -50, 
      filter: 'blur(10px)',
      transition: { duration: 0.4 } 
    }
  };

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[1000] flex items-center justify-center p-4">
          <motion.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-neutral-900/90 border-2 border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-[0_32px_128px_rgba(0,0,0,0.8)] max-w-sm w-full text-center overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{ background: `radial-gradient(circle at center, ${cfg.color}, transparent)` }}
            />

            <div className="relative z-10">
              <motion.div 
                className="text-7xl mb-6 inline-block"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {action.icon || cfg.icon}
              </motion.div>

              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight uppercase">
                {action.label}
              </h2>
              
              <div className="flex flex-col gap-1 items-center justify-center mb-6">
                <span className="text-blue-400 font-bold text-xl">{action.actorName}</span>
                {action.targetName && (
                  <>
                    <span className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Ataca</span>
                    <span className="text-red-400 font-bold text-xl">{action.targetName}</span>
                  </>
                )}
              </div>

              {action.claimedCharacter && (
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm font-medium"
                  style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}
                >
                  <span className="text-lg">{cfg.icon}</span>
                  {cfg.label}
                </div>
              )}
            </div>

            {/* Cinematic bar animations */}
            <motion.div 
              className="absolute left-0 bottom-0 h-1 bg-yellow-400"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.5, ease: 'linear' }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
