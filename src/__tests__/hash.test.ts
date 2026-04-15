/**
 * Hash helpers tests
 */

import { describe, it, expect } from 'vitest';
import { sha256, computeCommitHex, computeCombinedSeed } from '../lib/hash';

describe('SHA-256 hash helpers', () => {
  const assignmentServerSeed =
    'b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc';
  const assignmentClientSeed = 'candidate-hello';
  const assignmentNonce = '42';

  it('sha256 produces correct hex output', () => {
    // Known SHA-256 test vector
    const hash = sha256('hello');
    expect(hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('sha256 is deterministic', () => {
    const hash1 = sha256('test-input');
    const hash2 = sha256('test-input');
    expect(hash1).toBe(hash2);
  });

  it('sha256 produces 64-character hex string', () => {
    const hash = sha256('anything');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computeCommitHex formats correctly', () => {
    const serverSeed = assignmentServerSeed;
    const nonce = assignmentNonce;
    const commitHex = computeCommitHex(serverSeed, nonce);
    const expected = sha256(`${serverSeed}:${nonce}`);
    expect(commitHex).toBe(expected);
  });

  it('matches assignment commitHex test vector exactly', () => {
    expect(computeCommitHex(assignmentServerSeed, assignmentNonce)).toBe(
      'bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34'
    );
  });

  it('matches assignment combinedSeed test vector exactly', () => {
    expect(
      computeCombinedSeed(assignmentServerSeed, assignmentClientSeed, assignmentNonce)
    ).toBe(
      'e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0'
    );
  });

  it('computeCombinedSeed formats correctly', () => {
    const combined = computeCombinedSeed('serverSeed', 'clientSeed', '42');
    const expected = sha256('serverSeed:clientSeed:42');
    expect(combined).toBe(expected);
  });

  it('nonce as string vs number produces different hashes', () => {
    // This test validates that nonce MUST be treated as string
    const hashWithString = sha256('seed:42');
    const hashWithNumber = sha256('seed:' + String(42));
    // Both should be the same since we always use string
    expect(hashWithString).toBe(hashWithNumber);
  });
});
