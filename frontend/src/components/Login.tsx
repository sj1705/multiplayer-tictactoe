import { useState } from 'react';
import { authenticate, connectSocket } from '../lib/nakama';

interface Props {
  onLogin: (userId: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError('');

    try {
      const session = await authenticate(nickname.trim());
      await connectSocket();
      onLogin(session.user_id!);
    } catch (err) {
      setError('Failed to connect. Is the server running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[var(--accent)] mb-2">Tic-Tac-Toe</h1>
        <p className="text-[var(--text-secondary)]">Multiplayer</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
        <label className="text-[var(--text-secondary)] text-sm">Who are you?</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname"
          maxLength={20}
          className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors text-center text-lg"
          autoFocus
        />
        {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !nickname.trim()}
          className="w-full py-3 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-semibold text-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'Connecting...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
