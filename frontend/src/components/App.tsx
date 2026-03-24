import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react';
import type { Screen, GameState, GameOverData } from '../types/game';
import { OpCode } from '../types/game';
import { getSocket } from '../lib/nakama';
import type { MatchData } from '@heroiclabs/nakama-js';
import Login from './Login';
import Matchmaking from './Matchmaking';
import GameBoard from './GameBoard';
import GameResult from './GameResult';

class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-4 p-8">
          <p className="text-[var(--danger)]">Something went wrong: {this.state.error}</p>
          <button
            onClick={() => { this.setState({ error: null }); this.props.onReset(); }}
            className="px-4 py-2 rounded bg-[var(--bg-card)] text-[var(--accent)]"
          >
            Go Back
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lua sends arrays as objects with 1-indexed string keys: {"1":0,"2":1,...}
function luaToArray(obj: any, fallback: any[] = []): any[] {
  if (!obj) return fallback;
  if (Array.isArray(obj)) return obj;
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (keys.length > 0) return keys.map(k => obj[String(k)]);
  }
  return fallback;
}

function normalizeBoard(board: any): number[] {
  const arr = luaToArray(board, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  while (arr.length < 9) arr.push(0);
  return arr;
}

function parseMatchData(data: MatchData): any | null {
  try {
    if (!data.data || (data.data as any).length === 0) return null;
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(data.data as Uint8Array));
  } catch {
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [matchId, setMatchId] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [matchError, setMatchError] = useState('');
  const [timerDeadline, setTimerDeadline] = useState(0);

  const screenRef = useRef(screen);
  const matchIdRef = useRef(matchId);
  screenRef.current = screen;
  matchIdRef.current = matchId;

  // Global match data listener — set once after login, never replaced
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.onmatchdata = (data: MatchData) => {
      try {
        const json = parseMatchData(data);
        if (!json) return;

        switch (data.op_code) {
          case OpCode.STATE: {
            const gs: GameState = {
              board: normalizeBoard(json.board),
              players: json.players || {},
              player_names: json.player_names || {},
              current_turn: json.current_turn || '',
              game_over: !!json.game_over,
              winner: json.winner || '',
              win_line: json.win_line ? luaToArray(json.win_line, null) : null,
              timed_mode: !!json.timed_mode,
              turn_deadline: json.turn_deadline || 0,
            };
            setGameState(gs);
            if (gs.turn_deadline) setTimerDeadline(gs.turn_deadline);
            // If we're still on matchmaking (room creator), switch to game
            if (screenRef.current === 'matchmaking') {
              setMatchId(data.match_id);
              matchIdRef.current = data.match_id;
              setScreen('game');
            }
            break;
          }
          case OpCode.GAME_OVER: {
            setGameOverData({
              winner: json.winner || '',
              winner_name: json.winner_name || '',
              win_line: json.win_line ? luaToArray(json.win_line, null) : null,
              reason: json.reason || 'unknown',
            });
            setScreen('result');
            break;
          }
          case OpCode.TIMER_UPDATE: {
            if (json.deadline) setTimerDeadline(json.deadline);
            break;
          }
          case OpCode.ERROR: {
            setMatchError(json.error || 'Unknown error');
            setTimeout(() => setMatchError(''), 2000);
            break;
          }
        }
      } catch (e) {
        console.error('Error handling match data:', e);
      }
    };
  }, [userId]);

  const handleLogin = useCallback((uid: string) => {
    setUserId(uid);
    setScreen('matchmaking');
  }, []);

  const handleMatchFound = useCallback((mid: string) => {
    setMatchId(mid);
    matchIdRef.current = mid;
    setScreen('game');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setMatchId('');
    matchIdRef.current = '';
    setGameState(null);
    setGameOverData(null);
    setTimerDeadline(0);
    setMatchError('');
    setScreen('matchmaking');
  }, []);

  const handleReset = useCallback(() => {
    setScreen('matchmaking');
  }, []);

  return (
    <ErrorBoundary onReset={handleReset}>
      <div className="w-full max-w-md mx-auto px-4 py-8">
        {screen === 'login' && <Login onLogin={handleLogin} />}
        {screen === 'matchmaking' && <Matchmaking onMatchFound={handleMatchFound} userId={userId} />}
        {screen === 'game' && gameState && (
          <GameBoard
            matchId={matchId}
            userId={userId}
            gameState={gameState}
            timerDeadline={timerDeadline}
            error={matchError}
          />
        )}
        {screen === 'game' && !gameState && (
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-bold text-[var(--accent)]">Waiting for game to start...</h2>
            <div className="w-10 h-10 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}
        {screen === 'result' && gameOverData && (
          <GameResult
            data={gameOverData}
            userId={userId}
            gameState={gameState}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
