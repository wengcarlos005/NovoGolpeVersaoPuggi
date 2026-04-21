import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import socket from './socket';
import Landing from './screens/Landing';
import Lobby from './screens/Lobby';
import SalaPage from './screens/SalaPage';

export default function App() {
  const navigate = useNavigate();

  const [roomData,        setRoomData]        = useState<any>(null);
  const [gameData,        setGameData]        = useState<any>(null);
  const [myPlayerId,      setMyPlayerId]      = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isReconnecting,  setIsReconnecting]  = useState(false);

  // Spectator state
  const [isSpectator,   setIsSpectator]   = useState(false);
  const [spectatorData, setSpectatorData] = useState<any>(null);

  const gameDataRef    = useRef(gameData);
  const roomDataRef    = useRef(roomData);
  const spectDataRef   = useRef(spectatorData);
  const reconnTimerRef = useRef<any>(null);

  useEffect(() => { gameDataRef.current  = gameData;     }, [gameData]);
  useEffect(() => { roomDataRef.current  = roomData;     }, [roomData]);
  useEffect(() => { spectDataRef.current = spectatorData;}, [spectatorData]);

  useEffect(() => {
    socket.on('room_updated', (data: any) => {
      setRoomData(data);
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
      if (data.players) {
        const namesInRoom = new Set(data.players.map((p: any) => p.name));
        setPendingRequests(prev => prev.filter(r => !namesInRoom.has(r.playerName)));
      }
    });

    socket.on('game_state', (data: any) => {
      setGameData(data);
      setIsSpectator(false);
      setSpectatorData(null);
      if (data.reconnected && data.playerId) {
        setMyPlayerId(data.playerId);
        setIsReconnecting(false);
        clearTimeout(reconnTimerRef.current);
        navigate(`/sala/${data.code}`, { replace: true });
      }
    });

    socket.on('spectator_joined', (data: any) => {
      setIsSpectator(true);
      setSpectatorData(data);
      if (data.code) navigate(`/sala/${data.code}`, { replace: true });
    });

    socket.on('spectator_state', (data: any) => {
      setSpectatorData(data);
    });

    socket.on('join_approved', ({ room, playerId }: any) => {
      setRoomData(room);
      setMyPlayerId(playerId);
      navigate(`/sala/${room.code}`, { replace: true });
    });

    socket.on('join_request', ({ requestId, playerName }: any) => {
      setPendingRequests(prev => [...prev, { requestId, playerName }]);
    });

    socket.on('disconnect', () => {
      const inSession = gameDataRef.current || roomDataRef.current || spectDataRef.current;
      if (inSession) {
        setIsReconnecting(true);
        reconnTimerRef.current = setTimeout(() => {
          clearAll();
          navigate('/', { replace: true });
        }, 12_000);
      } else {
        navigate('/', { replace: true });
      }
    });

    socket.on('session_expired', () => {
      clearTimeout(reconnTimerRef.current);
      clearAll();
      navigate('/', { replace: true });
    });

    return () => {
      socket.off('room_updated');
      socket.off('game_state');
      socket.off('spectator_joined');
      socket.off('spectator_state');
      socket.off('join_approved');
      socket.off('join_request');
      socket.off('disconnect');
      socket.off('session_expired');
    };
  }, [navigate]);

  function clearAll() {
    setIsReconnecting(false);
    setRoomData(null);
    setGameData(null);
    setMyPlayerId(null);
    setPendingRequests([]);
    setIsSpectator(false);
    setSpectatorData(null);
  }

  function handleApprove(requestId: string) {
    socket.emit('approve_join', { requestId }, (res: any) => {
      if (res?.success) setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    });
  }

  function handleDeny(requestId: string) {
    socket.emit('deny_join', { requestId }, (res: any) => {
      if (res?.success) setPendingRequests(prev => prev.filter(r => r.requestId !== requestId));
    });
  }

  function handleRoomCreated(room: any) {
    setMyPlayerId(socket.id);
    setRoomData(room);
    navigate(`/sala/${room.code}`);
  }

  function handleLeave() {
    socket.emit('leave_room', {}, () => {
      clearAll();
      navigate('/');
    });
  }

  const reconnOverlay = isReconnecting && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.78)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        width: 48, height: 48,
        border: '4px solid rgba(255,255,255,0.15)',
        borderTop: '4px solid #ffd600',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Reconectando…</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>Aguenta aí, você vai voltar pra partida</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      {reconnOverlay}
      <Routes>
        <Route path="/"      element={<Landing onEnter={() => navigate('/lobby')} />} />
        <Route path="/lobby" element={<Lobby onCreated={handleRoomCreated} />} />
        <Route
          path="/sala/:code"
          element={
            <SalaPage
              roomData={roomData}
              gameData={gameData}
              myPlayerId={myPlayerId}
              pendingRequests={pendingRequests}
              isSpectator={isSpectator}
              spectatorData={spectatorData}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onLeave={handleLeave}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
