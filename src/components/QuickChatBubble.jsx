import { motion } from 'framer-motion';

/**
 * QuickChatBubble — bolha de zoeira sobre o card do jogador
 * Props:
 *   message: string
 *   mine: boolean   — true se for o próprio jogador
 */
export default function QuickChatBubble({ message }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        left: '50%',
        x: '-50%',
        background: 'white',
        color: '#111',
        borderRadius: 16,
        padding: '6px 14px',
        fontSize: '0.85rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        zIndex: 100,
        textAlign: 'center',
        border: '3px solid #111',
      }}
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      {message}
      {/* Triangle pointer */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid #111',
        }}
      />
    </motion.div>
  );
}
