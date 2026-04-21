import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import socket from '../socket';
import Card from '../components/Card';
import { CHAR_CONFIG } from '../components/charConfig';
import GameLog from '../components/GameLog';
import TurnCard from '../components/TurnCard';
import CardSelectorModal from '../components/CardSelectorModal';
import CharacterGuessModal from '../components/CharacterGuessModal';
import { useSoundEffects } from '../sounds/useSoundEffects';
import { sfx } from '../sounds/sfx';
import moedaImg from '../assets/moeda.svg';
import caraImg from '../assets/cara.svg';
import mesaImg  from '../assets/mesa.svg';
import styles from './Game.module.css';
import { X, LogOut, RotateCcw, Info } from 'lucide-react';

const ACTION_NAMES: Record<string, string> = {
  renda:'Trampo Suado', ajuda_externa:'Imposto é Roubo', golpe:'Golpe de Estado',
  taxar:'Faz o L', roubar:'Pegar o Arrego', assassinar:'Mandar pro Vasco',
  meter_x9:'Meter o X9', disfarce:'Disfarce', trocar_carta:'Troca de Cartas',
  veredito: 'Veredito',
};

const TARGET_ACTIONS = ['golpe','roubar','assassinar','meter_x9','trocar_carta', 'veredito'];

const BLOCK_OPTIONS: Record<string, string[]> = {
  ajuda_externa:['politico'], roubar:['juiz','guarda_costas'],
  assassinar:['guarda_costas'], meter_x9:['juiz'], disfarce:['juiz'], trocar_carta:['juiz'],
};

const ACTION_TO_CHAR: Record<string, string> = {
  taxar:'politico', roubar:'empresario',
  assassinar:'assassino',
  meter_x9:'investigador', disfarce:'investigador', trocar_carta:'investigador',
  veredito: 'juiz',
};

const ACTION_CATEGORIES = [
  {
    id: 'basicas', label: '⚡ Básicas', labelColor: 'var(--muted)', bg: 'transparent',
    actions: [
      { action:'renda',         icon:'💵', label:'Trampo Suado',    sub:'+1 moeda',           tooltip:'Pega 1 moeda do banco. Não pode ser bloqueada nem duvidada.' },
      { action:'ajuda_externa', icon:'💸', label:'Imposto é Roubo', sub:'+2 moedas',           tooltip:'Pega 2 moedas. Qualquer um pode bloquear.' },
      { action:'golpe',         icon:'💥', label:'Golpe de Estado',  sub:'7💰 · alvo obrig.',  tooltip:'Gasta 7 moedas e elimina uma carta do alvo. Sem bloqueio nem duvidada.' },
    ],
  },
  {
    id: 'monetarias', label: '💰 Monetárias', labelColor: '#ffd600', bg: 'rgba(255,214,0,0.04)',
    actions: [
      { action:'taxar',  icon:'🏛️', label:'Faz o L',        sub:'+3 moedas · Político', tooltip:'Afirma ser o Político. Pega 3 moedas. Qualquer um pode duvidar.' },
      { action:'roubar', icon:'💼', label:'Pegar o Arrego', sub:'Rouba 2 · Bicheiro',    tooltip:'Afirma ser o Bicheiro. Rouba 2 moedas do alvo.' },
    ],
  },
  {
    id: 'defesa', label: '🛡️ Defesa', labelColor: '#64b5f6', bg: 'rgba(41,121,255,0.04)',
    actions: [
      { action:'disfarce', icon:'🎭', label:'Disfarce', sub:'Troca carta · X9', tooltip:'Afirma ser o X9. Troca uma de suas cartas pelo baralho.' },
    ],
  },
  {
    id: 'ataque', label: '⚔️ Ataque', labelColor: '#ef5350', bg: 'rgba(244,67,54,0.04)',
    actions: [
      { action:'assassinar',   icon:'🔫', label:'Mandar pro Vasco', sub:'Elimina · Bandido · 3💰', tooltip:'Gasta 3 moedas e elimina carta do alvo.' },
      { action:'meter_x9',     icon:'🕵️', label:'Meter o X9',       sub:'Espia · X9',              tooltip:'Vê uma carta secreta do alvo.' },
      { action:'trocar_carta', icon:'🔄', label:'Troca de Cartas',   sub:'Força troca · X9',        tooltip:'Força o alvo a trocar uma carta pelo baralho.' },
      { action:'veredito',     icon:'⚖️', label:'Veredito',        sub:'Adivinha · Juiz · 6💰',   tooltip:'Se acertar a carta do alvo, ele a perde! Custa 6 moedas.' },
    ],
  },
];

