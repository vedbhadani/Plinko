/**
 * PRNG Test — VALIDATION GATE
 *
 * These tests MUST pass before any other code is written.
 * Uses the exact test vectors from the assignment spec.
 */

import { describe, it, expect } from 'vitest';
import { xorshift32, extractSeed } from '../lib/prng';
import { computeCombinedSeed } from '../lib/hash';

describe('xorshift32 PRNG', () => {
  // Assignment test vector inputs
  const serverSeed =
    'b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc';
  const nonce = '42';
  const clientSeed = 'candidate-hello';

  it('produces correct first 5 values from assignment test vectors', () => {
    const combinedSeed = computeCombinedSeed(serverSeed, clientSeed, nonce);
    const seed = extractSeed(combinedSeed);
    expect(seed).toBe(3789414263);
    const rand = xorshift32(seed);

    const expected = [
      0.1106166649,
      0.7625129214,
      0.0439292176,
      0.4578678815,
      0.3438999297,
    ];

    const actual = [];
    for (let i = 0; i < 5; i++) {
      // Round to 10 decimal places for comparison (matching assignment precision)
      actual.push(parseFloat(rand().toFixed(10)));
    }

    expect(actual).toEqual(expected);
  });

  it('is deterministic — same seed produces same sequence', () => {
    const rand1 = xorshift32(12345);
    const rand2 = xorshift32(12345);

    const seq1 = Array.from({ length: 100 }, () => rand1());
    const seq2 = Array.from({ length: 100 }, () => rand2());

    expect(seq1).toEqual(seq2);
  });

  it('produces values in [0, 1)', () => {
    const rand = xorshift32(42);

    for (let i = 0; i < 10000; i++) {
      const val = rand();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('handles seed=0 edge case via extractSeed', () => {
    // A combinedSeed starting with "00000000" would give seed=0
    const seed = extractSeed('00000000abcdef1234567890abcdef12');
    expect(seed).toBe(1); // normalized to 1

    // Verify it produces valid output
    const rand = xorshift32(seed);
    const val = rand();
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  it('different seeds produce different sequences', () => {
    const rand1 = xorshift32(1);
    const rand2 = xorshift32(2);

    const val1 = rand1();
    const val2 = rand2();

    expect(val1).not.toBe(val2);
  });
});
