'use client';

interface ControlsProps {
  onDropBall: (clientSeed: string, dropColumn: number, betCents: number) => void;
  isReady: boolean; // False if currently dropping
  clientSeed: string;
  setClientSeed: (val: string) => void;
  dropColumn: number;
  setDropColumn: (val: number) => void;
  betCents: number;
  setBetCents: (val: number) => void;
  commitHex: string | null;
  serverSeed: string | null;
  statusText: string;
  isAsyncPending: boolean; // Indicates if API call is pending
}

export default function Controls({
  onDropBall,
  isReady,
  clientSeed,
  setClientSeed,
  dropColumn,
  setDropColumn,
  betCents,
  setBetCents,
  commitHex,
  serverSeed,
  statusText,
  isAsyncPending,
}: ControlsProps) {

  const disabled = !isReady || isAsyncPending;

  return (
    <div className="card flex flex-col gap-md">
      <h2 className="text-xl font-bold mb-2">Controls</h2>

      <div>
        <label>Bet Amount (Cents)</label>
        <input
          type="number"
          min="1"
          value={betCents}
          onChange={e => setBetCents(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={disabled}
        />
      </div>

      <div>
        <label>Client Seed</label>
        <input
          type="text"
          value={clientSeed}
          onChange={e => setClientSeed(e.target.value)}
          disabled={disabled}
          placeholder="e.g. hello-world"
        />
        <p className="text-sm text-muted mt-1">Changes the PRNG outcome.</p>
      </div>

      <div>
        <label>Drop Column (0-12)</label>
        <div className="flex items-center gap-sm">
          <button
            className="btn"
            onClick={() => setDropColumn(Math.max(0, dropColumn - 1))}
            disabled={disabled || dropColumn <= 0}
          >
            &larr;
          </button>

          <input
            type="number"
            min="0" max="12"
            value={dropColumn}
            onChange={e => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) setDropColumn(Math.max(0, Math.min(12, val)));
            }}
            disabled={disabled}
            style={{ textAlign: 'center' }}
          />

          <button
            className="btn"
            onClick={() => setDropColumn(Math.min(12, dropColumn + 1))}
            disabled={disabled || dropColumn >= 12}
          >
            &rarr;
          </button>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onDropBall(clientSeed, dropColumn, betCents)}
        disabled={disabled}
        style={{ padding: '16px', fontSize: '1.2rem', marginTop: '8px' }}
      >
        {isAsyncPending ? '...' : (isReady ? 'Drop Ball (Space / Enter)' : 'Round in Progress')}
      </button>

      <div className="mt-4 p-sm rounded" style={{ backgroundColor: 'rgba(0,0,0,0.3)', wordBreak: 'break-all' }}>
        <h3 className="text-md font-semibold text-color-secondary mb-2" style={{ color: 'var(--color-secondary)' }}>Status: {statusText}</h3>
        {isAsyncPending && <div className="text-sm text-warning" style={{ color: 'var(--color-warning)' }}>Spinner / Loading...</div>}

        <label className="mt-2">Commit Hash (SHA256)</label>
        <div className="text-sm font-mono text-muted">{commitHex || 'None yet'}</div>

        {serverSeed && (
          <>
            <label className="mt-2 text-success" style={{ color: 'var(--color-success)' }}>Revealed Server Seed</label>
            <div className="text-sm font-mono text-muted">{serverSeed}</div>
          </>
        )}
      </div>

    </div>
  );
}