export default function Game({ data, myId, onQuit }: { data: any, myId: string, onQuit: () => void }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<any>(null);
  const [blockChar,      setBlockChar]      = useState<string | null>(null);
  const [error,          setError]          = useState('');
  const [showHelp,       setShowHelp]       = useState(false);
  const [guessChar,      setGuessChar]      = useState<string | null>(null);
  const [isGuessing,     setIsGuessing]     = useState(false);

  const game = data?.game;
  const { players = [], currentPlayerId, phase, pendingAction: pa, log = [], winner } = game || {};
  const isHost = data?.hostId === myId;

  useSoundEffects(game, myId);

  useEffect(() => {
    setPendingConfirm(null);
    setBlockChar(null);
    setError('');
  }, [phase]);

  if (!game) return <div className={styles.loading}>Carregando...</div>;

  const me       = players.find((p: any) => p.id === myId);
  const others   = players.filter((p: any) => p.id !== myId);
  const isMyTurn = currentPlayerId === myId;
  const myCoins  = me?.coins ?? 0;

  function emit(event: string, payload: any, cb?: (res?: any) => void) {
    setError('');
    socket.emit(event, payload ?? {}, (res: any) => {
      if (res && !res.success) setError(res.error || 'Erro desconhecido');
      cb?.(res);
    });
  }

  const handleQuit = () => {
    if (confirm('Deseja realmente sair da sala? Suas cartas serão perdidas.')) {
      emit('leave_room', {}, () => {
        onQuit();
      });
    }
  };

  const handleRestart = () => {
    if (confirm('Deseja reiniciar a partida? Todo o progresso atual será perdido.')) {
      emit('restart_game', {}, (res: any) => {
        if (res && !res.success) {
          alert('Erro ao reiniciar: ' + (res.error || 'Erro desconhecido'));
        }
      });
    }
  };

  const stageAction = (action: string, charKey: string | null) => {
    if (TARGET_ACTIONS.includes(action)) {
      if (!selectedTarget) {
        setPendingConfirm({ action, charKey, targetId: null });
        setError('Escolha um alvo clicando em um jogador acima ⬆');
        return;
      }
    }
    
    if (action === 'veredito') {
      setIsGuessing(true);
      return;
    }
    
    sfx.cardFlip();
    setPendingConfirm({ action, charKey, targetId: selectedTarget });
    setError('');
  };

  const handleGuess = (char: string) => {
    setIsGuessing(false);
    setGuessChar(char);
    sfx.cardFlip();
    setPendingConfirm({ action: 'veredito', charKey: 'juiz', targetId: selectedTarget });
  };

  const confirmAction = () => {
    if (!pendingConfirm) return;
    sfx.action();
    emit('take_action', { 
      action: pendingConfirm.action, 
      targetId: pendingConfirm.targetId,
      guessedChar: guessChar 
    }, () => {
      setSelectedTarget(null);
      setPendingConfirm(null);
      setGuessChar(null);
    });
  };

  const cancelConfirm = () => {
    setPendingConfirm(null);
    setSelectedTarget(null);
    setError('');
  };

  const iAmActor         = pa?.actorId === myId;
  const iAmTarget        = pa?.targetId === myId;
  const alreadyResponded = pa?.respondedPlayers?.includes(myId);
  const iAmInLoseQueue   = pa?.loseInfluenceQueue?.[0]?.playerId === myId;
  const iAmSwapPlayer    = pa?.swapPlayerId === myId;

  const canAct            = isMyTurn && phase === 'ACTION_SELECT' && me?.alive;
  const canRespond        = phase === 'RESPONSE_WINDOW' && !iAmActor && !alreadyResponded && me?.alive;
  const mustGamble        = phase === 'GAMBLE_WAIT' && pa?.blocker?.playerId === myId;
  const isTargetedAction  = TARGET_ACTIONS.includes(pa?.type);
  const canChallengeAct   = canRespond && !!pa?.claimedCharacter;
  const canBlockAct       = canRespond && (pa?.type === 'ajuda_externa' ? true : iAmTarget);
  const canChallengeBlock = phase === 'BLOCK_CHALLENGE_WINDOW' && iAmActor;

  const mustLoseInfluence   = phase === 'LOSE_INFLUENCE'   && iAmInLoseQueue;
  const mustShowCard        = phase === 'X9_PEEK_SELECT'   && iAmTarget;
  const mustAcknowledgePeek = phase === 'X9_PEEK_VIEW'    && iAmActor;
  const mustSwapCard        = phase === 'CARD_SWAP_SELECT' && iAmSwapPlayer;

  const blockOptions = pa ? (BLOCK_OPTIONS[pa.type] || []) : [];
  const actorName    = pa ? players.find((p: any) => p.id === pa.actorId)?.name  : null;
  const targetName   = pa?.targetId ? players.find((p: any) => p.id === pa.targetId)?.name : null;
  const blockerName  = pa?.blocker  ? players.find((p: any) => p.id === pa.blocker.playerId)?.name : null;

  const activeChar = pendingConfirm?.charKey ?? null;

  if (winner) {
    const w = players.find((p: any) => p.id === winner);
    return (
      <div className={styles.board}>
        <div className={styles.leftPanel}>
          <TurnCard player={players.find((p: any)=>p.id===currentPlayerId)} isMe={isMyTurn} />
          <p className={styles.panelLabel}>Chat da Rodada</p>
          <GameLog log={log} />
        </div>

        <div className={styles.center}>
           <div className={styles.mesaWrapper}>
             <motion.div className={styles.gameOverOverlay} initial={{ opacity:0 }} animate={{ opacity:1 }}>
                <motion.div className={styles.gameOverCard}
                  initial={{ scale:0.7, y:40 }} animate={{ scale:1, y:0 }}
                  transition={{ type:'spring', stiffness:200, damping:18 }}>
                  <h1 className="text-4xl font-black mb-2 text-yellow-500 tracking-tighter">VITÓRIA! 🇧🇷</h1>
                  <p className={styles.winnerName}>{w?.name} é o novo dono do Brasil!</p>
                  
                  <div className="flex flex-col gap-3 w-full mt-6">
                    <motion.button className="bg-yellow-500 text-black py-4 rounded-xl font-bold text-lg shadow-[0_10px_20px_-10px_rgba(255,214,0,0.5)]" 
                      whileTap={{ scale:0.95 }}
                      onClick={() => socket.emit('restart_game', {})}>
                      REINICIAR PARTIDA
                    </motion.button>
                    <button className="text-white/40 text-sm hover:text-white transition-colors" onClick={onQuit}>
                       SAIR PARA O LOBBY
                    </button>
                  </div>
                </motion.div>
             </motion.div>
             <img src={mesaImg} className={styles.mesaImg} alt="mesa" />
           </div>
        </div>

        <div className={styles.rightPanel}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">RESUMO FINAL</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {players.map((p: any) => (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg bg-white/5 ${p.id===winner?'ring-1 ring-yellow-500/50':''}`}>
                   <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold">
                      {p.name.charAt(0)}
                   </div>
                   <div className="flex-1">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className={`text-[10px] uppercase font-black ${p.alive?'text-emerald-500':'text-red-500'}`}>
                        {p.alive ? 'SOBREVIVENTE' : 'ELIMINADO'}
                      </p>
                   </div>
                   {p.id === winner && <span className="text-2xl">🏆</span>}
                </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.board}>
      {isGuessing && (
        <CharacterGuessModal 
          onConfirm={handleGuess}
          onCancel={() => setIsGuessing(false)}
        />
      )}
      {mustLoseInfluence && (
        <CardSelectorModal context="lose" title="Perdeu, mané 💀"
          description="Você deve perder uma carta. Escolha qual revelar para a mesa."
          cards={me?.cards||[]} confirmLabel="Perder"
          onConfirm={i => emit('lose_influence',{cardIndex:i})} />
      )}
      {mustShowCard && (
        <CardSelectorModal context="show" title="O X9 tá de olho 👀"
          description={`${actorName} meteu o X9 em você. Escolha uma carta para mostrar APENAS a ele.`}
          cards={me?.cards||[]} confirmLabel="Mostrar"
          onConfirm={i => emit('select_card_show',{cardIndex:i})} />
      )}
      {mustSwapCard && (
        <CardSelectorModal context="swap"
          title={pa?.swapContext==='disfarce'?'Hora do Disfarce 🎭':'Troca Forçada 🔄'}
          description={pa?.swapContext==='disfarce'
            ?'Escolha uma carta para trocar pelo baralho.'
            :`${actorName} forçou uma troca. Escolha qual carta trocar.`}
          cards={me?.cards||[]} confirmLabel="Trocar"
          onConfirm={i => emit('select_card_swap',{cardIndex:i})} />
      )}

      <div className={styles.leftPanel}>
        <TurnCard player={players.find((p: any)=>p.id===currentPlayerId)} isMe={isMyTurn} />
        <p className={styles.panelLabel}>Chat da Rodada</p>
        <GameLog log={log} />
        
        {/* Session Actions */}
        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
           {isHost && (
             <button onClick={handleRestart} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-yellow-500 transition-colors">
               <RotateCcw size={14} /> Reiniciar Partida
             </button>
           )}
           <button onClick={handleQuit} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-red-500 transition-colors">
             <LogOut size={14} /> Sair da Sala
           </button>
        </div>
      </div>

      <div className={styles.center}>
        <div className={styles.opponents}>
          {others.map((p: any) => (
            <motion.div key={p.id}
              className={`${styles.opponent}
                ${p.id===currentPlayerId?styles.opponentActive:''}
                ${!p.alive?styles.opponentDead:''}
                ${selectedTarget===p.id?styles.opponentTargeted:''}
              `}
              whileHover={canAct&&p.alive?{scale:1.03,y:-2}:{}}
              whileTap={canAct&&p.alive?{scale:0.97}:{}}
              onClick={()=>canAct&&p.alive&&setSelectedTarget(prev=>prev===p.id?null:p.id)}>
              <div className={styles.opponentAvatar}>{p.name.charAt(0).toUpperCase()}</div>
              <div className={styles.opponentInfo}>
                <span className={styles.opponentName}>{p.name}</span>
                <div className={styles.opponentCoins}>
                  <img src={moedaImg} className={styles.coinIconSm} alt="" />
                  <span>{p.coins}</span>
                </div>
              </div>
              <div className={styles.opponentCards}>
                {p.cards.map((c: any,i: number)=>(
                  <div key={i} className={`${styles.miniCard} ${c.dead?styles.miniCardDead:''}`}>
                    {c.dead?'✕':c.character?CHAR_CONFIG[c.character]?.icon:'🃏'}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className={styles.mesaWrapper}>
          <AnimatePresence mode="wait">
            {phase==='ACTION_SELECT'&&(
              <motion.div key="sel" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                {isMyTurn
                  ?<span className={styles.mesaStatusMain} style={{color:'var(--yellow)'}}>✦ SUA VEZ — escolha uma ação</span>
                  :<span className={styles.mesaStatusMain}>{players.find((p: any)=>p.id===currentPlayerId)?.name} está pensando...</span>
                }
              </motion.div>
            )}
            {(phase==='RESPONSE_WINDOW'||phase==='BLOCK_CHALLENGE_WINDOW' || phase === 'GAMBLE_WAIT' || phase === 'GAMBLE_FLIPPING')&&pa&&(
              <motion.div key="resp" className={styles.mesaStatus}
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
                {phase === 'GAMBLE_WAIT' ? (
                  <div className="flex flex-col items-center gap-4">
                    <span className={styles.mesaStatusMain} style={{color:'var(--yellow)'}}>
                      🪙 {pa.blocker?.playerId === myId ? 'Sua vez de lançar a moeda!' : `Esperando ${players.find((p:any)=>p.id===pa.blocker?.playerId)?.name} lançar a moeda...`}
                    </span>
                    {pa.blocker?.playerId === myId && (
                      <motion.button 
                        className="bg-yellow-500 text-black px-8 py-4 rounded-full font-black text-xl shadow-[0_0_30px_rgba(255,214,0,0.4)] uppercase tracking-tighter"
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => emit('toss_coin', {})}>
                        🎲 LANÇAR AGORA!
                      </motion.button>
                    )}
                  </div>
                ) : phase === 'GAMBLE_FLIPPING' ? (
                  <div className={styles.coinAnimation}>
                     <motion.div
                       animate={{ 
                         rotateY: [0, 1800],
                         scale: [1, 1.2, 1],
                         y: [0, -40, 0]
                       }} 
                       transition={{ duration: 3, ease: "easeInOut" }}>
                       <img src={moedaImg} className={styles.flippingCoin} alt="coin" />
                     </motion.div>
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 3, type: 'spring' }}
                        className={styles.coinResult}>
                        <img src={pa.gambleResult === 'heads' ? caraImg : moedaImg} className={styles.coinSideLarge} alt="result" />
                        <span className={styles.mesaStatusMain} style={{ color: 'var(--yellow)', fontSize: '2rem' }}>
                           {pa.gambleResult === 'heads' ? '🎲 CARA!' : '🎰 COROA!'}
                        </span>
                     </motion.div>
                  </div>
                ) : (
                  <>
                    <span className={styles.mesaStatusIcon}>{pa.claimedCharacter?CHAR_CONFIG[pa.claimedCharacter]?.icon:'⚡'}</span>
                    <span className={styles.mesaStatusMain}>{ACTION_NAMES[pa.type]}</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.img src={mesaImg} className={styles.mesaImg} alt="mesa" />
        </div>

        <div className={styles.myArea}>
          <div className={styles.coinSide}>
            <img src={moedaImg} className={styles.coinIcon} alt="moeda" />
            <span className={styles.coinNum}>{myCoins}</span>
          </div>
          <div className={styles.myCards}>
            {me?.cards.map((c: any,i: number)=><Card key={i} character={c.character} dead={c.dead} size="xl"/>)}
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.actionsTop}>
          {mustAcknowledgePeek&&pa?.x9Result&&(
            <motion.div className={styles.x9Result} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
              <p className={styles.x9ResultTitle}>🕵️ Carta de <strong>{targetName}</strong>:</p>
              <div className={styles.x9ResultCard}>
                <span>{CHAR_CONFIG[pa.x9Result.character]?.icon}</span>
                <strong>{CHAR_CONFIG[pa.x9Result.character]?.label}</strong>
              </div>
              <button className={styles.x9AckBtn} onClick={()=>emit('acknowledge_peek',{})}>
                Ok, guardei no coração 🤫
              </button>
            </motion.div>
          )}

          <AnimatePresence>
            {canAct&&pendingConfirm&&(
              <motion.div className={styles.confirmBox}
                initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}}
                exit={{opacity:0,scale:0.97}}>
                <p className={styles.confirmTitle}>Confirmar ação?</p>
                <p className={styles.confirmAction}>{ACTION_NAMES[pendingConfirm.action]}</p>
                <div className={styles.confirmBtns}>
                  <button className={styles.confirmYes} onClick={confirmAction}>✓ Confirmar</button>
                  <button className={styles.confirmNo} onClick={cancelConfirm}>✕ Cancelar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {canAct&&!pendingConfirm&&(
            <>
              {ACTION_CATEGORIES.map((cat)=>{
                const mustGolpe = myCoins>=10;
                return (
                  <div key={cat.id} className={styles.catSection} style={{'--cat-bg':cat.bg} as React.CSSProperties}>
                    <span className={styles.catLabel} style={{color:cat.labelColor}}>{cat.label}</span>
                    {cat.actions.map(({action,icon,label,sub,tooltip})=>{
                      const isDisabled = (action!=='golpe'&&mustGolpe) || 
                                       (action==='golpe'&&myCoins<7) || 
                                       (action==='assassinar'&&myCoins<3) ||
                                       (action==='veredito'&&myCoins<6);
                      return <Btn key={action} icon={icon} label={label} sub={sub} tooltip={tooltip} disabled={isDisabled} onClick={()=>stageAction(action, ACTION_TO_CHAR[action]??null)} />;
                    })}
                  </div>
                );
              })}
            </>
          )}

          {(canRespond || mustGamble) && (
            <motion.div className={styles.responseBox}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
              {pa?.type === 'veredito' && pa?.guessedCharacter ? (
                <div className={styles.accAnnouncement}>
                  <div className={styles.accIcon}>⚖️</div>
                  <div className={styles.accContent}>
                    <p className={styles.accTitle}>Veredito do Juiz</p>
                    <p className={styles.accText}>
                      <strong>{actorName}</strong> condenou <strong>{targetName}</strong>! <br/>
                      Dizendo que ele possui um <strong>{CHAR_CONFIG[pa.guessedCharacter]?.label}</strong>
                    </p>
                  </div>
                </div>
              ) : (
                <p className={styles.responseTitle}>
                  <strong>{actorName}</strong> declara <strong>{ACTION_NAMES[pa?.type]}</strong>
                </p>
              )}
              {canChallengeAct&&(
                <Btn icon="⚔️" label="DUVIDAR" sub="chamar o VAR!" danger onClick={()=>{sfx.challenge();emit('challenge',{});}} />
              )}
              {canBlockAct&&blockOptions.map((char: string)=>(
                <Btn key={char} icon={CHAR_CONFIG[char]?.icon} label={`Bloquear como ${CHAR_CONFIG[char]?.label}`} sub="clique para selecionar" selected={blockChar===char} onClick={()=>setBlockChar(p=>p===char?null:char)} />
              ))}
              {blockChar&&(
                <Btn icon="🛡️" label="Confirmar Bloqueio" sub={`como ${CHAR_CONFIG[blockChar]?.label}`} success onClick={()=>{sfx.block();emit('block',{character:blockChar},()=>setBlockChar(null));}} />
              )}
              <Btn icon="✅" label="Ignorar" sub="deixar acontecer" onClick={()=>emit('pass',{})} />
            </motion.div>
          )}

          {canChallengeBlock&&(
            <motion.div className={styles.responseBox} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
              <p className={styles.responseTitle}><strong>{blockerName}</strong> bloqueou</p>
              <Btn icon="⚔️" label="Duvidar do Bloqueio" sub="chama o VAR!" danger onClick={()=>{sfx.challenge();emit('challenge',{});}} />
              <Btn icon="✅" label="Aceitar Bloqueio" sub="desistir da jogada" onClick={()=>emit('pass',{})} />
            </motion.div>
          )}
        </div>

        <div className={styles.charSection}>
          <p className={styles.panelLabel}>Personagens</p>
          <div className={styles.charGrid}>
            {Object.entries(CHAR_CONFIG).map(([charKey,cfg])=>{
              const isMine   = me?.cards.some((c:any)=>!c.dead&&c.character===charKey);
              const isActive = canAct&&charKey===activeChar;
              return (
                <div key={charKey} className={`${styles.charCard} ${isMine?styles.charCardMine:''} ${isActive?styles.charCardSelected:''}`}>
                  {cfg.img ? <img src={cfg.img} alt={cfg.label} className={styles.charCardImg}/> : <div className={styles.charCardFallback}><span>{cfg.icon}</span></div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showHelp&&(
          <motion.div className={styles.helpOverlay} 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={()=>setShowHelp(false)}>
            <motion.div className={styles.helpModal} 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-[Bebas_Neue] tracking-wide">Guia de Personagens</h2>
                <button onClick={() => setShowHelp(false)} className="text-white/20 hover:text-white transition-colors">
                  <X />
                </button>
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(CHAR_CONFIG).map(([key,cfg])=>(
                  <div key={key} className="bg-white/5 border border-white/5 p-3 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                       {cfg.img ? <img src={cfg.img} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full text-2xl">{cfg.icon}</span>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.icon}</span>
                        <strong className="text-white uppercase tracking-wider">{cfg.label}</strong>
                      </div>
                      <p className="text-xs text-white/50 mt-1">{cfg.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-primary w-full mt-8" onClick={()=>setShowHelp(false)}>Entendi</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className={styles.helpBtn} onClick={()=>setShowHelp(!showHelp)}>
        <Info size={18} />
      </button>
    </div>
  );
}

function Btn({ icon, label, sub, onClick, disabled, danger, success, selected, tooltip }: any) {
  return (
    <motion.button
      className={`${styles.actionBtn} ${danger?styles.actionBtnDanger:''} ${success?styles.actionBtnSuccess:''} ${selected?styles.actionBtnSelected:''}`}
      disabled={disabled}
      onClick={onClick}
      data-tooltip={tooltip}
      whileHover={!disabled?{scale:1.02}:{}}
      whileTap={!disabled?{scale:0.96}:{}}>
      <span className={styles.actionIcon}>{icon}</span>
      <div className="text-left"><strong>{label}</strong><small className="block text-[9px] opacity-50">{sub}</small></div>
    </motion.button>
  );
}
