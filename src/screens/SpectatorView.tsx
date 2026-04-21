import { motion } from 'motion/react';
import Card from '../components/Card';
import moedaImg from '../assets/moeda.svg';
import mesaImg  from '../assets/mesa.svg';
import styles from './Game.module.css';

interface SpectatorViewProps {
  spectatorData: any;
  onLeave: () => void;
}

export default function SpectatorView({ spectatorData, onLeave }: SpectatorViewProps) {
  if (!spectatorData) return null;

  const { game, queuePosition } = spectatorData;
  if (!game) return <div className={styles.loading}>Carregando jogo...</div>;

  const { players = [], currentPlayerId, log = [] } = game;

  return (
    <div className={styles.board}>
      {/* HUD Info */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <div className="bg-blue-600 px-4 py-2 rounded-full font-bold text-xs shadow-lg">
          👁️ VOCÊ ESTÁ ASSISTINDO (Fila: {queuePosition})
        </div>
        <button onClick={onLeave} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full font-bold text-xs transition-colors">
          ← Sair
        </button>
      </div>

      <div className={styles.center} style={{ width: '100%' }}>
        <div className={styles.opponents}>
          {players.map((p: any) => (
            <div key={p.id} className={`${styles.opponent} ${p.id === currentPlayerId ? styles.opponentActive : ''}`}>
              <div className={styles.opponentAvatar}>{p.name.charAt(0).toUpperCase()}</div>
              <div>
                <span className={styles.opponentName}>{p.name}</span>
                <div className={styles.opponentCoins}>
                  <img src={moedaImg} className={styles.coinIconSm} alt="" />
                  <span>{p.coins}</span>
                </div>
              </div>
              <div className={styles.opponentCards}>
                {p.cards.map((c: any, i: number) => (
                   <div key={i} className={`${styles.miniCard} ${c.dead ? styles.miniCardDead : ''}`}>
                     {c.dead ? '✕' : (c.character ? '?' : '🃏')}
                   </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.mesaWrapper}>
           <img src={mesaImg} className={styles.mesaImg} alt="mesa" />
           <p className="absolute bottom-10 opacity-30 text-xs italic">Modo Espectador</p>
        </div>
      </div>

      {/* Simplified Log */}
      <div className="w-80 border-l border-white/5 bg-neutral-900/50 p-4 flex flex-col gap-4">
        <p className={styles.panelLabel}>Acontecimentos</p>
        <div className="flex-1 overflow-y-auto text-[10px] opacity-50 space-y-2">
           {log.map((entry: string, i: number) => (
             <p key={i} className="border-l border-white/10 pl-2">{entry}</p>
           ))}
        </div>
      </div>
    </div>
  );
}
