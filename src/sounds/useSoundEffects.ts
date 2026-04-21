import { useEffect, useRef } from 'react';
import { sfx } from './sfx';

export function useSoundEffects(game: any, myId: string | null) {
  const prevPhase   = useRef<string | null>(null);
  const prevTurn    = useRef<string | null>(null);
  const prevCoins   = useRef<number | null>(null);
  const prevWinner  = useRef<string | null>(null);

  useEffect(() => {
    if (!game) return;

    const { phase, currentPlayerId, winner } = game;
    const me = game.players?.find((p: any) => p.id === myId);

    if (winner && winner !== prevWinner.current) {
      winner === myId ? sfx.win() : sfx.lose();
    }

    if (phase !== prevPhase.current) {
      if (phase === 'RESPONSE_WINDOW')        sfx.action();
      if (phase === 'BLOCK_CHALLENGE_WINDOW') sfx.block();
      if (phase === 'LOSE_INFLUENCE')         sfx.eliminate();
      if (phase === 'X9_PEEK_SELECT')         sfx.x9();
      if (phase === 'X9_PEEK_VIEW')           sfx.x9();
      if (phase === 'CARD_SWAP_SELECT')       sfx.cardFlip();
    }

    if (
      phase === 'ACTION_SELECT' &&
      currentPlayerId === myId &&
      prevTurn.current !== myId
    ) {
      sfx.myTurn();
    }

    if (
      me &&
      prevCoins.current !== null &&
      me.coins > prevCoins.current
    ) {
      sfx.coin();
    }

    prevPhase.current  = phase;
    prevTurn.current   = currentPlayerId;
    prevCoins.current  = me?.coins ?? null;
    prevWinner.current = winner;

  }, [game, myId]);
}
