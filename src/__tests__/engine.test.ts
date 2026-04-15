/**
 * Engine tests — deterministic peg map + path simulation
 */

import { describe, it, expect } from 'vitest';
import { xorshift32, extractSeed } from '../lib/prng';
import { computeCombinedSeed } from '../lib/hash';
import {
  generatePegMap,
  simulatePath,
  computePegMapHash,
  serializePegMap,
  runSimulation,
} from '../lib/engine';

describe('Deterministic Plinko Engine', () => {
  // Assignment test vector inputs
  const serverSeed =
    'b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc';
  const nonce = '42';
  const clientSeed = 'candidate-hello';

  function createTestPRNG() {
    const combinedSeed = computeCombinedSeed(serverSeed, clientSeed, nonce);
    const seed = extractSeed(combinedSeed);
    return xorshift32(seed);
  }

  describe('generatePegMap', () => {
    it('generates correct dimensions (row r has r+1 pegs)', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      expect(pegMap.length).toBe(12);
      for (let r = 0; r < 12; r++) {
        expect(pegMap[r].length).toBe(r + 1);
      }
    });

    it('matches assignment peg map first-row vectors', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      expect(pegMap[0]).toEqual([0.422123]);
      expect(pegMap[1]).toEqual([0.552503, 0.408786]);
      expect(pegMap[2]).toEqual([0.491574, 0.46878, 0.43654]);
    });

    it('all leftBias values are in [0.4, 0.6]', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      for (const row of pegMap) {
        for (const bias of row) {
          expect(bias).toBeGreaterThanOrEqual(0.4);
          expect(bias).toBeLessThanOrEqual(0.6);
        }
      }
    });

    it('leftBias values have at most 6 decimal places', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      for (const row of pegMap) {
        for (const bias of row) {
          const str = bias.toString();
          const decimals = str.includes('.') ? str.split('.')[1].length : 0;
          expect(decimals).toBeLessThanOrEqual(6);
        }
      }
    });

    it('is deterministic — same seed produces same peg map', () => {
      const rand1 = createTestPRNG();
      const rand2 = createTestPRNG();

      const pegMap1 = generatePegMap(rand1, 12);
      const pegMap2 = generatePegMap(rand2, 12);

      expect(pegMap1).toEqual(pegMap2);
    });
  });

  describe('serializePegMap', () => {
    it('produces consistent serialization', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      const s1 = serializePegMap(pegMap);
      const s2 = serializePegMap(pegMap);

      expect(s1).toBe(s2);
    });

    it('is plain JSON with no formatting', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);

      const serialized = serializePegMap(pegMap);
      // Should not contain newlines or extra spaces
      expect(serialized).not.toContain('\n');
      expect(serialized).not.toContain('  ');
    });
  });

  describe('pegMapHash', () => {
    it('is deterministic', () => {
      const rand1 = createTestPRNG();
      const rand2 = createTestPRNG();

      const hash1 = computePegMapHash(generatePegMap(rand1, 12));
      const hash2 = computePegMapHash(generatePegMap(rand2, 12));

      expect(hash1).toBe(hash2);
    });

    it('is a valid SHA-256 hex string', () => {
      const rand = createTestPRNG();
      const hash = computePegMapHash(generatePegMap(rand, 12));

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('simulatePath', () => {
    it('produces path of correct length (12 decisions)', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);
      const { path } = simulatePath(rand, pegMap, 6, 12);

      expect(path.length).toBe(12);
    });

    it('path contains only L and R', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);
      const { path } = simulatePath(rand, pegMap, 6, 12);

      for (const dir of path) {
        expect(['L', 'R']).toContain(dir);
      }
    });

    it('binIndex equals number of R decisions', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);
      const { path, binIndex } = simulatePath(rand, pegMap, 6, 12);

      const rightCount = path.filter((d) => d === 'R').length;
      expect(binIndex).toBe(rightCount);
    });

    it('binIndex is in valid range [0, 12]', () => {
      const rand = createTestPRNG();
      const pegMap = generatePegMap(rand, 12);
      const { binIndex } = simulatePath(rand, pegMap, 6, 12);

      expect(binIndex).toBeGreaterThanOrEqual(0);
      expect(binIndex).toBeLessThanOrEqual(12);
    });
  });

  describe('runSimulation (full)', () => {
    it('assignment test vector: center drop → binIndex = 6', () => {
      const seed = 3789414263;
      const rand = xorshift32(seed);

      const result = runSimulation(rand, 6, 12);

      // Assignment spec: dropColumn = 6 (center for 13 bins), adj = 0 → binIndex = 6
      expect(result.binIndex).toBe(6);
      expect(result.path.length).toBe(12);
      expect(result.decisionTrace.length).toBe(12);
      expect(result.pegMapHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is fully deterministic', () => {
      const run = () => {
        const combinedSeed = computeCombinedSeed(
          serverSeed,
          clientSeed,
          nonce
        );
        const seed = extractSeed(combinedSeed);
        const rand = xorshift32(seed);
        return runSimulation(rand, 6, 12);
      };

      const r1 = run();
      const r2 = run();

      expect(r1.binIndex).toBe(r2.binIndex);
      expect(r1.path).toEqual(r2.path);
      expect(r1.pegMapHash).toBe(r2.pegMapHash);
    });
  });
});
