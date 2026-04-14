/**
 * Plinko Paytable — Symmetric multipliers for 13 bins (0..12)
 *
 * Edge bins have the highest multipliers (classic Plinko).
 * Center bin has the lowest multiplier.
 */

export const PAYTABLE: readonly number[] = [
  110, 41, 10, 5, 3, 1.5, 1, 1.5, 3, 5, 10, 41, 110,
] as const;

/**
 * Returns the payout multiplier for a given bin index.
 * @param binIndex - Landing bin (0..12)
 */
export function getMultiplier(binIndex: number): number {
  if (binIndex < 0 || binIndex > 12) {
    throw new Error(`Invalid binIndex: ${binIndex}. Must be 0..12`);
  }
  return PAYTABLE[binIndex];
}
