import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './Landing.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export default function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className={styles.page}>
      <motion.nav
        className={styles.nav}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className={styles.navLogo}>GOLPE</span>
        <div className={styles.navLinks}>
          <button className={styles.navPlay} onClick={onEnter}>Jogar agora</button>
        </div>
      </motion.nav>

      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <motion.div
          className={styles.heroContent}
          initial="hidden"
          animate="show"
        >
          <motion.h1 className={styles.heroTitle} variants={fadeUp}>
            GOLPE
          </motion.h1>

          <motion.p className={styles.heroSub} variants={fadeUp}>
            Blefe. Poder. Traição.
          </motion.p>

          <motion.div className={styles.heroCtas} variants={fadeUp}>
            <motion.button
              className={styles.ctaPrimary}
              onClick={onEnter}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Jogar agora
            </motion.button>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
