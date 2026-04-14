import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { computeCommitHex } from '@/lib/hash';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Generate server seed: 64 hex chars (32 bytes)
    const serverSeed = randomBytes(32).toString('hex');

    // Generate nonce as a string to ensure SHA-256 consistency
    // Math.random() is sufficient here as per spec (nonce does not need crypto RNG)
    const nonce = Math.floor(Math.random() * 1_000_000_000).toString();

    const commitHex = computeCommitHex(serverSeed, nonce);

    const round = await prisma.round.create({
      data: {
        status: 'CREATED',
        nonce,
        commitHex,
        serverSeed,
      },
    });

    return NextResponse.json({
      roundId: round.id,
      commitHex: round.commitHex,
      nonce: round.nonce,
    });
  } catch (error) {
    console.error('Commit error:', error);
    return NextResponse.json(
      { error: 'Failed to create round' },
      { status: 500 }
    );
  }
}
