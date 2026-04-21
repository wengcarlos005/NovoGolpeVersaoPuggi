import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CHAR_CONFIG } from './charConfig';
import styles from './CardSelectorModal.module.css';

interface CharacterGuessModalProps {
  onConfirm: (characterKey: string) => void;
  onCancel: () => void;
}

export default function CharacterGuessModal({ onConfirm, onCancel }: CharacterGuessModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const charKeys = Object.keys(CHAR_CONFIG);

  return (
    <motion.div className={styles.overlay}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className={`${styles.modal} ${styles.veredito}`}
        initial={{ scale: 0.88, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}>

        <div className={styles.header}>
          <div className={styles.contextIcon}>⚖️</div>
          <div>
            <h3 className={styles.title}>Veredito do Juiz</h3>
            <p className={styles.desc}>Qual carta você acha que o seu alvo tem?</p>
          </div>
        </div>

        <div className={styles.cards}>
          {charKeys.map(key => {
            const cfg = CHAR_CONFIG[key];
            const isSelected = selected === key;
            return (
              <motion.div
                key={key}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                style={{ '--char-color': cfg.color || '#333' } as React.CSSProperties}
                onClick={() => setSelected(key)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              >
                {cfg.img
                  ? <img src={cfg.img} alt={cfg.label} className={styles.cardImg} />
                  : (
                    <>
                      <span className={styles.cardIcon}>{cfg.icon}</span>
                      <div className={styles.cardFooter}>
                        <span className={styles.cardName}>{cfg.label}</span>
                      </div>
                    </>
                  )
                }
              </motion.div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            className={styles.confirmBtn}
            style={{ backgroundColor: '#666', flex: 1 }}
            onClick={onCancel}
            whileTap={{ scale: 0.96 }}
          >
            Cancelar
          </motion.button>
          <motion.button
            className={styles.confirmBtn}
            disabled={selected === null}
            onClick={() => selected !== null && onConfirm(selected)}
            whileTap={{ scale: 0.96 }}
            style={{ flex: 2 }}
          >
            {selected ? `Condenar como ${CHAR_CONFIG[selected].label}` : 'Selecione um personagem'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
