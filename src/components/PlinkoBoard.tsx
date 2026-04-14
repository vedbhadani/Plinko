import { useEffect, useRef, useState } from 'react';
import styles from './PlinkoBoard.module.css';
import { Direction } from '@/lib/engine';

interface PlinkoBoardProps {
  rows?: number;
  path?: Direction[]; // The deterministic path the ball should take
  dropColumn?: number; // Where the ball was dropped
  onComplete?: () => void;
  playPegTick?: () => void;
  playLanding?: () => void;
  tiltMode?: boolean; // Easter Egg: TILT mode
  debugGrid?: boolean; // Easter Egg: Debug grid
  isAnimating?: boolean;
}

export default function PlinkoBoard({
  rows = 12,
  path = [],
  dropColumn = 6,
  onComplete,
  playPegTick,
  playLanding,
  tiltMode = false,
  debugGrid = false,
  isAnimating = false,
}: PlinkoBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Constants
  const BINS = rows + 1; // 13 bins for 12 rows
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let dpr = window.devicePixelRatio || 1;
    let width = container.clientWidth;
    // Add extra height for bins
    let height = 40 + (rows + 1) * V_SPACING + 60; 

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      width = container.clientWidth;
      
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        draw(ctx);
      }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, width, height);

      // Draw Pegs
      ctx.fillStyle = '#00cec9'; // Secondary color
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= r; c++) {
          const { x, y } = getPegPosition(r, c, width);
          
          if (debugGrid) {
             ctx.font = '10px sans-serif';
             ctx.fillStyle = 'rgba(255,255,255,0.5)';
             ctx.fillText(`(${r},${c})`, x - 15, y - 10);
             ctx.fillStyle = '#00cec9';
          }
          
          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Bins
      const startBinX = width / 2 - (rows * H_SPACING) / 2;
      for (let i = 0; i <= rows; i++) {
        const x = startBinX + i * H_SPACING;
        const y = 40 + rows * V_SPACING + 30; // Below last row
        
        // Bin dividers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x - H_SPACING/2, y - 20, 2, 40);
        
        if (i === rows) {
          ctx.fillRect(x + H_SPACING/2, y - 20, 2, 40); // cap right side
        }
      }

      // Draw Ball if dropping
      if (state.current.isDropping || isAnimating) {
        ctx.fillStyle = '#e17055'; // Danger color (red/orange)
        ctx.beginPath();
        ctx.arc(state.current.x, state.current.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fdcb6e'; // Glow
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.current.x, state.current.y, BALL_RADIUS + 2, 0, Math.PI * 2);
        ctx.stroke();
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
        // Speed: complete one row drop per ~100-150ms
        const dropSpeed = dt * 0.008; 
        s.progress += dropSpeed;

        if (s.progress >= 1) {
          s.progress = 0;
          s.currentRow++;
          if (s.currentRow > 0 && s.currentRow <= rows) {
            // we hit a peg
            playPegTick?.();
            const dir = s.path[s.currentRow - 1]; // decision made at row above
            if (dir === 'R') {
              s.currentCol++;
            }
          }
        }

        if (s.currentRow > rows) {
          // Finished dropping into bin
          s.isDropping = false;
          playLanding?.();
          onComplete?.();
        } else {
          // Interpolate position
          let startPos, endPos;
          
          if (s.currentRow === -1) {
            // Drop directly from above the top center peg
            startPos = { x: width / 2, y: 0 };
            endPos = getPegPosition(0, 0, width);
          } else {
            // Interpolate between current peg and next destination peg/bin
            startPos = getPegPosition(s.currentRow, s.currentCol, width);
            
            if (s.currentRow < rows) {
              const dir = s.path[s.currentRow];
              const nextCol = dir === 'R' ? s.currentCol + 1 : s.currentCol;
              endPos = getPegPosition(s.currentRow + 1, nextCol, width);
            } else {
              // Falling into bin
              endPos = getPegPosition(s.currentRow, s.currentCol, width);
              endPos.y += 30; // drop into bin
            }
          }

          // Ease in-out function for bouncing effect
          // Simulating gravity curve
          const easeY = Math.pow(s.progress, 1.5); 
          const easeX = s.progress;

          // Add a bounce arc
          let bounceY = 0;
          if (s.currentRow >= 0 && s.currentRow < rows) {
               bounceY = Math.sin(s.progress * Math.PI) * -15; 
          }

          s.x = startPos.x + (endPos.x - startPos.x) * easeX;
          s.y = startPos.y + (endPos.y - startPos.y) * Math.min(easeY, 1) + bounceY;
        }
        
        draw(ctx);
      } else if (ctx) {
         draw(ctx);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    if (isAnimating && !state.current.isDropping) {
        // Start animation
        state.current = {
            x: 0,
            y: 0,
            progress: 0,
            currentRow: -1,
            currentCol: 0,
            isDropping: true,
            path: path,
        };
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [rows, debugGrid, playPegTick, playLanding, onComplete, isAnimating, path, dropColumn]);

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
