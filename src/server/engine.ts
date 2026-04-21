import { shuffle } from './deck.ts';
import { ACTION_DEFS, ACTION_NAMES, CHARACTER_NAMES, getBlockers } from './actions.ts';
import { Room, GameState, Player, PendingAction } from './types.ts';

const FUNNY: Record<string, Function> = {
  renda:        (a: string)    => `${a} foi no trampo suado e ganhou 1 real 😤`,
  ajuda_externa:(a: string)    => `${a} declarou que imposto é roubo e pegou mais 2 moedas 💸`,
  golpe:        (a: string, t: string) => `${a} deu o Golpe em ${t}! O Brasil não é pra amadores 🪖`,
  taxar:        (a: string)    => `${a} fez o L na galera e taxou 3 moedas do banco 🤙`,
  roubar:       (a: string, t: string) => `${a} tá querendo demais e tentou Pegar o Arrego de ${t}! 🤑`,
  assassinar:   (a: string, t: string) => `${a} mandou ${t} pro Vasco! F no chat ⚰️`,
  meter_x9:     (a: string, t: string) => `${a} meteu o X9 em ${t}! Cê tá sendo investigado 👀`,
  disfarce:     (a: string)    => `${a} botou o disfarce! Mas será que alguém acredita? 🎭`,
  trocar_carta: (a: string, t: string) => `${a} forçou ${t} a trocar uma carta! Não é justo, mas é o Golpe 🔄`,
  challenge_success: (c: string, a: string) => `${c} DUVIDOU e acertou! ${a} tava blefando igual político em campanha 🤥 O clima esquentou, chamem o VAR!`,
  challenge_fail:    (c: string, a: string) => `${c} DUVIDOU e se deu mal! ${a} tinha a carta mesmo. Passou vergonha na mesa 😳`,
  block:             (b: string, act: string) => `${b} bloqueou a jogada! Ninguém passa fácil aqui 🛡️`,
  block_accepted:    (a: string)    => `${a} aceitou o bloqueio. Covardia? Estratégia? 🤷`,
  block_challenge_success: (c: string, b: string) => `${c} descobriu o blefe de ${b}! Tá tudo gravado, brother 📹`,
  block_challenge_fail:    (c: string, b: string) => `${c} duvidou do bloqueio e se arrependeu. ${b} tinha mesmo 😎`,
  lose_influence: (p: string, ch: string)  => `${p} perdeu ${ch}. F no chat ⚰️`,
  eliminated:     (p: string)      => `${p} tá eliminado! Foi pro Vasco definitivamente 👋`,
  turn_start:     (p: string)      => `--- Vez de ${p}. Bora ver o que essa pessoa vai aprontar... 🤔`,
  game_start:     ()       => `🇧🇷 PARTIDA INICIADA! Que vença o mais safado. Boa sorte pra ninguém.`,
  x9_show:        (t: string)      => `${t} selecionou uma carta para mostrar. O X9 vai ver... 🕵️`,
  x9_swap_done:   (p: string)      => `${p} trocou uma carta. Será que melhorou? 🎴`,
  veredito:       (a: string, t: string, g: string) => `${a} deu o Veredito em ${t}: "Você tem um ${g}!" ⚖️`,
  veredito_win:   (a: string, t: string) => `O Juiz acertou! ${t} foi condenado e perdeu a carta. 🔨`,
  veredito_lose:  (a: string) => `O Juiz errou feio! Perdeu as moedas e a moral. 💸`,
  bicheiro_heads: (b: string) => `Deu CARA! ${b} bloqueou com sucesso e o Bicheiro devolveu a moeda. 🪙`,
  bicheiro_tails: (b: string) => `Deu COROA! O Bicheiro cancelou o bloqueio e embolsou a moeda. 🎰`,
};

function log(game: GameState, msg: string) {
  game.log.push(msg);
  if (game.log.length > 100) game.log.shift();
}

function getAlivePlayers(game: GameState) {
  return game.players.filter(p => p.cards.some(c => !c.dead));
}

function getPlayer(game: GameState, id: string): Player {
  return game.players.find(p => p.id === id)!;
}

function checkGameOver(game: GameState) {
  const alive = getAlivePlayers(game);
  if (alive.length === 1) {
    game.winner = alive[0].id;
    game.phase = 'GAME_OVER';
    log(game, `🏆 ${alive[0].name} venceu o Golpe! Parabéns ao mais safado 🇧🇷`);
    return true;
  }
  return false;
}

