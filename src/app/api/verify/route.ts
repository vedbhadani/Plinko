import { NextResponse } from 'next/server';
import { computeCommitHex, computeCombinedSeed } from '@/lib/hash';
import { extractSeed, xorshift32 } from '@/lib/prng';
import { runSimulation } from '@/lib/engine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const serverSeed = searchParams.get('serverSeed');
    const clientSeed = searchParams.get('clientSeed');
    const nonce = searchParams.get('nonce');
    const dropColumnStr = searchParams.get('dropColumn');

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

    const dropColumn = parseInt(dropColumnStr, 10);
    if (isNaN(dropColumn) || dropColumn < 0 || dropColumn > 12) {
      return NextResponse.json(
        { error: 'Invalid dropColumn. Must be an integer between 0 and 12.' },
        { status: 400 }
      );
    }
    
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

    return NextResponse.json({
      commitHex,
      combinedSeed,
      pegMapHash: result.pegMapHash,
      binIndex: result.binIndex,
      path: result.path,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify round' },
      { status: 500 }
    );
  }
}
