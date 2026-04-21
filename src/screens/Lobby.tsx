import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import styles from './Lobby.module.css';

export default function Lobby({ onCreated }: { onCreated: (room: any) => void }) {
  const navigate  = useNavigate();
  const [name,    setName]    = useState(() => localStorage.getItem('golpe_name') || '');
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Conectando...');

  function connect(cb: () => void) {
    if (!name.trim()) return setError('Digite seu nome');
    setError('');
    setLoading(true);
    setLoadingMsg('Conectando...');

    if (socket.connected) { cb(); return; }

    socket.connect();

    function onConnect()   { cleanup(); cb(); }
    function onError()     {
      cleanup();
      setLoading(false);
      setError('Não foi possível conectar. Tente novamente.');
    }
    function cleanup() {
      socket.off('connect',       onConnect);
      socket.off('connect_error', onError);
    }

    socket.once('connect',       onConnect);
    socket.once('connect_error', onError);
  }

  function handleCreate() {
    connect(() => {
      localStorage.setItem('golpe_name', name.trim());
      socket.emit('create_room', { playerName: name.trim() }, (res: any) => {
        setLoading(false);
        if (res.success) {
          onCreated(res.room);
        } else {
          setError(res.error || 'Erro ao criar sala');
        }
      });
    });
  }

  function handleJoin() {
    if (!code.trim()) return setError('Digite o código da sala');
    if (!name.trim()) return setError('Digite seu nome');
    localStorage.setItem('golpe_name', name.trim());
    navigate(`/sala/${code.trim().toUpperCase()}`, { state: { playerName: name.trim() } });
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>GOLPE</h1>
        <p className={styles.subtitle}>Blefe. Poder. Traição.</p>

        <div className={styles.form}>
          <input
            placeholder="Seu nome"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />

          <button className="btn-primary w-full" onClick={handleCreate} disabled={loading}>
            {loading ? loadingMsg : 'Criar Sala'}
          </button>

          <div className={styles.divider}><span>ou entrar em uma sala</span></div>

          <input
            placeholder="Código da sala (ex: AB3K)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />

          <button className="btn w-full" onClick={handleJoin} disabled={loading}>
            Entrar na Sala
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
