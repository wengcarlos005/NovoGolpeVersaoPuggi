import React from 'react';
import { motion } from 'motion/react';
import { CHAR_CONFIG } from './charConfig';
import styles from './Card.module.css';

interface CardProps {
  key?: number | string;
  character?: string;
  dead?: boolean;
  hidden?: boolean;
  onClick?: () => void;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Card({ character, dead = false, hidden = false, onClick, selected, size = 'md' }: CardProps) {
  const cfg = character ? (CHAR_CONFIG[character] || { label: character, color: '#333', icon: '?', img: null }) : { label: '', color: '#333', icon: '?', img: null };

  if (dead) {
    return (
      <motion.div
        className={`${styles.card} ${styles.dead} ${styles[size]}`}
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0.45, scale: 0.95, filter: 'grayscale(1)' }}
        transition={{ duration: 0.4 }}
      >
        <span className={styles.deadIcon}>✕</span>
        {character && <span className={styles.deadChar}>{cfg.label}</span>}
      </motion.div>
    );
  }

  if (hidden) {
    return (
      <motion.div
        className={`${styles.card} ${styles.hidden} ${styles[size]} ${selected ? styles.selected : ''}`}
        onClick={onClick}
        whileHover={{ y: -6, scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        animate={selected ? { y: -10 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className={styles.hiddenBack}>
          <span className={styles.hiddenIcon}>🃏</span>
          <span className={styles.hiddenLabel}>GOLPE</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${styles.card} ${styles[size]} ${selected ? styles.selected : ''}`}
      style={{ '--char-color': cfg.color } as React.CSSProperties}
      onClick={onClick}
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { y: -12 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      layout
    >
      {cfg.img
        ? <img src={cfg.img} alt={cfg.label} className={styles.cardImage} />
        : (
          <div className={styles.cardFallback}>
            <span className={styles.fallbackIcon}>{cfg.icon}</span>
            <span className={styles.fallbackName}>{cfg.label}</span>
          </div>
        )
      }
    </motion.div>
  );
}
