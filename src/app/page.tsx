'use client';

import { useEffect, useRef, useState } from 'react';
import PlinkoBoard from '@/components/PlinkoBoard';
import Controls from '@/components/Controls';
import PaytableDisplay from '@/components/PaytableDisplay';
import SessionLog from '@/components/SessionLog';
import { useSoundManager } from '@/hooks/useSoundManager';
import type { DecisionTrace, Direction } from '@/lib/engine';

const SECRET_THEME_PHRASE = 'open sesame';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function getSecretPhraseProgress(buffer: string): number {
  for (let len = Math.min(buffer.length, SECRET_THEME_PHRASE.length); len > 0; len--) {
    if (SECRET_THEME_PHRASE.startsWith(buffer.slice(-len))) {
      return len;
    }
  }

  return 0;
}

export default function Home() {
  const { playPegTick, playLanding, toggleMute, isMuted } = useSoundManager();

  // Settings state
  const [clientSeed, setClientSeed] = useState('plinko-master-99');
  const [dropColumn, setDropColumn] = useState(6);
  const [betCents, setBetCents] = useState(100);

  // Game state
  const [isReady, setIsReady] = useState(true);
  const [isAsyncPending, setIsAsyncPending] = useState(false);
  const [statusText, setStatusText] = useState('Ready to play!');
  const [commitHex, setCommitHex] = useState<string | null>(null);
  const [serverSeed, setServerSeed] = useState<string | null>(null);

  // Animation state
  const [path, setPath] = useState<Direction[]>([]);
  const [decisionTrace, setDecisionTrace] = useState<DecisionTrace[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeBinIndex, setActiveBinIndex] = useState<number | null>(null);
  const [roundsRefreshToken, setRoundsRefreshToken] = useState(0);

  // Easter Eggs
  const [tiltMode, setTiltMode] = useState(false);
  const [debugGrid, setDebugGrid] = useState(false);
  const [isSecretTheme, setIsSecretTheme] = useState(false);
  const [historyBins, setHistoryBins] = useState<number[]>([]);
  const [isGoldenBall, setIsGoldenBall] = useState(false);
  const lastRoundIdRef = useRef<string | null>(null);
  const lastBinIndexRef = useRef<number | undefined>(undefined);

  // Keyboard Shortcuts & Secret Theme
  useEffect(() => {
    let keyBuffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 1. Secret Theme "open sesame"
      if (e.key.length === 1 || e.key === ' ') {
        keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-SECRET_THEME_PHRASE.length);
      } else {
        keyBuffer = '';
      }

      if (keyBuffer.endsWith(SECRET_THEME_PHRASE)) {
        setIsSecretTheme(true);
        keyBuffer = '';
        if (e.key === ' ') e.preventDefault();
        return;
      }

      if (getSecretPhraseProgress(keyBuffer) > 0) {
        if (e.key === ' ') e.preventDefault();
        return;
      }

      // 2. Gameplay Shortcuts
      if (e.key === 'a' || e.key === 'ArrowLeft') {
        setDropColumn(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'd' || e.key === 'ArrowRight') {
        setDropColumn(prev => Math.min(12, prev + 1));
      }
      if (e.key === ' ' || e.key === 'Enter') {
        // Prevent scroll on space
        if (e.key === ' ') e.preventDefault();
        if (isReady && !isAsyncPending && !isAnimating) {
          startRound(clientSeed, dropColumn, betCents);
        }
      }
      if (e.key.toLowerCase() === 't') setTiltMode(prev => !prev);
      if (e.key.toLowerCase() === 'g') setDebugGrid(prev => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReady, isAsyncPending, isAnimating, clientSeed, dropColumn, betCents]);


  const startRound = async (currentClientSeed: string, currentDropColumn: number, currentBetCents: number) => {
    try {
      setIsReady(false);
      setIsAsyncPending(true);
      setActiveBinIndex(null);
      setServerSeed(null);
      setStatusText('Committing round...');

      // 1. Commit phase
      const commitRes = await fetch('/api/rounds/commit', { method: 'POST' });
      if (!commitRes.ok) throw new Error('Failed to commit');
      const commitData = await commitRes.json();
      const roundId = commitData.roundId;
      setCommitHex(commitData.commitHex);

      // 2. Start phase (simulation occurs server-side)
      setStatusText('Simulating drop...');
      const startRes = await fetch(`/api/rounds/${roundId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSeed: currentClientSeed,
          dropColumn: currentDropColumn,
          betCents: currentBetCents
        }),
      });

      if (!startRes.ok) throw new Error('Failed to start');
      const startData = await startRes.json();

      // We have the deterministic path and result, let's animate it
      setPath(startData.path);
      setDecisionTrace(startData.decisionTrace ?? []);
      setIsAsyncPending(false);
      setStatusText('Dropping...');
      setIsAnimating(true);

      // Store roundId for reveal later
      lastRoundIdRef.current = roundId;
      lastBinIndexRef.current = startData.binIndex;

    } catch (err) {
      console.error(err);
      setStatusText('Error occurred during game flow.');
      setIsReady(true);
      setIsAsyncPending(false);
    }
  };

  const handleAnimationComplete = async () => {
    setIsAnimating(false);
    setIsReady(true);

    const roundId = lastRoundIdRef.current;
    const binIndex = lastBinIndexRef.current;
    if (binIndex !== undefined) {
      setActiveBinIndex(binIndex);
    }

    if (roundId && binIndex !== undefined) {
      setStatusText('Revealing server seed...');
      // 3. Reveal phase
      try {
        const revealRes = await fetch(`/api/rounds/${roundId}/reveal`, { method: 'POST' });
        if (revealRes.ok) {
          const data = await revealRes.json();
          setServerSeed(data.serverSeed);
          setStatusText(`Round complete! Ball landed in bin ${binIndex}.`);

          // Easter Egg: Golden Ball tracking
          const newHistory = [...historyBins, binIndex].slice(-3);
          setHistoryBins(newHistory);
          if (newHistory.length === 3 && newHistory.every(b => b === 6)) {
            setIsGoldenBall(true);
          } else {
            setIsGoldenBall(false);
          }
          setRoundsRefreshToken((token) => token + 1);
          if (isSecretTheme) setIsSecretTheme(false);
        }
      } catch {
        setStatusText('Finished animation but failed to reveal server seed.');
        if (isSecretTheme) setIsSecretTheme(false);
      }
    } else if (isSecretTheme) {
      setIsSecretTheme(false);
    }
  };

  const handleReplay = (historicalPath: Direction[], historicalDropColumn: number) => {
    if (!isReady || isAsyncPending) return;

    // Set up replay
    setPath(historicalPath);
    setDecisionTrace([]);
    setDropColumn(historicalDropColumn);
    setActiveBinIndex(null);
    setStatusText('Replaying historical round...');
    setIsReady(false);
    setIsAnimating(true);

    // Dummy cleanup for replay
    lastRoundIdRef.current = null;
    const computedCol = historicalPath.filter(d => d === 'R').length;
    lastBinIndexRef.current = computedCol;
  };

  return (
    <main className="app-main flex flex-col items-center gap-lg p-lg" style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      <header className="app-header flex justify-between items-center w-full max-w-6xl">
        <h1 className="text-xl font-bold flex items-center gap-sm">
          <span>🟣</span> Provably Fair Plinko
        </h1>

        <div className="flex gap-md">
          <button className="btn text-sm" onClick={toggleMute}>
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>

          <div className="flex gap-xs">
            <button className="btn text-sm" onClick={() => setDebugGrid(g => !g)}>
              Grid
            </button>
            <button className="btn text-sm" style={{ borderColor: tiltMode ? 'var(--color-danger)' : undefined }} onClick={() => setTiltMode(t => !t)}>
              TILT
            </button>
          </div>
        </div>
      </header>

      <div className="w-full flex justify-center mt-4">
        <PaytableDisplay activeBinIndex={activeBinIndex} />
      </div>

      <div className="game-layout flex gap-lg w-full max-w-6xl" style={{ alignItems: 'flex-start' }}>

        {/* Left sidebar: Controls */}
        <div className="side-panel" style={{ flex: '0 0 300px' }}>
          <Controls
            onDropBall={startRound}
            isReady={isReady}
            isAsyncPending={isAsyncPending}
            clientSeed={clientSeed}
            setClientSeed={setClientSeed}
            dropColumn={dropColumn}
            setDropColumn={setDropColumn}
            betCents={betCents}
            setBetCents={setBetCents}
            commitHex={commitHex}
            serverSeed={serverSeed}
            statusText={statusText}
          />
        </div>

        {/* Center: Plinko Board */}
        <div className="board-panel" style={{ flex: '1 1 auto', position: 'relative' }}>
          <PlinkoBoard
            rows={12}
            path={path}
            decisionTrace={decisionTrace}
            dropColumn={dropColumn}
            onComplete={handleAnimationComplete}
            playPegTick={playPegTick}
            playLanding={playLanding}
            tiltMode={tiltMode}
            debugGrid={debugGrid}
            isAnimating={isAnimating}
            isGoldenBall={isGoldenBall}
            isSecretTheme={isSecretTheme}
          />
        </div>

        {/* Right sidebar: Session Log */}
        <div className="side-panel" style={{ flex: '0 0 350px' }}>
          <SessionLog onReplayRound={handleReplay} refreshToken={roundsRefreshToken} />
        </div>

      </div>
    </main>
  );
}