function advanceTurn(game: GameState) {
  if (checkGameOver(game)) return;
  const alive = getAlivePlayers(game);
  
  // If the current player is no longer in the alive list (eliminated just now),
  // finding their index will return -1.
  // We want to find the next player starting from the current player id.
  
  const allPlayers = game.players;
  let currIdxInAll = allPlayers.findIndex(p => p.id === game.currentPlayerId);
  
  // Look for the next player who is alive
  let nextIdx = (currIdxInAll + 1) % allPlayers.length;
  while (!allPlayers[nextIdx].cards.some(c => !c.dead)) {
    nextIdx = (nextIdx + 1) % allPlayers.length;
    // Safety break, though checkGameOver should prevent infinity
    if (nextIdx === currIdxInAll) break;
  }
  
  const next = allPlayers[nextIdx];
  game.currentPlayerId = next.id;
  game.phase = 'ACTION_SELECT';
  game.pendingAction = null;
  log(game, FUNNY.turn_start(next.name));
}

function checkResponseWindowComplete(game: GameState) {
  const pa = game.pendingAction!;
  const eligible = getAlivePlayers(game).filter(p => p.id !== pa.actorId);
  return eligible.every(p => pa.respondedPlayers.includes(p.id));
}

function resolveActionEffect(game: GameState) {
  const pa = game.pendingAction!;
  const { type, actorId, targetId } = pa;
  const actor = getPlayer(game, actorId);

  switch (type) {
    case 'renda':
      actor.coins += 1;
      log(game, FUNNY.renda(actor.name));
      log(game, `💰 ${actor.name} agora tem ${actor.coins} moedas.`);
      break;

    case 'ajuda_externa':
      actor.coins += 2;
      log(game, FUNNY.ajuda_externa(actor.name));
      log(game, `💰 ${actor.name} agora tem ${actor.coins} moedas.`);
      break;

    case 'taxar':
      actor.coins += 3;
      log(game, FUNNY.taxar(actor.name));
      log(game, `💰 ${actor.name} agora tem ${actor.coins} moedas.`);
      break;

    case 'roubar': {
      const target = getPlayer(game, targetId!);
      const stolen = Math.min(2, target.coins);
      target.coins -= stolen;
      actor.coins += stolen;
      log(game, FUNNY.roubar(actor.name, target.name) + ` (${stolen} moeda${stolen !== 1 ? 's' : ''})`);
      log(game, `💰 ${actor.name}: ${actor.coins} moedas | ${target.name}: ${target.coins} moedas.`);
      break;
    }

    case 'golpe':
    case 'assassinar': {
      const target = getPlayer(game, targetId!);
      if (type === 'golpe') log(game, FUNNY.golpe(actor.name, target.name));
      else log(game, FUNNY.assassinar(actor.name, target.name));
      pa.loseInfluenceQueue.push({ playerId: targetId! });
      game.phase = 'LOSE_INFLUENCE';
      return;
    }

    case 'meter_x9': {
      const target = getPlayer(game, targetId!);
      log(game, FUNNY.meter_x9(actor.name, target.name));
      game.phase = 'X9_PEEK_SELECT';
      return;
    }

    case 'disfarce': {
      log(game, FUNNY.disfarce(actor.name));
      pa.swapPlayerId = actorId;
      pa.swapContext = 'disfarce';
      game.phase = 'CARD_SWAP_SELECT';
      return;
    }

    case 'veredito': {
      const target = getPlayer(game, targetId!);
      const guess = pa.guessedCharacter!;
      log(game, FUNNY.veredito(actor.name, target.name, CHARACTER_NAMES[guess]));
      
      const cardIdx = target.cards.findIndex(c => !c.dead && c.character === guess);
      if (cardIdx !== -1) {
        log(game, FUNNY.veredito_win(actor.name, target.name));
        target.cards[cardIdx].dead = true;
        log(game, FUNNY.lose_influence(target.name, CHARACTER_NAMES[guess]));
        
        if (checkGameOver(game)) return;
      } else {
        log(game, FUNNY.veredito_lose(actor.name));
      }
      break;
    }
  }
  advanceTurn(game);
}

