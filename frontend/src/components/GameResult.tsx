import type { GameOverData, GameState } from '../types/game';

interface Props {
  data: GameOverData;
  userId: string;
  gameState: GameState | null;
  onPlayAgain: () => void;
}

export default function GameResult({ data, userId, gameState, onPlayAgain }: Props) {
  const isWinner = data.winner === userId;
  const isDraw = data.reason === 'draw';

  let title: string;
  let subtitle: string;
  let titleColor: string;

  if (isDraw) {
    title = 'DRAW';
    subtitle = 'Good game!';
    titleColor = 'text-[var(--text-secondary)]';
  } else if (isWinner) {
    title = 'WINNER!';
    subtitle = data.reason === 'timeout' ? 'Opponent ran out of time' : data.reason === 'forfeit' ? 'Opponent left the game' : 'Great play!';
    titleColor = 'text-[var(--win-color)]';
  } else {
    title = 'DEFEATED';
    subtitle = data.reason === 'timeout' ? 'You ran out of time' : data.reason === 'forfeit' ? 'You left the game' : 'Better luck next time!';
    titleColor = 'text-[var(--danger)]';
  }

  const myMark = gameState?.players[userId];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Result mark */}
      <div className={`text-8xl font-bold ${isWinner ? 'text-[var(--win-color)]' : isDraw ? 'text-[var(--text-secondary)]' : 'text-[var(--danger)]'}`}>
        {isDraw ? '=' : myMark === 1 ? 'X' : 'O'}
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className={`text-4xl font-bold ${titleColor}`}>
          {title}
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">{subtitle}</p>
      </div>

      {/* Mini board replay */}
      {gameState && (
        <div className="grid grid-cols-3 gap-1 w-36 h-36 opacity-60">
          {gameState.board.map((cell, i) => {
            const isWinCell = data.win_line?.includes(i);
            return (
              <div
                key={i}
                className={`flex items-center justify-center rounded text-lg font-bold bg-[var(--bg-card)] ${isWinCell ? 'ring-1 ring-[var(--win-color)]' : ''}`}
              >
                {cell === 1 && <span className="text-[var(--x-color)]">X</span>}
                {cell === 2 && <span className="text-[var(--o-color)]">O</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Play again */}
      <button
        onClick={onPlayAgain}
        className="w-full py-3 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-lg hover:opacity-90 transition-opacity"
      >
        Play Again
      </button>
    </div>
  );
}
