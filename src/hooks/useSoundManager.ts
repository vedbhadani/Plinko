'use client';

import { useRef, useState } from 'react';

type AudioContextConstructor = typeof AudioContext;

interface WebKitAudioWindow extends Window {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
}

export function useSoundManager() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('plinko_muted') === 'true'
  );

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('plinko_muted', String(next));
      return next;
    });
  };

  const getCtx = () => {
    // Lazy init of AudioContext requires user gesture
    if (!audioCtxRef.current) {
      if (typeof window !== 'undefined') {
        const audioWindow = window as WebKitAudioWindow;
        const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioCtxRef.current = new AudioContextClass();
      }
    }

    // Resume context if suspended (browser autoplay policy)
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  };

  const playPegTick = () => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Randomize frequency slightly for more organic tick sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400 + Math.random() * 200, ctx.currentTime);

    // Fast attack and fast release
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playLanding = () => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;

    // A quick ascending tone sequence for a "tada" effect
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'square';

    // Sequence
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E5

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gainNode.gain.setValueAtTime(0.2, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.6);
  };

  return { playPegTick, playLanding, toggleMute, isMuted };
}
