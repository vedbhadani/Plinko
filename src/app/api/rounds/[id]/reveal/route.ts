import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if round exists and is REVEALED
    const round = await prisma.round.findUnique({
      where: { id },
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    if (round.status !== 'STARTED') {
      return NextResponse.json(
        { error: 'Round is not in STARTED state' },
        { status: 400 }
      );
    }

    // Reveal the round
    const updatedRound = await prisma.round.update({
      where: { id },
      data: {
        status: 'REVEALED',
        revealedAt: new Date(),
      },
    });

    return NextResponse.json({
      serverSeed: updatedRound.serverSeed,
    });
  } catch (error) {
    console.error('Reveal error:', error);
    return NextResponse.json(
      { error: 'Failed to reveal server seed' },
      { status: 500 }
    );
  }
}
