/**
 * Deterministic Plinko Engine
 *
 * Generates peg maps and simulates ball paths using a seeded PRNG.
 * 100% deterministic and replayable — critical for provable fairness.
 *
 * PRNG stream order: peg map generation first, then row decisions.
 * This guarantees a verifier can reproduce results exactly.
 */

import { sha256 } from './hash';
import type { PRNG } from './prng';

export type Direction = 'L' | 'R';

export interface SimulationResult {
  path: Direction[];
  binIndex: number;
  pegMap: number[][];
  pegMapHash: string;
}

/**
 * Clamp utility — ensures value stays within [min, max].
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generates the peg map: a 2D array of leftBias values.
 * Row r has r+1 pegs, each with leftBias ∈ [0.4, 0.6].
 *
 * leftBias values are rounded using parseFloat(val.toFixed(6))
 * — NOT Math.round, NOT toPrecision — exactly toFixed(6) then parseFloat.
 */
export function generatePegMap(rand: PRNG, rows: number): number[][] {
  const pegMap: number[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let p = 0; p <= r; p++) {
      const leftBias = parseFloat(
        (0.5 + (rand() - 0.5) * 0.2).toFixed(6)
      );
      row.push(leftBias);
    }
    pegMap.push(row);
  }

  return pegMap;
}

/**
 * Serializes pegMap to a canonical JSON string for hashing.
 *
 * IMPORTANT: Never call JSON.stringify(pegMap, null, 2) or any formatted variant
 * — this will produce a different hash and break verification.
 *
 * This function MUST be used in BOTH /start and /verify routes.
 */
export function serializePegMap(pegMap: number[][]): string {
  return JSON.stringify(pegMap);
}

/**
 * Computes the hash of a serialized peg map.
 */
export function computePegMapHash(pegMap: number[][]): string {
  return sha256(serializePegMap(pegMap));
}

/**
 * Simulates the ball path through the Plinko board.
 *
 * @param rand - PRNG function (MUST be the same stream used after peg map generation)
 * @param pegMap - Generated peg map (leftBias values)
 * @param dropColumn - Player's chosen drop column (0..12)
 * @param rows - Number of rows (default 12)
 * @returns Path decisions and final bin index
 */
export function simulatePath(
  rand: PRNG,
  pegMap: number[][],
  dropColumn: number,
  rows: number = 12
): { path: Direction[]; binIndex: number } {
  const path: Direction[] = [];
  let pos = 0; // number of Right moves so far

  // Drop column influence: small bias adjustment
  const adj = (dropColumn - Math.floor(rows / 2)) * 0.01;

  for (let r = 0; r < rows; r++) {
    // Use the peg at index min(pos, r) — peg under current path
    const pegIndex = Math.min(pos, r);
    const leftBias = pegMap[r][pegIndex];
    const bias = clamp(leftBias + adj, 0, 1);

    const rnd = rand();

    if (rnd < bias) {
      path.push('L');
    } else {
      path.push('R');
      pos += 1;
    }
  }

  return { path, binIndex: pos };
}

/**
 * Runs a full deterministic simulation: generates peg map, simulates path,
 * computes peg map hash. Single entry point for /start and /verify routes.
 */
export function runSimulation(
  rand: PRNG,
  dropColumn: number,
  rows: number = 12
): SimulationResult {
  const pegMap = generatePegMap(rand, rows);
  const pegMapHash = computePegMapHash(pegMap);
  const { path, binIndex } = simulatePath(rand, pegMap, dropColumn, rows);

  return { path, binIndex, pegMap, pegMapHash };
}
