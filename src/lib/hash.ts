/**
 * SHA-256 hashing helpers (synchronous)
 *
 * All hashing uses UTF-8 encoding explicitly to ensure cross-environment determinism.
 * Uses Node.js crypto module only — no Web Crypto API.
 */

import { createHash } from 'crypto';

/**
 * Computes SHA-256 hash of input string, returns hex-encoded result.
 * Uses explicit UTF-8 encoding for cross-environment determinism.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Computes commit hash: SHA256(serverSeed + ":" + nonce)
 * Used to publish a commitment before the round starts.
 */
export function computeCommitHex(serverSeed: string, nonce: string): string {
  return sha256(serverSeed + ':' + nonce);
}

/**
 * Computes combined seed: SHA256(serverSeed + ":" + clientSeed + ":" + nonce)
 * This seeds the deterministic PRNG for the round.
 */
export function computeCombinedSeed(
  serverSeed: string,
  clientSeed: string,
  nonce: string
): string {
  return sha256(serverSeed + ':' + clientSeed + ':' + nonce);
}
