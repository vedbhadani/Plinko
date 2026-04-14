import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeCombinedSeed } from '@/lib/hash';
import { extractSeed, xorshift32 } from '@/lib/prng';
import { runSimulation, serializePegMap } from '@/lib/engine';
import { getMultiplier } from '@/lib/paytable';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { clientSeed, dropColumn, betCents } = body;

    if (!clientSeed || typeof clientSeed !== 'string') {
      return NextResponse.json(
        { error: 'Invalid clientSeed' },
        { status: 400 }
      );
    }

    if (
      typeof dropColumn !== 'number' ||
      dropColumn < 0 ||
      dropColumn > 12 ||
      !Number.isInteger(dropColumn)
    ) {
      return NextResponse.json(
        { error: 'Invalid dropColumn. Must be integer between 0 and 12.' },
        { status: 400 }
      );
    }

    if (
      typeof betCents !== 'number' ||
      betCents <= 0 ||
      !Number.isInteger(betCents)
    ) {
      return NextResponse.json(
        { error: 'Invalid betCents. Must be a positive integer.' },
        { status: 400 }
      );
    }

    // Check if round exists and is CREATED
    const round = await prisma.round.findUnique({
      where: { id },
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    if (round.status !== 'CREATED') {
      return NextResponse.json(
        { error: 'Round is already started or complete' },
        { status: 400 }
      );
    }

    if (!round.serverSeed) {
      return NextResponse.json(
        { error: 'Server seed missing from round' },
        { status: 500 }
      );
    }

    // 1. Compute seeds
    const combinedSeed = computeCombinedSeed(
      round.serverSeed,
      clientSeed,
      round.nonce
    );
    const prngSeed = extractSeed(combinedSeed);
    const rand = xorshift32(prngSeed);

    // 2. Run deterministic simulation
    const rows = round.rows;
    const result = runSimulation(rand, dropColumn, rows);
    const payoutMultiplier = getMultiplier(result.binIndex);

    // 3. Update the round in DB
    const updatedRound = await prisma.round.update({
      where: { id },
      data: {
        status: 'STARTED',
        clientSeed,
        combinedSeed,
        pegMapHash: result.pegMapHash,
        dropColumn,
        binIndex: result.binIndex,
        payoutMultiplier,
        betCents,
        // serialize array to String, Prisma will store it as string transparently
        pathJson: JSON.stringify(result.path),
      },
    });

    // CAUTION: Never spread the `updatedRound` object to avoid leaking `serverSeed`.
    // Explicitly select the safe fields.
    return NextResponse.json({
      roundId: updatedRound.id,
      pegMapHash: result.pegMapHash,
      rows: updatedRound.rows,
      binIndex: result.binIndex,
      path: result.path,
      payoutMultiplier,
      betCents,
    });
  } catch (error) {
    console.error('Start error:', error);
    return NextResponse.json(
      { error: 'Failed to start round' },
      { status: 500 }
    );
  }
}
