'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PlinkoBoard from './PlinkoBoard';
import type { DecisionTrace, Direction } from '@/lib/engine';

interface RoundResponse {
  id?: string;
  status?: string;
  serverSeed?: string | null;
  clientSeed?: string | null;
  nonce?: string | null;
  dropColumn?: number | null;
  commitHex?: string | null;
  combinedSeed?: string | null;
  pegMapHash?: string | null;
  binIndex?: number | null;
  pathJson?: string | null;
  error?: string;
}

interface VerificationCheck {
  field: string;
  expected: string | number | string[] | null;
  actual: string | number | string[] | null;
  match: boolean;
}

interface VerifyResult {
  commitHex: string;
  combinedSeed: string;
  pegMapHash: string;
  binIndex: number;
  path: Direction[];
  decisionTrace: DecisionTrace[];
  roundId?: string;
  checks?: VerificationCheck[];
  allMatch?: boolean;
  error?: string;
}

function parseStoredPath(pathJson: string | null | undefined): Direction[] | null {
  if (!pathJson) return null;

  try {
    const parsed = JSON.parse(pathJson);
    if (Array.isArray(parsed) && parsed.every((direction) => direction === 'L' || direction === 'R')) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function formatValue(value: VerificationCheck['expected']): string {
  if (Array.isArray(value)) return value.join(',');
  if (value === null) return 'missing';
  return String(value);
}

export default function VerifierForm() {
  const searchParams = useSearchParams();
  const initialRoundId = searchParams.get('roundId') ?? '';

  const [roundId, setRoundId] = useState(initialRoundId);
  const [serverSeed, setServerSeed] = useState('');
  const [clientSeed, setClientSeed] = useState('');
  const [nonce, setNonce] = useState('');
  const [dropColumn, setDropColumn] = useState('6');

  const [storedRound, setStoredRound] = useState<RoundResponse | null>(null);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [replayPath, setReplayPath] = useState<Direction[]>([]);
  const [isReplayAnimating, setIsReplayAnimating] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const queryRoundId = searchParams.get('roundId') ?? '';

    if (!queryRoundId) return;

    fetch(`/api/rounds/${queryRoundId}`)
      .then((res) => res.json())
      .then((data: RoundResponse) => {
        if (data && !data.error) {
          setStoredRound(data);
          setServerSeed(data.serverSeed || '');
          setClientSeed(data.clientSeed || '');
          setNonce(data.nonce || '');
          setDropColumn(data.dropColumn?.toString() || '6');

          const storedPath = parseStoredPath(data.pathJson);
          if (storedPath) setReplayPath(storedPath);

          if (!data.serverSeed) {
            setStatusText('Round is not REVEALED yet. Server seed is hidden.');
          }
        } else {
          setStatusText(data.error || 'Round not found.');
        }
      })
      .catch(() => setStatusText('Could not load round details.'));
  }, [searchParams]);

  const startReplay = (path: Direction[]) => {
    setReplayPath(path);
    setIsReplayAnimating(false);
    setReplayKey((key) => key + 1);
    window.setTimeout(() => setIsReplayAnimating(true), 0);
  };

  const handleVerify = async () => {
    try {
      setStatusText('Verifying deterministically...');
      setResult(null);

      const url = new URL(window.location.origin + '/api/verify');
      url.searchParams.set('serverSeed', serverSeed);
      url.searchParams.set('clientSeed', clientSeed);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('dropColumn', dropColumn);
      if (roundId.trim()) url.searchParams.set('roundId', roundId.trim());

      const res = await fetch(url);
      const data = await res.json() as VerifyResult;

      if (!res.ok) {
        setStatusText(`Error: ${data.error}`);
        return;
      }

      setResult(data);
      startReplay(data.path);

      if (roundId.trim()) {
        setStatusText(
          data.allMatch
            ? 'Verification successful: recomputed values match the stored round.'
            : 'Verification failed: one or more recomputed values differ from the stored round.'
        );
      } else {
        setStatusText('Verification complete: deterministic values recomputed.');
      }
    } catch (err) {
      console.error(err);
      setStatusText('An error occurred during verification.');
    }
  };

  return (
    <div className="card flex flex-col gap-md">
      <div>
        <label>Round ID (optional, enables stored-round checks)</label>
        <input
          type="text"
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
          placeholder="Paste a round id or use ?roundId=..."
        />
      </div>

      <div>
        <label>Server Seed (Revealed after round)</label>
        <input
          type="text"
          value={serverSeed}
          onChange={(e) => setServerSeed(e.target.value)}
          placeholder="64-character hex string"
        />
      </div>

      <div>
        <label>Client Seed</label>
        <input
          type="text"
          value={clientSeed}
          onChange={(e) => setClientSeed(e.target.value)}
        />
      </div>

      <div>
        <label>Nonce</label>
        <input
          type="text"
          value={nonce}
          onChange={(e) => setNonce(e.target.value)}
        />
      </div>

      <div>
        <label>Drop Column</label>
        <input
          type="text"
          value={dropColumn}
          onChange={(e) => setDropColumn(e.target.value)}
        />
      </div>

      {storedRound && (
        <div className="p-sm mt-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <label>Stored Round Snapshot</label>
          <div className="text-sm">Status: {storedRound.status ?? 'unknown'}</div>
          <div className="text-sm">Stored bin: {storedRound.binIndex ?? 'missing'}</div>
          <div className="font-mono text-sm break-all">Commit: {storedRound.commitHex ?? 'missing'}</div>
        </div>
      )}

      <button className="btn btn-primary mt-4" onClick={handleVerify}>
        Verify Mathematically
      </button>

      {statusText && (
        <div
          className={`p-md rounded mt-4 ${statusText.includes('Error') || statusText.includes('failed') ? 'text-danger' : 'text-success'}`}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <strong>{statusText}</strong>
        </div>
      )}

      {result && (
        <div className="p-sm mt-2 rounded flex flex-col gap-sm" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          {roundId.trim() && (
            <div className="text-lg font-bold" style={{ color: result.allMatch ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {result.allMatch ? '✅ PASS' : '❌ FAIL'} stored round comparison
            </div>
          )}

          {result.checks && (
            <div className="flex flex-col gap-xs">
              {result.checks.map((check) => (
                <div key={check.field} className="text-sm">
                  <strong style={{ color: check.match ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {check.match ? '✅ PASS' : '❌ FAIL'}
                  </strong>{' '}
                  {check.field}: expected <span className="font-mono">{formatValue(check.expected)}</span>, got{' '}
                  <span className="font-mono">{formatValue(check.actual)}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label>Recomputed Commit Hash</label>
            <div className="font-mono text-sm break-all">{result.commitHex}</div>
          </div>

          <div>
            <label>Combined Seed Hex (SHA-256)</label>
            <div className="font-mono text-sm break-all">{result.combinedSeed}</div>
          </div>

          <div>
            <label>Peg Map Hash</label>
            <div className="font-mono text-sm break-all">{result.pegMapHash}</div>
          </div>

          <div>
            <label>Result Bin Index</label>
            <div className="font-bold text-lg">{result.binIndex}</div>
          </div>

          <div>
            <label>Path (Directions)</label>
            <div className="font-mono text-sm break-all">{result.path.join(', ')}</div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <label>Deterministic Replay</label>
              <button className="btn text-sm" onClick={() => startReplay(result.path)}>
                Replay Again
              </button>
            </div>
            <PlinkoBoard
              key={replayKey}
              rows={12}
              path={replayPath}
              decisionTrace={result.decisionTrace}
              dropColumn={Number(dropColumn)}
              isAnimating={isReplayAnimating}
              onComplete={() => setIsReplayAnimating(false)}
              debugGrid
              disableConfetti
            />
          </div>
        </div>
      )}
    </div>
  );
}