export function handleAction(room: Room, actorId: string, actionType: string, targetId?: string, guessedChar?: string) {
  const game = room.game!;
  if (game.phase !== 'ACTION_SELECT') return { success: false, error: 'Fase incorreta' };
  if (game.currentPlayerId !== actorId) return { success: false, error: 'Não é sua vez' };

  const def = ACTION_DEFS[actionType];
  if (!def) return { success: false, error: 'Ação inválida' };

  const actor = getPlayer(game, actorId);
  if (def.cost && actor.coins < def.cost) return { success: false, error: 'Moedas insuficientes' };
  if (actor.coins >= 10 && actionType !== 'golpe') return { success: false, error: 'Com 10+ moedas é obrigatório usar Golpe de Estado' };
  if (def.requiresTarget && !targetId) return { success: false, error: 'Escolha um alvo primeiro' };
  if (actionType === 'veredito' && !guessedChar) return { success: false, error: 'Escolha um personagem para o veredito' };
  
  if (targetId) {
    const t = getPlayer(game, targetId);
    if (!t || !t.cards.some(c => !c.dead)) return { success: false, error: 'Alvo inválido' };
  }

  if (def.cost) actor.coins -= def.cost;

  game.pendingAction = {
    type: actionType, actorId, targetId: targetId || null,
    claimedCharacter: def.character || null,
    guessedCharacter: guessedChar,
    blocker: null, respondedPlayers: [], loseInfluenceQueue: [],
  };

  const tName = targetId ? getPlayer(game, targetId)?.name : null;
  log(game, `${actor.name} declara: ${ACTION_NAMES[actionType]}${tName ? ` → ${tName}` : ''}`);

  if (!def.challengeable && !def.blockable) {
    resolveActionEffect(game);
    return { success: true };
  }
  game.phase = 'RESPONSE_WINDOW';
  return { success: true };
}

function resolveBlockFinal(game: GameState) {
  const pa = game.pendingAction!;
  if (pa.type === 'roubar') {
    game.phase = 'GAMBLE_WAIT';
  } else {
    advanceTurn(game);
  }
}

export function handleTossCoin(room: Room, playerId: string) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (!pa || game.phase !== 'GAMBLE_WAIT') return { success: false };
  if (pa.blocker?.playerId !== playerId) return { success: false, error: 'Apenas quem bloqueou pode lançar a moeda' };

  pa.gambleResult = Math.random() > 0.5 ? 'heads' : 'tails';
  game.phase = 'GAMBLE_FLIPPING';
  log(game, "🪙 A moeda está girando... O destino está sendo decidido!");
  return { success: true };
}

export function resolveGambleFinal(room: Room) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (!pa || game.phase !== 'GAMBLE_FLIPPING') return;

  const blocker = getPlayer(game, pa.blocker!.playerId);
  const bicheiro = getPlayer(game, pa.actorId);

  if (pa.gambleResult === 'heads') {
    log(game, FUNNY.bicheiro_heads(blocker.name));
    blocker.coins += 1;
    bicheiro.coins -= 1;
    advanceTurn(game);
  } else {
    log(game, FUNNY.bicheiro_tails(blocker.name));
    resolveActionEffect(game);
  }
}

export function handlePass(room: Room, playerId: string) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.respondedPlayers.includes(playerId)) pa.respondedPlayers.push(playerId);
    if (checkResponseWindowComplete(game)) resolveActionEffect(game);
    return { success: true };
  }

  if (game.phase === 'BLOCK_CHALLENGE_WINDOW' && playerId === pa.actorId) {
    log(game, FUNNY.block_accepted(getPlayer(game, pa.actorId).name));
    resolveBlockFinal(game);
    return { success: true };
  }
  return { success: true };
}

export function handleBlock(room: Room, blockerId: string, claimedCharacter: string) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (!pa || game.phase !== 'RESPONSE_WINDOW') return { success: false, error: 'Não é possível bloquear agora' };

  const def = ACTION_DEFS[pa.type];
  if (!def.blockable) return { success: false, error: 'Ação não pode ser bloqueada' };
  if (!getBlockers(pa.type).includes(claimedCharacter)) return { success: false, error: 'Personagem não bloqueia isso' };
  if (!def.anyoneCanBlock && blockerId !== pa.targetId) return { success: false, error: 'Apenas o alvo pode bloquear' };

  const blocker = getPlayer(game, blockerId);
  if (pa.type === 'roubar' && blocker.coins < 1) return { success: false, error: 'Você precisa de 1 moeda para tentar bloquear o Bicheiro' };
  
  if (pa.type === 'roubar') {
    blocker.coins -= 1;
    const bicheiro = getPlayer(game, pa.actorId);
    bicheiro.coins += 1; // Transfere a moeda pro bicheiro na hora
  }

  pa.blocker = { playerId: blockerId, character: claimedCharacter };
  game.phase = 'BLOCK_CHALLENGE_WINDOW';
  log(game, FUNNY.block(getPlayer(game, blockerId).name, ACTION_NAMES[pa.type]));
  return { success: true };
}

