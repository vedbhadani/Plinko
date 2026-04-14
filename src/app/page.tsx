'use client';

import { useState } from 'react';
import PlinkoBoard from '@/components/PlinkoBoard';
import Controls from '@/components/Controls';
import PaytableDisplay from '@/components/PaytableDisplay';
import SessionLog from '@/components/SessionLog';
import { useSoundManager } from '@/hooks/useSoundManager';
import { Direction } from '@/lib/engine';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeBinIndex, setActiveBinIndex] = useState<number | null>(null);

  // Easter Eggs
  const [tiltMode, setTiltMode] = useState(false);
  const [debugGrid, setDebugGrid] = useState(false);

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
      setIsAsyncPending(false);
      setStatusText('Dropping...');
      setIsAnimating(true);
      
      // Store roundId for reveal later
      (window as any).__lastRoundId = roundId;
      (window as any).__lastBinIndex = startData.binIndex;

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
    
    const roundId = (window as any).__lastRoundId;
    const binIndex = (window as any).__lastBinIndex;
    if (binIndex !== undefined) {
      setActiveBinIndex(binIndex);
    }

    if (roundId) {
      setStatusText('Revealing server seed...');
      // 3. Reveal phase
      try {
        const revealRes = await fetch(`/api/rounds/${roundId}/reveal`, { method: 'POST' });
        if (revealRes.ok) {
          const data = await revealRes.json();
          setServerSeed(data.serverSeed);
          setStatusText(`Round complete! Ball landed in bin ${binIndex}.`);
        }
      } catch (err) {
        setStatusText('Finished animation but failed to reveal server seed.');
      }
    }
  };

  const handleReplay = (historicalPath: Direction[], historicalDropColumn: number) => {
    if (!isReady || isAsyncPending) return;
    
    // Set up replay
    setPath(historicalPath);
    setDropColumn(historicalDropColumn);
    setActiveBinIndex(null);
    setStatusText('Replaying historical round...');
    setIsReady(false);
    setIsAnimating(true);
    
    // Dummy cleanup for replay
    (window as any).__lastRoundId = null;
    const computedCol = historicalPath.filter(d => d === 'R').length;
    (window as any).__lastBinIndex = computedCol;
  };

  return (
    <main className="flex flex-col items-center gap-lg p-lg" style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      <header className="flex justify-between items-center w-full max-w-6xl">
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
            <button className="btn text-sm" style={{borderColor: tiltMode ? 'var(--color-danger)' : undefined}} onClick={() => setTiltMode(t => !t)}>
              TILT
            </button>
          </div>
        </div>
      </header>

      <div className="w-full flex justify-center mt-4">
        <PaytableDisplay activeBinIndex={activeBinIndex} />
      </div>

      <div className="flex gap-lg w-full max-w-6xl" style={{ alignItems: 'flex-start' }}>
        
        {/* Left sidebar: Controls */}
        <div style={{ flex: '0 0 300px' }}>
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
        <div style={{ flex: '1 1 auto', position: 'relative' }}>
          <PlinkoBoard 
            rows={12}
            path={path}
            dropColumn={dropColumn}
            onComplete={handleAnimationComplete}
            playPegTick={playPegTick}
            playLanding={playLanding}
            tiltMode={tiltMode}
            debugGrid={debugGrid}
            isAnimating={isAnimating}
          />
        </div>

        {/* Right sidebar: Session Log */}
        <div style={{ flex: '0 0 350px' }}>
          <SessionLog onReplayRound={handleReplay} />
        </div>

      </div>
    </main>
  );
}
