import { createDeck } from './game/deck.ts';

export const rooms: Record<string, any> = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createRoom(hostId: string, hostName: string, hostPid: string | null) {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  const room = {
    code,
    hostId,
    hostPid: hostPid || null,
    players: [{ id: hostId, name: hostName, currentSocketId: hostId }],
    spectators: [] as any[],      // [{ id, name, currentSocketId }] — watching, enter next round
    pendingRequests: [] as any[], // [{ requestId, socketId, playerName }]
    game: null as any,
  };

  rooms[code] = room;
  return room;
}

export function joinRoom(code: string, playerId: string, playerName: string) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Sala não encontrada' };
  if (room.game) return { success: false, error: 'Partida já em andamento' };
  if (room.players.length >= 6) return { success: false, error: 'Sala cheia' };
  if (room.players.find((p: any) => p.id === playerId)) return { success: true, room };

  room.players.push({ id: playerId, name: playerName, currentSocketId: playerId });
  return { success: true, room };
}

export function startGame(room: any) {
  const deck = createDeck(room.players.length);
  const players = room.players.map((p: any) => ({
    id: p.id,
    name: p.name,
    coins: 1,
    gainedCoins: 1,
    spentCoins: 0,
    cards: [
      { character: deck.pop(), dead: false },
      { character: deck.pop(), dead: false },
    ],
  }));

  room.game = {
    players,
    deck,
    currentPlayerId: players[0].id,
    phase: 'ACTION_SELECT',
    pendingAction: null as any,
    log: [`--- Partida iniciada! Vez de ${players[0].name} ---`],
    winner: null as string | null,
  };

  return room.game;
}

export function removePlayerFromRoom(code: string, playerId: string) {
  const room = rooms[code];
  if (!room) return;
  room.players = room.players.filter((p: any) => p.id !== playerId);
  if (room.players.length === 0) {
    delete rooms[code];
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
}

/**
 * Find a room by either the player's original id or their current socket id.
 * This handles both normal use and post-reconnect use.
 */
export function getRoomByPlayer(socketId: string) {
  for (const room of Object.values(rooms)) {
    if (room.players.find((p: any) => p.id === socketId || p.currentSocketId === socketId)) return room;
  }
  return null;
}

export function getRoomByCode(code: string) {
  return rooms[code] || null;
}

/** Serialise a room for the client (no internal fields like currentSocketId/hostPid/pendingRequests). */
export function generateRoomForClient(room: any) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: 'waiting',
    players: room.players.map((p: any) => ({ id: p.id, name: p.name })),
  };
}
