import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Direction } from '@/lib/engine';

interface RoundLog {
  id: string;
  createdAt: string;
  binIndex: number;
  payoutMultiplier: number;
  betCents: number;
  commitHex: string;
  pathJson?: any;
}

interface SessionLogProps {
  onReplayRound?: (path: Direction[], dropColumn: number) => void;
}

export default function SessionLog({ onReplayRound }: SessionLogProps) {
  const [rounds, setRounds] = useState<RoundLog[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  const fetchRounds = async () => {
    try {
      const res = await fetch('/api/rounds?limit=20');
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
      }
    } catch(err) {}
  };

  useEffect(() => {
    fetchRounds();
    
    let interval: NodeJS.Timeout | null = null;
    if (isPolling) {
      interval = setInterval(fetchRounds, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPolling]);

  const downloadCSV = async () => {
    try {
      const res = await fetch('/api/rounds?limit=500&format=csv');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plinko-rounds-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download CSV', err);
    }
  };

  const handleReplay = (round: RoundLog) => {
    if (onReplayRound && round.pathJson && Array.isArray(round.pathJson)) {
      // Assuming a default drop column of 6 for historical replays if not available
      onReplayRound(round.pathJson as Direction[], 6);
    }
  };

  return (
    <div className="card flex flex-col gap-sm" style={{ maxHeight: '600px', overflowY: 'auto' }}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-xs">
          <h2 className="text-xl font-bold">Session Log</h2>
          {isPolling && (
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)', animation: 'flash 1s infinite' }}></div>
          )}
        </div>
        
        <div className="flex gap-sm">
          <button 
            className="btn text-sm" 
            style={{ padding: '4px 8px' }}
            onClick={() => setIsPolling(!isPolling)}
          >
            {isPolling ? 'Pause' : 'Resume'}
          </button>
          
          <button 
            className="btn text-sm" 
            style={{ padding: '4px 8px', backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}
            onClick={downloadCSV}
          >
            Export CSV
          </button>
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="text-muted text-center p-md">No rounds played yet.</div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rounds.map((round) => (
            <div key={round.id} className="p-sm rounded flex flex-col gap-xs" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex justify-between">
                <span className="font-semibold">{new Date(round.createdAt).toLocaleTimeString()}</span>
                <span className={`font-bold ${round.payoutMultiplier >= 10 ? 'text-danger' : round.payoutMultiplier >= 2 ? 'text-warning' : 'text-muted'}`}>
                  {round.payoutMultiplier}x
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted">
                <span>Bin: {round.binIndex}</span>
                <span>Payout: {(round.betCents * round.payoutMultiplier / 100).toFixed(2)}$</span>
              </div>
              <div className="flex gap-sm mt-2">
                <Link href={`/verify?roundId=${round.id}`} className="btn text-sm" style={{ padding: '2px 8px', fontSize: '12px' }}>
                  Verify
                </Link>
                {round.pathJson && (
                    <button className="btn text-sm" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleReplay(round)}>
                       Replay
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
