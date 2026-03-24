import { useState, useEffect, useRef } from 'react';
import { getSocket, rpc } from '../lib/nakama';
import type { MatchmakerMatched } from '@heroiclabs/nakama-js';

interface Props {
  onMatchFound: (matchId: string) => void;
  userId: string;
}

export default function Matchmaking({ onMatchFound, userId }: Props) {
  const [searching, setSearching] = useState(false);
  const [timedMode, setTimedMode] = useState(false);
  const [waitingInRoom, setWaitingInRoom] = useState(false);
  const [matchId, setMatchId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ticketRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.onmatchmakermatched = async (matched: MatchmakerMatched) => {
      try {
        if (matched.match_id) {
          // Must join the match created by the matchmaker
          await socket.joinMatch(matched.match_id, matched.token);
          onMatchFound(matched.match_id);
        }
      } catch (e) {
        console.error('matchmaker error:', e);
      }
    };

    return () => {
      socket.onmatchmakermatched = () => {};
    };
  }, [onMatchFound]);

  const handleFindMatch = async () => {
    setSearching(true);
    setError('');
    try {
      const socket = getSocket();
      if (!socket) throw new Error('No socket');

      const timedModeVal = timedMode ? 1 : 0;
      const ticket = await socket.addMatchmaker(
        '+properties.mode:tictactoe',
        2,
        2,
        { mode: 'tictactoe' },
        { timed_mode: timedModeVal }
      );
      ticketRef.current = ticket.ticket;
    } catch (err) {
      setError('Failed to start matchmaking');
      setSearching(false);
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (ticketRef.current) {
      const socket = getSocket();
      if (socket) {
        await socket.removeMatchmaker(ticketRef.current);
      }
      ticketRef.current = null;
    }
    setSearching(false);
    setWaitingInRoom(false);
    setMatchId('');
  };

  const handleCreateMatch = async () => {
    setError('');
    try {
      const result = await rpc<{ match_id: string }>('create_match', { timed_mode: timedMode });
      const mid = result.match_id;
      if (!mid) {
        setError('No match ID returned');
        return;
      }
      setMatchId(mid);
      const socket = getSocket();
      if (socket) {
        await socket.joinMatch(mid);
        // Stay on this screen showing match ID
        // App's onmatchdata listener will transition us when game starts
        setWaitingInRoom(true);
      }
    } catch (err: any) {
      setError('Failed to create match: ' + (err?.message || String(err)));
      console.error('Create match error:', err);
    }
  };

  const handleJoinMatch = async () => {
    if (!joinCode.trim()) return;
    setError('');
    try {
      const socket = getSocket();
      if (socket) {
        await socket.joinMatch(joinCode.trim());
        // App's onmatchdata listener will transition when STATE arrives
        setMatchId(joinCode.trim());
        setWaitingInRoom(true);
      }
    } catch (err) {
      setError('Failed to join match. Check the code.');
      console.error(err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(matchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (waitingInRoom) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold text-[var(--accent)]">Waiting for opponent...</h2>
        <p className="text-[var(--text-secondary)]">Share the match ID below with a friend</p>
        <div className="w-10 h-10 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />

        <div className="w-full p-4 rounded-lg bg-[var(--bg-secondary)] text-center">
          <p className="text-xs text-[var(--text-secondary)] mb-2">Match ID:</p>
          <p className="text-sm text-[var(--accent)] font-mono break-all mb-3 select-all">{matchId}</p>
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-[var(--bg-card)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Match ID'}
          </button>
        </div>

        <button
          onClick={handleCancel}
          className="px-6 py-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (searching) {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-2xl font-bold text-[var(--accent)]">Finding a random player...</h2>
        <p className="text-[var(--text-secondary)]">It usually takes 25 seconds.</p>
        <div className="w-12 h-12 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />
        <button
          onClick={handleCancel}
          className="px-6 py-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-2xl font-bold text-[var(--accent)]">Play Tic-Tac-Toe</h2>

      <div className="flex items-center gap-3 bg-[var(--bg-secondary)] rounded-lg p-1">
        <button
          onClick={() => setTimedMode(false)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            !timedMode ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          Classic
        </button>
        <button
          onClick={() => setTimedMode(true)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            timedMode ? 'bg-[var(--accent)] text-[var(--bg-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          Timed (30s)
        </button>
      </div>

      <button
        onClick={handleFindMatch}
        className="w-full py-4 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-lg hover:opacity-90 transition-opacity"
      >
        Find Match
      </button>

      <div className="flex items-center gap-4 w-full">
        <div className="flex-1 h-px bg-[var(--bg-card)]" />
        <span className="text-[var(--text-secondary)] text-sm">or</span>
        <div className="flex-1 h-px bg-[var(--bg-card)]" />
      </div>

      <button
        onClick={handleCreateMatch}
        className="w-full py-3 rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
      >
        Create Room
      </button>

      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Enter match ID"
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] text-sm"
        />
        <button
          onClick={handleJoinMatch}
          disabled={!joinCode.trim()}
          className="px-4 py-2 rounded-lg bg-[var(--bg-card)] text-[var(--accent)] font-medium hover:bg-[var(--bg-secondary)] disabled:opacity-50 transition-colors"
        >
          Join
        </button>
      </div>

      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
    </div>
  );
}
