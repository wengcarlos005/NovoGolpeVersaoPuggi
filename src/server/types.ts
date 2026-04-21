export interface Player {
  id: string;
  name: string;
  currentSocketId: string;
  coins: number;
  cards: {
    character: string;
    dead: boolean;
  }[];
}

export interface Room {
  code: string;
  hostId: string;
  hostPid: string | null;
  players: Player[];
  spectators: { id: string; name: string; currentSocketId: string }[];
  pendingRequests: { requestId: string; socketId: string; playerName: string }[];
  game: GameState | null;
}

export interface GameState {
  players: Player[];
  deck: string[];
  currentPlayerId: string;
  phase: string;
  pendingAction: PendingAction | null;
  log: string[];
  winner: string | null;
}

export interface PendingAction {
  type: string;
  actorId: string;
  targetId: string | null;
  claimedCharacter: string | null;
  blocker: { playerId: string; character: string } | null;
  respondedPlayers: string[];
  loseInfluenceQueue: { playerId: string }[];
  swapPlayerId?: string;
  swapContext?: string;
  guessedCharacter?: string;
  gambleResult?: 'heads' | 'tails';
  x9Result?: { character: string; cardIndex: number };
  _afterLose?: string;
}
