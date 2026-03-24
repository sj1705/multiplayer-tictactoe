export const OpCode = {
  MOVE: 1,
  STATE: 2,
  GAME_OVER: 3,
  TIMER_UPDATE: 4,
  ERROR: 5,
  READY: 6,
} as const;

export interface GameState {
  board: number[];
  players: Record<string, number>; // userID -> mark (1=X, 2=O)
  player_names: Record<string, string>;
  current_turn: string;
  game_over: boolean;
  winner: string;
  win_line: number[] | null;
  timed_mode: boolean;
  turn_deadline: number;
}

export interface GameOverData {
  winner: string;
  winner_name: string;
  win_line: number[] | null;
  reason: 'win' | 'draw' | 'timeout' | 'forfeit';
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  score: number;
  rank: number;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    win_streak: number;
    max_streak: number;
  };
}

export type Screen = 'login' | 'matchmaking' | 'game' | 'result' | 'leaderboard';
