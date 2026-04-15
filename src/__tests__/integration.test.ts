import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { POST as commitRound } from '../app/api/rounds/commit/route';
import { POST as startRound } from '../app/api/rounds/[id]/start/route';
import { POST as revealRound } from '../app/api/rounds/[id]/reveal/route';
import { GET as getRound } from '../app/api/rounds/[id]/route';
import { GET as verifyRound } from '../app/api/verify/route';

describe('Round Lifecycle API Integration', () => {
  // We use the default development SQLite DB for integration tests here.
  // In a true CI environment, we would use a separate test DB.
  let roundId = '';
  let commitHex = '';
  let nonce = '';
  let serverSeed = '';
  const clientSeed = 'test-client-seed';
  const dropColumn = 6;
  const betCents = 100;

  beforeAll(async () => {
    // Optionally clean up before tests
  });

  afterAll(async () => {
    // Clean up created round after tests
    if (roundId) {
      await prisma.round.delete({ where: { id: roundId } });
    }
  });

  it('1. POST /api/rounds/commit creates a round', async () => {
    const response = await commitRound();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('roundId');
    expect(body).toHaveProperty('commitHex');
    expect(body).toHaveProperty('nonce');

    roundId = body.roundId;
    commitHex = body.commitHex;
    nonce = body.nonce;

    // Verify it was persisted as CREATED
    const roundInDb = await prisma.round.findUnique({ where: { id: roundId } });
    expect(roundInDb).toBeDefined();
    expect(roundInDb?.status).toBe('CREATED');
    expect(roundInDb?.serverSeed).toBeDefined();
  });

  it('2. POST /api/rounds/[id]/start starts the round safely', async () => {
    const request = new Request('http://localhost/api/rounds/anything/start', {
      method: 'POST',
      body: JSON.stringify({ clientSeed, dropColumn, betCents }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await startRound(request, {
      params: Promise.resolve({ id: roundId }),
    });
    
    expect(response.status).toBe(200);
    const body = await response.json();

    // MUST NOT return serverSeed
    expect(body.serverSeed).toBeUndefined();
    
    expect(body).toHaveProperty('pegMapHash');
    expect(body).toHaveProperty('binIndex');
    expect(body).toHaveProperty('path');
    expect(body).toHaveProperty('decisionTrace');
    expect(body.path.length).toBe(12);
    expect(body.decisionTrace.length).toBe(12);

    // Verify state in DB
    const roundInDb = await prisma.round.findUnique({ where: { id: roundId } });
    expect(roundInDb?.status).toBe('STARTED');
    expect(roundInDb?.clientSeed).toBe(clientSeed);
  });

  it('3. POST /api/rounds/[id]/reveal reveals the server seed', async () => {
    const request = new Request('http://localhost/api/rounds/anything/reveal', {
      method: 'POST',
    });

    const response = await revealRound(request, {
      params: Promise.resolve({ id: roundId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toHaveProperty('serverSeed');
    expect(body.serverSeed).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars
    serverSeed = body.serverSeed;

    // Verify state in DB
    const roundInDb = await prisma.round.findUnique({ where: { id: roundId } });
    expect(roundInDb?.status).toBe('REVEALED');
  });

  it('4. GET /api/rounds/[id] returns full details', async () => {
    const request = new Request(`http://localhost/api/rounds/${roundId}`);
    const response = await getRound(request, {
      params: Promise.resolve({ id: roundId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Since it's revealed, serverSeed shouldn't be null
    expect(body.serverSeed).toBe(serverSeed);
    expect(body.status).toBe('REVEALED');
  });

  it('5. GET /api/verify correctly recomputes values', async () => {
    const url = new URL('http://localhost/api/verify');
    url.searchParams.set('serverSeed', serverSeed);
    url.searchParams.set('clientSeed', clientSeed);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('dropColumn', dropColumn.toString());
    url.searchParams.set('roundId', roundId);

    const request = new Request(url);
    const response = await verifyRound(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    // Recomputed commit hash matches original
    expect(body.commitHex).toBe(commitHex);
    // Values match what we expect from a started round
    expect(body).toHaveProperty('binIndex');
    expect(body).toHaveProperty('pegMapHash');
    expect(body.allMatch).toBe(true);
    expect(body.checks.every((check: { match: boolean }) => check.match)).toBe(true);
    
    // We can't easily assert exactly binIndex against /start without mocking, 
    // but we can fetch the DB round to compare
    const roundInDb = await prisma.round.findUnique({ where: { id: roundId } });
    expect(body.binIndex).toBe(roundInDb?.binIndex);
    expect(body.pegMapHash).toBe(roundInDb?.pegMapHash);
  });
});