export function handleChallenge(room: Room, challengerId: string) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (!pa) return { success: false };

  const challenger = getPlayer(game, challengerId);

  if (game.phase === 'RESPONSE_WINDOW') {
    if (!pa.claimedCharacter) return { success: false, error: 'Ação não pode ser desafiada' };
    if (challengerId === pa.actorId) return { success: false, error: 'Não pode se desafiar' };

    const actor = getPlayer(game, pa.actorId);
    const cardIdx = actor.cards.findIndex(c => !c.dead && c.character === pa.claimedCharacter);

    if (cardIdx !== -1) {
      log(game, FUNNY.challenge_fail(challenger.name, actor.name));
      const char = actor.cards[cardIdx].character;
      game.deck.push(char); shuffle(game.deck);
      actor.cards[cardIdx].character = game.deck.pop()!;
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'continue_action';
      game.phase = 'LOSE_INFLUENCE';
    } else {
      log(game, FUNNY.challenge_success(challenger.name, actor.name));
      pa.loseInfluenceQueue.push({ playerId: pa.actorId });
      pa._afterLose = 'cancel_action';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }

  if (game.phase === 'BLOCK_CHALLENGE_WINDOW') {
    if (challengerId !== pa.actorId) return { success: false, error: 'Só quem foi bloqueado pode desafiar o bloqueio' };

    const { playerId: blockerId, character: blockerChar } = pa.blocker!;
    const blocker = getPlayer(game, blockerId);
    const cardIdx = blocker.cards.findIndex(c => !c.dead && c.character === blockerChar);

    if (cardIdx !== -1) {
      log(game, FUNNY.block_challenge_fail(challenger.name, blocker.name));
      const char = blocker.cards[cardIdx].character;
      game.deck.push(char); shuffle(game.deck);
      blocker.cards[cardIdx].character = game.deck.pop()!;
      pa.loseInfluenceQueue.push({ playerId: challengerId });
      pa._afterLose = 'block_stands_final'; // Special case for gambling logic
      game.phase = 'LOSE_INFLUENCE';
    } else {
      log(game, FUNNY.block_challenge_success(challenger.name, blocker.name));
      pa.loseInfluenceQueue.push({ playerId: blockerId });
      pa._afterLose = 'action_proceeds';
      game.phase = 'LOSE_INFLUENCE';
    }
    return { success: true };
  }
  return { success: false };
}

export function handleLoseInfluence(room: Room, playerId: string, cardIndex: number) {
  const game = room.game!;
  const pa = game.pendingAction;
  if (game.phase !== 'LOSE_INFLUENCE' || !pa) return { success: false };

  const queue = pa.loseInfluenceQueue;
  if (!queue.length || queue[0].playerId !== playerId) return { success: false, error: 'Não é você que deve perder influência' };

  const player = getPlayer(game, playerId);
  const card = player.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  card.dead = true;
  log(game, FUNNY.lose_influence(player.name, CHARACTER_NAMES[card.character]));
  queue.shift();

  if (checkGameOver(game)) return { success: true };
  if (queue.length > 0) return { success: true };

  const flag = pa._afterLose;
  delete pa._afterLose;

  if (flag === 'continue_action')  resolveActionEffect(game);
  else if (flag === 'cancel_action')  advanceTurn(game);
  else if (flag === 'block_stands')   advanceTurn(game);
  else if (flag === 'block_stands_final') resolveBlockFinal(game);
  else if (flag === 'action_proceeds') resolveActionEffect(game);
  else advanceTurn(game);

  return { success: true };
}

export function handleSelectCardShow(room: Room, playerId: string, cardIndex: number) {
  const game = room.game!;
  const pa = game.pendingAction!;
  if (game.phase !== 'X9_PEEK_SELECT') return { success: false, error: 'Fase incorreta' };
  if (pa.targetId !== playerId) return { success: false, error: 'Você não é o alvo' };

  const target = getPlayer(game, playerId);
  const card = target.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  pa.x9Result = { character: card.character, cardIndex };
  game.phase = 'X9_PEEK_VIEW';
  log(game, FUNNY.x9_show(target.name));
  return { success: true };
}

export function handleAcknowledgePeek(room: Room, actorId: string) {
  const game = room.game!;
  const pa = game.pendingAction!;
  if (game.phase !== 'X9_PEEK_VIEW') return { success: false };
  if (pa.actorId !== actorId) return { success: false, error: 'Só o investigador pode confirmar' };

  delete pa.x9Result;
  advanceTurn(game);
  return { success: true };
}

export function handleSelectCardSwap(room: Room, playerId: string, cardIndex: number) {
  const game = room.game!;
  const pa = game.pendingAction!;
  if (game.phase !== 'CARD_SWAP_SELECT') return { success: false, error: 'Fase incorreta' };
  if (pa.swapPlayerId !== playerId) return { success: false, error: 'Não é você que deve trocar' };

  const player = getPlayer(game, playerId);
  const card = player.cards[cardIndex];
  if (!card || card.dead) return { success: false, error: 'Carta inválida' };

  const old = card.character;
  game.deck.push(old); shuffle(game.deck);
  card.character = game.deck.pop()!;

  log(game, FUNNY.x9_swap_done(player.name));
  advanceTurn(game);
  return { success: true };
}
