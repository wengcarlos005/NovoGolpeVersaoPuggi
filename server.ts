import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  rooms,
  createRoom, joinRoom, startGameInRoom,
  removePlayerFromRoom, getRoomByPlayer, getRoomByCode, generateRoomForClient,
} from './src/server/rooms.ts';
import {
  handleAction, handlePass, handleBlock, handleChallenge,
  handleLoseInfluence, handleSelectCardShow, handleAcknowledgePeek, handleSelectCardSwap,
} from './src/server/engine.ts';
import { Room, GameState, PendingAction } from './src/server/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

  app.get('/api/health', (_, res) => res.json({ ok: true }));

  // ── Reconnection state ────────────────────────────────────────────────────────
  const pidSessions = new Map<string, { roomCode: string; playerId: string }>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();
  const GRACE_PERIOD_MS = 30_000;

  // ── Sanitize functions ───────────────────────────────────────────────────────
  function sanitizeGame(game: GameState, playerId: string) {
    return {
      players: game.players.map(p => ({
        id: p.id, name: p.name, coins: p.coins,
        alive: p.cards.some(c => !c.dead),
        cards: p.cards.map((c, i) => ({
          index: i, dead: c.dead,
          character: (p.id === playerId || c.dead) ? c.character : null,
        })),
      })),
      currentPlayerId: game.currentPlayerId,
      phase: game.phase,
      pendingAction: sanitizePA(game.pendingAction, playerId),
      log: game.log.slice(-25),
      winner: game.winner,
    };
  }

  function sanitizeGameForSpectator(game: GameState) {
    return {
      players: game.players.map(p => ({
        id: p.id, name: p.name, coins: p.coins,
        alive: p.cards.some(c => !c.dead),
        cards: p.cards.map((c, i) => ({ index: i, dead: c.dead, character: c.dead ? c.character : null })),
      })),
      currentPlayerId: game.currentPlayerId,
      phase: game.phase,
      pendingAction: game.pendingAction ? {
        type: game.pendingAction.type, actorId: game.pendingAction.actorId,
        targetId: game.pendingAction.targetId, claimedCharacter: game.pendingAction.claimedCharacter,
        blocker: game.pendingAction.blocker,
      } : null,
      log: game.log.slice(-25),
      winner: game.winner,
    };
  }

  function sanitizePA(pa: PendingAction | null, playerId: string) {
    if (!pa) return null;
    const base: any = {
      type: pa.type, actorId: pa.actorId, targetId: pa.targetId,
      claimedCharacter: pa.claimedCharacter, blocker: pa.blocker,
      respondedPlayers: pa.respondedPlayers, loseInfluenceQueue: pa.loseInfluenceQueue,
      swapPlayerId: pa.swapPlayerId, swapContext: pa.swapContext,
    };
    if (pa.x9Result && pa.actorId === playerId) base.x9Result = pa.x9Result;
    return base;
  }

  function broadcast(room: Room, extraForPlayer: any = null) {
    room.players.forEach(p => {
      if (!room.game) return;
      const sid = p.currentSocketId || p.id;
      const payload: any = {
        code: room.code, hostId: room.hostId, status: 'playing',
        game: sanitizeGame(room.game, p.id),
      };
      if (extraForPlayer && extraForPlayer.playerId === p.id) {
        Object.assign(payload, extraForPlayer);
      }
      io.to(sid).emit('game_state', payload);
    });
    broadcastSpectators(room);
  }

  function broadcastLobby(room: Room) {
    io.to(room.code).emit('room_updated', {
      code: room.code, hostId: room.hostId, status: 'waiting',
      players: room.players.map(p => ({ id: p.id, name: p.name })),
    });
  }

  function broadcastSpectators(room: Room) {
    if (!room.game || !room.spectators?.length) return;
    const game = sanitizeGameForSpectator(room.game);
    room.spectators.forEach((s, i) => {
      io.to(s.currentSocketId || s.id).emit('spectator_state', {
        code: room.code, game, queuePosition: i + 1,
      });
    });
  }

  // ── Socket events ─────────────────────────────────────────────────────────────
  io.on('connection', (socket: any) => {
    const pid = socket.handshake.auth?.pid || null;
    if (pid) socket._pid = pid;

    console.log('connected:', socket.id, pid ? `(pid: ${pid.slice(0, 8)}…)` : '');

    if (pid && pidSessions.has(pid)) {
      const timer = disconnectTimers.get(pid);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(pid);
      }

      const session = pidSessions.get(pid);
      if (session) {
        const { roomCode, playerId } = session;
        const room = getRoomByCode(roomCode);

        if (room) {
          const player = room.players.find(p => p.id === playerId);
          const spectator = room.spectators?.find(s => s.id === playerId);

          if (player) {
            player.currentSocketId = socket.id;
            socket.join(roomCode);
            if (room.game) {
              socket.emit('game_state', {
                code: room.code, hostId: room.hostId, status: 'playing',
                game: sanitizeGame(room.game, playerId), reconnected: true, playerId,
              });
            } else {
              socket.emit('room_updated', {
                code: room.code, hostId: room.hostId, status: 'waiting',
                players: room.players.map(p => ({ id: p.id, name: p.name })),
                reconnected: true, playerId,
              });
            }
            attachGameHandlers(socket);
            return;
          }

          if (spectator) {
            spectator.currentSocketId = socket.id;
            socket.join(roomCode);
            if (room.game) {
              socket.emit('spectator_joined', {
                code: room.code, game: sanitizeGameForSpectator(room.game),
                queuePosition: room.spectators.indexOf(spectator) + 1,
                reconnected: true,
              });
            }
            attachGameHandlers(socket);
            return;
          }
        }
        pidSessions.delete(pid);
        socket.emit('session_expired');
      }
    }

    socket.on('create_room', ({ playerName }: any, cb: any) => {
      const room = createRoom(socket.id, playerName, pid);
      socket.join(room.code);
      if (pid) pidSessions.set(pid, { roomCode: room.code, playerId: socket.id });
      cb?.({ success: true, room: generateRoomForClient(room) });
    });

    socket.on('request_join', ({ code, playerName }: any, cb: any) => {
      const upper = (code || '').toUpperCase();
      const room = getRoomByCode(upper);
      if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });

      if (room.game) {
        if (room.spectators.find(s => s.id === socket.id || s.currentSocketId === socket.id))
          return cb?.({ success: true, status: 'spectating' });
        const specName = (playerName || 'Espectador').slice(0, 20);
        room.spectators.push({ id: socket.id, name: specName, currentSocketId: socket.id });
        socket.join(upper);
        if (pid) pidSessions.set(pid, { roomCode: upper, playerId: socket.id });
        socket.emit('spectator_joined', {
          code: room.code, game: sanitizeGameForSpectator(room.game),
          queuePosition: room.spectators.length,
        });
        return cb?.({ success: true, status: 'spectating' });
      }

      if (room.players.length >= 6) return cb?.({ success: false, error: 'Sala cheia' });

      if (room.players.find(p => p.currentSocketId === socket.id || p.id === socket.id)) {
        socket.join(upper);
        return cb?.({ success: true, status: 'already_in' });
      }

      if (pid && pid === room.hostPid) {
        const result = joinRoom(upper, socket.id, playerName);
        if (!result.success) return cb?.({ success: false, error: result.error });
        socket.join(upper);
        pidSessions.set(pid, { roomCode: upper, playerId: socket.id });
        broadcastLobby(room);
        socket.emit('join_approved', { room: generateRoomForClient(room), playerId: socket.id });
        return cb?.({ success: true, status: 'pending' });
      }

      const requestId = Math.random().toString(36).slice(2, 9);
      room.pendingRequests.push({ requestId, socketId: socket.id, playerName: (playerName || 'Jogador').slice(0, 20) });

      const host = room.players.find(p => p.id === room.hostId);
      if (host) {
        const hostSid = host.currentSocketId || host.id;
        io.to(hostSid).emit('join_request', { requestId, playerName: room.pendingRequests[room.pendingRequests.length-1].playerName });
      }

      cb?.({ success: true, status: 'pending' });
    });

    attachGameHandlers(socket);

    socket.on('disconnect', () => {
      console.log('disconnected:', socket.id);
      for (const room of Object.values(rooms)) {
        const si = room.spectators?.findIndex(s => s.id === socket.id || s.currentSocketId === socket.id);
        if (si >= 0) { room.spectators.splice(si, 1); break; }
      }

      const room = getRoomByPlayer(socket.id);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
      if (!player) return;
      const playerId = player.id;
      const roomCode = room.code;

      if (pid) {
        const timer = setTimeout(() => {
          removePlayerFromRoom(roomCode, playerId);
          pidSessions.delete(pid);
          disconnectTimers.delete(pid);
          const liveRoom = getRoomByCode(roomCode);
          if (liveRoom && liveRoom.players.length > 0 && !liveRoom.game) {
            broadcastLobby(liveRoom);
          }
          console.log('grace period expired, removed player:', playerId);
        }, GRACE_PERIOD_MS);
        disconnectTimers.set(pid, timer);
      } else {
        removePlayerFromRoom(roomCode, playerId);
        const liveRoom = getRoomByCode(roomCode);
        if (liveRoom && liveRoom.players.length > 0 && !liveRoom.game) broadcastLobby(liveRoom);
      }
    });

    function attachGameHandlers(socket: any) {
      function resolvePlayerId() {
        const room = getRoomByPlayer(socket.id);
        if (!room) return socket.id;
        const p = room.players.find(rp => rp.id === socket.id || rp.currentSocketId === socket.id);
        return p ? p.id : socket.id;
      }

      function withRoom(cb: any) {
        return (payload: any, ack: any) => {
          const room = getRoomByPlayer(socket.id);
          if (!room?.game) return ack?.({ success: false });
          const playerId = resolvePlayerId();
          const result = cb(room, payload, playerId);
          broadcast(room);
          ack?.({ success: result?.success ?? true, error: result?.error });
        };
      }

      socket.on('start_game', (_: any, cb: any) => {
        const room = getRoomByPlayer(socket.id);
        if (!room) return cb?.({ success: false, error: 'Sala não encontrada' });
        const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
        if (!caller || room.hostId !== caller.id) return cb?.({ success: false, error: 'Só o host pode iniciar' });
        if (room.players.length < 2) return cb?.({ success: false, error: 'Mínimo 2 jogadores' });
        room.pendingRequests = [];
        startGameInRoom(room);
        broadcast(room);
        cb?.({ success: true });
      });

      socket.on('approve_join', ({ requestId }: any, cb: any) => {
        const room = getRoomByPlayer(socket.id);
        if (!room) return cb?.({ success: false });
        const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
        if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Não autorizado' });

        const idx = room.pendingRequests.findIndex(r => r.requestId === requestId);
        if (idx === -1) return cb?.({ success: false, error: 'Solicitação não encontrada' });
        const req = room.pendingRequests.splice(idx, 1)[0];

        const guestSocket = io.sockets.sockets.get(req.socketId);

        if (room.game) {
          if (guestSocket) {
            const already = room.spectators.find(s => s.id === req.socketId || s.currentSocketId === req.socketId);
            if (!already) {
              room.spectators.push({ id: req.socketId, name: req.playerName, currentSocketId: req.socketId });
              guestSocket.join(room.code);
              const guestPid = (guestSocket as any)._pid;
              if (guestPid) pidSessions.set(guestPid, { roomCode: room.code, playerId: req.socketId });
              guestSocket.emit('spectator_joined', {
                code: room.code, game: sanitizeGameForSpectator(room.game),
                queuePosition: room.spectators.length,
              });
            }
          }
          return cb?.({ success: true });
        }

        const result = joinRoom(room.code, req.socketId, req.playerName);
        if (!result.success) return cb?.({ success: false, error: result.error });

        if (guestSocket) {
          guestSocket.join(room.code);
          const guestPid = (guestSocket as any)._pid;
          if (guestPid) pidSessions.set(guestPid, { roomCode: room.code, playerId: req.socketId });
          guestSocket.emit('join_approved', {
            room: generateRoomForClient(room),
            playerId: req.socketId,
          });
        }

        broadcastLobby(room);
        cb?.({ success: true });
      });

      socket.on('deny_join', ({ requestId }: any, cb: any) => {
        const room = getRoomByPlayer(socket.id);
        if (!room) return cb?.({ success: false });
        const caller = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
        if (!caller || caller.id !== room.hostId) return cb?.({ success: false, error: 'Não autorizado' });

        const idx = room.pendingRequests.findIndex(r => r.requestId === requestId);
        if (idx === -1) return cb?.({ success: false });
        const req = room.pendingRequests.splice(idx, 1)[0];

        io.to(req.socketId).emit('join_denied', { reason: 'Host negou sua entrada na sala' });
        cb?.({ success: true });
      });

      socket.on('leave_room', (_: any, cb: any) => {
        const pid = (socket as any)._pid;
        const room = getRoomByPlayer(socket.id);
        if (room) {
          const player = room.players.find(p => p.id === socket.id || p.currentSocketId === socket.id);
          if (player) {
            if (pid) { 
              const timer = disconnectTimers.get(pid);
              if(timer) clearTimeout(timer);
              disconnectTimers.delete(pid); 
              pidSessions.delete(pid); 
            }
            removePlayerFromRoom(room.code, player.id);
            const liveRoom = getRoomByCode(room.code);
            if (liveRoom?.players.length > 0 && !liveRoom.game) broadcastLobby(liveRoom);
          }
          const si = room.spectators.findIndex(s => s.id === socket.id || s.currentSocketId === socket.id);
          if (si >= 0) room.spectators.splice(si, 1);
          socket.leave(room.code);
        }
        if (pid) pidSessions.delete(pid);
        cb?.({ success: true });
      });

      socket.on('restart_game', (_: any, cb: any) => {
        const room = getRoomByPlayer(socket.id);
        if (!room) return cb?.({ success: false });
        const slots = Math.max(0, 6 - room.players.length);
        const promoted = (room.spectators || []).splice(0, slots);
        promoted.forEach(s => room.players.push({ id: s.id, name: s.name, currentSocketId: s.currentSocketId || s.id, coins: 0, cards: [] }));
        startGameInRoom(room);
        broadcast(room);
        cb?.({ success: true });
      });

      socket.on('take_action',       withRoom((room: Room, { action, targetId }: any, pid: string) => handleAction(room, pid, action, targetId)));
      socket.on('challenge',         withRoom((room: Room, _: any, pid: string) => handleChallenge(room, pid)));
      socket.on('block',             withRoom((room: Room, { character }: any, pid: string) => handleBlock(room, pid, character)));
      socket.on('pass',              withRoom((room: Room, _: any, pid: string) => handlePass(room, pid)));
      socket.on('lose_influence',    withRoom((room: Room, { cardIndex }: any, pid: string) => handleLoseInfluence(room, pid, cardIndex)));
      socket.on('select_card_show',  withRoom((room: Room, { cardIndex }: any, pid: string) => handleSelectCardShow(room, pid, cardIndex)));
      socket.on('acknowledge_peek',  withRoom((room: Room, _: any, pid: string) => handleAcknowledgePeek(room, pid)));
      socket.on('select_card_swap',  withRoom((room: Room, { cardIndex }: any, pid: string) => handleSelectCardSwap(room, pid, cardIndex)));
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
