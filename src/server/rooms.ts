import { createDeck } from './deck.ts';
import { Room, GameState } from './types.ts';

export const rooms: Record<string, Room> = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function createRoom(hostId: string, hostName: string, hostPid: string | null) {
  let code;
  do { code = generateCode(); } while (rooms[code]);

  const room: Room = {
    code,
    hostId,
    hostPid: hostPid || null,
    players: [{ id: hostId, name: hostName, currentSocketId: hostId, coins: 0, cards: [] }],
    spectators: [],
    pendingRequests: [],
    game: null,
  };

  rooms[code] = room;
  return room;
}

export function joinRoom(code: string, playerId: string, playerName: string) {
  const room = rooms[code];
  if (!room) return { success: false, error: 'Sala não encontrada' };
  if (room.game) return { success: false, error: 'Partida já em andamento' };
  if (room.players.length >= 6) return { success: false, error: 'Sala cheia' };
  if (room.players.find(p => p.id === playerId)) return { success: true, room };

  room.players.push({ id: playerId, name: playerName, currentSocketId: playerId, coins: 0, cards: [] });
  return { success: true, room };
}

export function startGameInRoom(room: Room) {
  const deck = createDeck();
  const players = room.players.map(p => ({
    id: p.id,
    name: p.name,
    currentSocketId: p.currentSocketId,
    coins: 1,
    cards: [
      { character: deck.pop()!, dead: false },
      { character: deck.pop()!, dead: false },
    ],
  }));

  room.game = {
    players,
    deck,
    currentPlayerId: players[0].id,
    phase: 'ACTION_SELECT',
    pendingAction: null,
    log: [`--- Partida iniciada! Vez de ${players[0].name} ---`],
    winner: null,
  };

  return room.game;
}

export function removePlayerFromRoom(code: string, playerId: string) {
  const room = rooms[code];
  if (!room) return;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === 0) {
    delete rooms[code];
    return;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }
}

export function getRoomByPlayer(socketId: string) {
  for (const room of Object.values(rooms)) {
    if (room.players.find(p => p.id === socketId || p.currentSocketId === socketId)) return room;
    if (room.spectators.find(s => s.id === socketId || s.currentSocketId === socketId)) return room;
  }
  return null;
}

export function getRoomByCode(code: string) {
  return rooms[code] || null;
}

export function generateRoomForClient(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: 'waiting',
    players: room.players.map(p => ({ id: p.id, name: p.name })),
  };
}
