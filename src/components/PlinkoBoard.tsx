'use client';

import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import styles from './PlinkoBoard.module.css';
import type { DecisionTrace, Direction } from '@/lib/engine';
import { PAYTABLE } from '@/lib/paytable';

interface PlinkoBoardProps {
  rows?: number;
  path?: Direction[]; // The deterministic path the ball should take
  decisionTrace?: DecisionTrace[]; // Per-row RNG/debug trace from the deterministic engine
  dropColumn?: number; // Where the ball was dropped
  onComplete?: () => void;
  playPegTick?: () => void;
  playLanding?: () => void;
  tiltMode?: boolean; // Easter Egg: TILT mode
  debugGrid?: boolean; // Easter Egg: Debug grid
  isAnimating?: boolean;
  isGoldenBall?: boolean; // Easter Egg: Golden Ball
  isSecretTheme?: boolean; // Easter Egg: Secret Theme
  disableConfetti?: boolean; // Option to disable the blast animation
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
}

export default function PlinkoBoard({
  rows = 12,
  path = [],
  decisionTrace = [],
  dropColumn = 6,
  onComplete,
  playPegTick,
  playLanding,
  tiltMode = false,
  debugGrid = false,
  isAnimating = false,
  isGoldenBall = false,
  isSecretTheme = false,
  disableConfetti = false,
}: PlinkoBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Constants
  const PEG_RADIUS = 4;
  const BALL_RADIUS = 8;
  const V_SPACING = 40; // Vertical space between rows
  const H_SPACING = 40; // Horizontal space between pegs

  // Animation state ref to avoid stale closures in RAF
  const state = useRef({
    x: 0,
    y: 0,
    progress: 0, // 0 to 1 between rows
    currentRow: -1, // -1 means above the board
    currentCol: 0,
    isDropping: false,
    path: [] as Direction[],
    particles: [] as Particle[],
    lastLandedBin: -1,
    pulseProgress: 0,
    trail: [] as { x: number, y: number }[],
  });

  // Calculate pixel coordinates of a peg
  const getPegPosition = (row: number, col: number, width: number) => {
    // Top peg is at row 0, col 0. But we visually center it.
    // For row 0 (1 peg), col goes from 0..0
    // For row 12 (13 pegs, actually bins), col goes from 0..12
    const y = 40 + row * V_SPACING;
    // Center it horizontally
    const rowWidth = row * H_SPACING;
    const startX = width / 2 - rowWidth / 2;
    const x = startX + col * H_SPACING;
    return { x, y };
  };

  const getDropStartX = useCallback((width: number) => {
    const startBinX = width / 2 - (rows * H_SPACING) / 2;
    return startBinX + dropColumn * H_SPACING;
  }, [dropColumn, rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let dpr = window.devicePixelRatio || 1;
    let width = container.clientWidth;
    // Add extra height for bins (16px gap + 48px bin height + 10px padding)
    const height = 40 + (rows + 1) * V_SPACING + 74;

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx);
      }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, width, height);

      // Secret Theme: Dungeon background
      if (isSecretTheme) {
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0, 0, width, height);

        const gradient = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, width / 2);
        gradient.addColorStop(0, 'rgba(255,165,0,0.05)'); // Torch glow
        gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw Pegs
      ctx.fillStyle = isSecretTheme ? '#d35400' : '#00cec9'; // Torch orange or Cyber cyan
      const nextDebugRow = state.current.isDropping
        ? Math.max(0, Math.min(rows - 1, state.current.currentRow + 1))
        : 0;
      const dropStartX = getDropStartX(width);

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dropStartX, 6);
      ctx.lineTo(dropStartX, 26);
      ctx.stroke();

      ctx.fillStyle = isSecretTheme ? '#e67e22' : '#fdcb6e';
      ctx.beginPath();
      ctx.moveTo(dropStartX - 8, 6);
      ctx.lineTo(dropStartX + 8, 6);
      ctx.lineTo(dropStartX, 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isSecretTheme ? '#d35400' : '#00cec9';

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= r; c++) {
          const { x, y } = getPegPosition(r, c, width);

          if (debugGrid) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillText(`(${r},${c})`, x - 15, y - 10);

            const trace = decisionTrace.find((entry) => entry.row === r && entry.pegIndex === c);
            if (trace && trace.row === nextDebugRow) {
              ctx.fillStyle = '#fdcb6e';
              ctx.fillText(`rnd ${trace.rnd.toFixed(4)}`, x + 8, y + 4);
              ctx.fillText(`bias ${trace.adjustedBias.toFixed(4)} -> ${trace.direction}`, x + 8, y + 16);
            }

            ctx.fillStyle = isSecretTheme ? '#d35400' : '#00cec9';
          }

          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Bins
      const startBinX = width / 2 - (rows * H_SPACING) / 2;
      const BIN_HEIGHT = 48;
      const BIN_Y_TOP = 40 + rows * V_SPACING + 16;

      for (let i = 0; i <= rows; i++) {
        const x = startBinX + i * H_SPACING;
        const binLeft = x - H_SPACING / 2 + 1;
        const binWidth = H_SPACING - 2;

        // Color-coded bin background
        const mult = PAYTABLE[i];
        let binColor: string;
        if (mult >= 100) binColor = 'rgba(225, 112, 85, 0.25)';       // red — jackpot
        else if (mult >= 10) binColor = 'rgba(253, 203, 110, 0.25)';  // yellow — high
        else if (mult >= 3) binColor = 'rgba(0, 184, 148, 0.20)';     // green — mid
        else binColor = 'rgba(108, 92, 231, 0.20)';                   // purple — low

        ctx.fillStyle = binColor;
        ctx.fillRect(binLeft, BIN_Y_TOP, binWidth, BIN_HEIGHT);

        // Bin Pulse (landed highlight)
        if (state.current.lastLandedBin === i && state.current.pulseProgress > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${state.current.pulseProgress * 0.25})`;
          ctx.fillRect(binLeft, BIN_Y_TOP, binWidth, BIN_HEIGHT);
        }

        // Bin dividers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x - H_SPACING / 2, BIN_Y_TOP, 2, BIN_HEIGHT);
        if (i === rows) {
          ctx.fillRect(x + H_SPACING / 2, BIN_Y_TOP, 2, BIN_HEIGHT); // cap right
        }

        // Payout label
        const label = mult >= 1 ? `${mult}x` : `${mult}x`;
        const isActive = state.current.lastLandedBin === i && state.current.pulseProgress > 0;
        const fontSize = H_SPACING <= 36 ? 8 : 10;
        ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isActive ? '#ffffff' : (
          mult >= 100 ? '#e17055' :
          mult >= 10  ? '#fdcb6e' :
          mult >= 3   ? '#00b894' :
                        '#a29bfe'
        );
        ctx.fillText(label, x, BIN_Y_TOP + BIN_HEIGHT / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      // Draw Trail (for Golden Ball)
      if (isGoldenBall && state.current.isDropping && !reducedMotion) {
        state.current.trail.forEach((p, idx) => {
          const alpha = idx / state.current.trail.length;
          ctx.fillStyle = `rgba(253, 203, 110, ${alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, BALL_RADIUS * (0.5 + alpha * 0.5), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Ball if dropping
      if (state.current.isDropping || isAnimating) {
        ctx.fillStyle = isGoldenBall ? '#fdcb6e' : (isSecretTheme ? '#e67e22' : '#e17055');
        ctx.beginPath();
        ctx.arc(state.current.x, state.current.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isGoldenBall ? '#ffffff' : (isSecretTheme ? '#f39c12' : '#fdcb6e');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.current.x, state.current.y, BALL_RADIUS + 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Particles (Confetti)
      if (!reducedMotion) {
        state.current.particles.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1.0;
      }
    };

    // Initial resize & draw
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let lastTime = 0;

    // Animation loop
    const animate = (time: number) => {
      if (!lastTime) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;

      const s = state.current;
      const ctx = canvas.getContext('2d');

      if (s.isDropping && ctx) {
        // Drop physics
        const dropSpeed = reducedMotion ? 1 : dt * 0.008;
        s.progress += dropSpeed;

        // Trail management
        if (isGoldenBall && !reducedMotion) {
          s.trail.push({ x: s.x, y: s.y });
          if (s.trail.length > 20) s.trail.shift();
        }

        if (s.progress >= 1) {
          s.progress = 0;
          s.currentRow++;
          if (s.currentRow > 0 && s.currentRow <= rows) {
            playPegTick?.();
            const dir = s.path[s.currentRow - 1];
            if (dir === 'R') {
              s.currentCol++;
            }
          }
        }

        if (s.currentRow > rows) {
          // Finished dropping into bin
          s.isDropping = false;
          s.lastLandedBin = s.currentCol;
          s.pulseProgress = 1.0;

          // Trigger Confetti
          if (!reducedMotion && !disableConfetti) {
            const canvasRect = canvas.getBoundingClientRect();
            const viewportWidth = Math.max(window.innerWidth, 1);
            const viewportHeight = Math.max(window.innerHeight, 1);
            const confettiOriginX = Math.max(0, Math.min(1, (canvasRect.left + s.x) / viewportWidth));
            const confettiOriginY = Math.max(0, Math.min(1, (canvasRect.top + s.y) / viewportHeight));

            confetti({
              particleCount: 80,
              spread: 70,
              origin: {
                x: confettiOriginX,
                y: confettiOriginY,
              },
            });

            const colors = ['#6c5ce7', '#00cec9', '#00b894', '#fdcb6e', '#e17055'];
            for (let i = 0; i < 40; i++) {
              s.particles.push({
                x: s.x,
                y: s.y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 1) * 8,
                size: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                life: 1.0
              });
            }
          }

          playLanding?.();
          onComplete?.();
        } else {
          // Interpolate position
          let startPos, endPos;

          if (s.currentRow === -1) {
            startPos = { x: getDropStartX(width), y: 0 };
            endPos = getPegPosition(0, 0, width);
          } else {
            startPos = getPegPosition(s.currentRow, s.currentCol, width);

            if (s.currentRow < rows) {
              const dir = s.path[s.currentRow];
              const nextCol = dir === 'R' ? s.currentCol + 1 : s.currentCol;
              endPos = getPegPosition(s.currentRow + 1, nextCol, width);
            } else {
              endPos = getPegPosition(s.currentRow, s.currentCol, width);
              endPos.y += 40; // drop into bin centre
            }
          }

          const easeY = Math.pow(s.progress, 1.5);
          const easeX = s.progress;
          let bounceY = 0;
          if (!reducedMotion && s.currentRow >= 0 && s.currentRow < rows) {
            bounceY = Math.sin(s.progress * Math.PI) * -15;
          }

          s.x = startPos.x + (endPos.x - startPos.x) * easeX;
          s.y = startPos.y + (endPos.y - startPos.y) * Math.min(easeY, 1) + bounceY;
        }
      }

      // Update Particles
      if (!reducedMotion) {
        s.particles.forEach((p, idx) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // gravity
          p.life -= 0.02;
          p.alpha = Math.max(0, p.life);
          if (p.life <= 0) s.particles.splice(idx, 1);
        });
      }

      // Update Pulse
      if (s.pulseProgress > 0) {
        s.pulseProgress -= 0.03;
      }

      draw(ctx!);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    if (isAnimating && !state.current.isDropping) {
      // Start animation
      state.current = {
        ...state.current,
        x: 0,
        y: 0,
        progress: 0,
        currentRow: -1,
        currentCol: 0,
        isDropping: true,
        path: path,
        trail: [], // Reset trail for new ball
        // particles and pulseProgress are handled by the animate loop
      };
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rows, debugGrid, playPegTick, playLanding, onComplete, isAnimating, path, decisionTrace, dropColumn, isGoldenBall, isSecretTheme, getDropStartX]);

  return (
    <div
      className={`${styles.boardContainer} card ${tiltMode ? styles.tiltMode : ''}`}
      ref={containerRef}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {tiltMode && <div className={styles.tiltOverlay}>TILT</div>}
    </div>
  );
}
