/**
 * xorshift32 PRNG — Provably fair random number generator
 *
 * Shift constants: 13, 17, 5 (classic xorshift32 variant)
 * Produces deterministic sequence from a 32-bit seed.
 *
 * Test vector validation (from assignment spec):
 *   First 5 values: 0.1106166649, 0.7625129214, 0.0439292176, 0.4578678815, 0.3438999297
 */

export type PRNG = () => number;

/**
 * Creates an xorshift32 PRNG seeded with the given 32-bit integer.
 * Returns a `rand()` function that produces floats in [0, 1).
 */
export function xorshift32(seed: number): PRNG {
  let state = seed >>> 0;

  return function rand(): number {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Extracts a 32-bit seed from combinedSeed hex string (first 4 bytes, big-endian).
 * Guards against seed=0 which would produce a constant zero sequence.
 *
 * xorshift32 with seed=0 produces a constant zero sequence, so we normalize seed=0 → 1.
 */
export function extractSeed(combinedSeed: string): number {
  const rawSeed = parseInt(combinedSeed.slice(0, 8), 16);
  return rawSeed === 0 ? 1 : rawSeed;
}
