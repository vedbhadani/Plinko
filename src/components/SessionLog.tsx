'use client';

import { useEffect, useState } from 'react';
import type { Direction } from '@/lib/engine';

interface RoundLog {
  id: string;
  createdAt: string;
  status: string;
  commitHex: string;
  dropColumn: number | null;
  binIndex: number | null;
  payoutMultiplier: number | null;
  betCents: number | null;
  pathJson: string | null;
}

interface SessionLogProps {
  onReplayRound: (path: Direction[], dropColumn: number) => void;
  refreshToken?: number;
}

function parsePath(pathJson: string | null): Direction[] | null {
  if (!pathJson) return null;

  try {
    const parsed = JSON.parse(pathJson);
    if (
      Array.isArray(parsed) &&
      parsed.every((direction) => direction === 'L' || direction === 'R')
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export default function SessionLog({ onReplayRound, refreshToken = 0 }: SessionLogProps) {
  const [rounds, setRounds] = useState<RoundLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRounds = async () => {
      try {
        const response = await fetch('/api/rounds?limit=10');
        if (!response.ok) throw new Error('Failed to load rounds');

        const data = await response.json();
        if (isMounted) {
          setRounds(data);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Could not load recent rounds.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadRounds();
    const intervalId = window.setInterval(loadRounds, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [refreshToken]);

  const handleReplay = (round: RoundLog) => {
    const path = parsePath(round.pathJson);
    if (!path || round.dropColumn === null) return;

    onReplayRound(path, round.dropColumn);
  };

  return (
    <aside className="card flex flex-col gap-md">
      <div>
        <h2 className="text-xl font-bold mb-2">Session Log</h2>
        <p className="text-sm text-muted">
          Replay recent deterministic drops from the saved path and drop column.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading rounds...</p>}
      {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {!isLoading && !error && rounds.length === 0 && (
        <p className="text-sm text-muted">No completed rounds yet.</p>
      )}

      <div className="flex flex-col gap-sm" style={{ maxHeight: '572px', overflowY: 'auto', paddingRight: '4px' }}>
        {rounds.map((round) => {
          const path = parsePath(round.pathJson);
          const canReplay = Boolean(path && round.dropColumn !== null);
          const createdAt = new Date(round.createdAt).toLocaleTimeString();

          return (
            <div
              key={round.id}
              className="p-sm rounded"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
            >
              <div className="flex justify-between items-center gap-sm">
                <div>
                  <div className="text-sm font-semibold">Bin {round.binIndex ?? '-'}</div>
                  <div className="text-sm text-muted">{createdAt}</div>
                </div>

                <div className="flex gap-sm">
                  {round.status === 'REVEALED' && (
                    <a
                      href={`/verify?roundId=${round.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn text-sm"
                      style={{
                        textDecoration: 'none',
                        borderColor: 'var(--color-success)',
                        color: 'var(--color-success)',
                      }}
                    >
                      Verify
                    </a>
                  )}
                  <button
                    className="btn text-sm"
                    onClick={() => handleReplay(round)}
                    disabled={!canReplay}
                  >
                    Replay
                  </button>
                </div>
              </div>

              <div className="text-sm text-muted mt-2">
                Drop column: {round.dropColumn ?? '-'} | Payout: {round.payoutMultiplier ?? '-'}x
              </div>
              <div className="text-sm text-muted">
                Bet: {round.betCents ?? '-'} cents | Status: {round.status}
              </div>
              <div className="text-sm font-mono text-muted break-all mt-1">
                {round.commitHex}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
