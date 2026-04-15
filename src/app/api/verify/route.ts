import { NextResponse } from 'next/server';
import { computeCommitHex, computeCombinedSeed } from '@/lib/hash';
import { extractSeed, xorshift32 } from '@/lib/prng';
import { runSimulation } from '@/lib/engine';
import { prisma } from '@/lib/prisma';

type VerificationValue = string | number | string[] | null;

interface VerificationCheck {
  field: string;
  expected: VerificationValue;
  actual: VerificationValue;
  match: boolean;
}

function parsePath(pathJson: string | null): string[] | null {
  if (!pathJson) return null;

  try {
    const parsed = JSON.parse(pathJson);
    if (Array.isArray(parsed) && parsed.every((direction) => direction === 'L' || direction === 'R')) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const serverSeed = searchParams.get('serverSeed');
    const clientSeed = searchParams.get('clientSeed');
    const nonce = searchParams.get('nonce');
    const dropColumnStr = searchParams.get('dropColumn');
    const roundId = searchParams.get('roundId');

    // Strict input validation (return HTTP 400 on failure):
    if (!serverSeed || !/^[a-f0-9]{64}$/.test(serverSeed)) {
      return NextResponse.json(
        { error: 'Invalid serverSeed. Must be a 64-character hex string.' },
        { status: 400 }
      );
    }

    if (!clientSeed || clientSeed.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid clientSeed. Must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (!nonce || nonce.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid nonce. Must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (!dropColumnStr) {
      return NextResponse.json(
        { error: 'Invalid dropColumn. Missing.' },
        { status: 400 }
      );
    }

    if (!/^(?:[0-9]|1[0-2])$/.test(dropColumnStr)) {
      return NextResponse.json(
        { error: 'Invalid dropColumn. Must be an integer between 0 and 12.' },
        { status: 400 }
      );
    }
    const dropColumn = Number(dropColumnStr);
    
    // 1. Recompute commitHex
    const commitHex = computeCommitHex(serverSeed, nonce);

    // 2. Compute combinedSeed
    const combinedSeed = computeCombinedSeed(serverSeed, clientSeed, nonce);

    // 3. Initialize PRNG
    const prngSeed = extractSeed(combinedSeed);
    const rand = xorshift32(prngSeed);

    // 4. Run deterministic simulation
    // Using default parameter 12 for rows as per spec
    const result = runSimulation(rand, dropColumn, 12);

    const response = {
      commitHex,
      combinedSeed,
      pegMapHash: result.pegMapHash,
      binIndex: result.binIndex,
      path: result.path,
      decisionTrace: result.decisionTrace,
    };

    if (!roundId) {
      return NextResponse.json(response);
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      return NextResponse.json(
        { error: 'Round not found for comparison.' },
        { status: 404 }
      );
    }

    const storedPath = parsePath(round.pathJson);
    const checks: VerificationCheck[] = [
      {
        field: 'commitHex',
        expected: round.commitHex,
        actual: commitHex,
        match: round.commitHex === commitHex,
      },
      {
        field: 'combinedSeed',
        expected: round.combinedSeed,
        actual: combinedSeed,
        match: round.combinedSeed === combinedSeed,
      },
      {
        field: 'pegMapHash',
        expected: round.pegMapHash,
        actual: result.pegMapHash,
        match: round.pegMapHash === result.pegMapHash,
      },
      {
        field: 'dropColumn',
        expected: round.dropColumn,
        actual: dropColumn,
        match: round.dropColumn === dropColumn,
      },
      {
        field: 'binIndex',
        expected: round.binIndex,
        actual: result.binIndex,
        match: round.binIndex === result.binIndex,
      },
      {
        field: 'path',
        expected: storedPath,
        actual: result.path,
        match: JSON.stringify(storedPath) === JSON.stringify(result.path),
      },
    ];

    return NextResponse.json({
      ...response,
      roundId,
      storedRound: {
        status: round.status,
        rows: round.rows,
        revealedAt: round.revealedAt,
      },
      checks,
      allMatch: checks.every((check) => check.match),
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify round' },
      { status: 500 }
    );
  }
}
