import { useCallback } from 'react';
import { getSocket } from '../lib/nakama';
import { OpCode } from '../types/game';
import type { GameState } from '../types/game';
import Timer from './Timer';

interface Props {
  matchId: string;
  userId: string;
  gameState: GameState;
  timerDeadline: number;
  error: string;
}

export default function GameBoard({ matchId, userId, gameState, timerDeadline, error }: Props) {
  const handleMove = useCallback((position: number) => {
    if (gameState.game_over) return;
    if (gameState.current_turn !== userId) return;
    if (gameState.board[position] !== 0) return;

    const socket = getSocket();
    if (!socket) return;

    socket.sendMatchState(matchId, OpCode.MOVE, JSON.stringify({ position }));
  }, [gameState, userId, matchId]);

  const myMark = gameState.players[userId];
  const isMyTurn = gameState.current_turn === userId;
  const opponentId = Object.keys(gameState.players).find(id => id !== userId) || '';
  const myName = gameState.player_names[userId] || 'You';
  const opponentName = gameState.player_names[opponentId] || 'Opponent';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-between items-center w-full">
        <div className={`text-center px-3 py-1 rounded ${isMyTurn ? 'bg-[var(--bg-card)]' : ''}`}>
          <div className="text-xs text-[var(--text-secondary)]">{myName} (you)</div>
          <div className={`text-2xl font-bold ${myMark === 1 ? 'text-[var(--x-color)]' : 'text-[var(--o-color)]'}`}>
            {myMark === 1 ? 'X' : 'O'}
          </div>
        </div>

        {gameState.timed_mode && (
          <Timer deadline={timerDeadline} active={!gameState.game_over} />
        )}

        <div className={`text-center px-3 py-1 rounded ${!isMyTurn ? 'bg-[var(--bg-card)]' : ''}`}>
          <div className="text-xs text-[var(--text-secondary)]">{opponentName} (opp)</div>
          <div className={`text-2xl font-bold ${myMark === 1 ? 'text-[var(--o-color)]' : 'text-[var(--x-color)]'}`}>
            {myMark === 1 ? 'O' : 'X'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-[var(--accent)]' : 'bg-[var(--text-secondary)]'}`} />
        <span className="text-sm text-[var(--text-secondary)]">
          {isMyTurn ? 'Your turn' : `${opponentName}'s turn`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 w-72 h-72">
        {gameState.board.map((cell, i) => {
          const isWinCell = gameState.win_line?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleMove(i)}
              disabled={!isMyTurn || cell !== 0 || gameState.game_over}
              className={`
                flex items-center justify-center rounded-lg text-4xl font-bold
                transition-all duration-150
                ${cell === 0 && isMyTurn && !gameState.game_over
                  ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] cursor-pointer'
                  : 'bg-[var(--bg-card)] cursor-default'}
                ${isWinCell ? 'ring-2 ring-[var(--win-color)] bg-[var(--bg-secondary)]' : ''}
              `}
            >
              {cell === 1 && <span className="text-[var(--x-color)]">X</span>}
              {cell === 2 && <span className="text-[var(--o-color)]">O</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-[var(--danger)] text-sm animate-pulse">{error}</p>
      )}
    </div>
  );
}
