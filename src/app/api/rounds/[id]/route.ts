import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const round = await prisma.round.findUnique({
      where: { id },
    });

    if (!round) {
      return NextResponse.json({ error: 'Round not found' }, { status: 404 });
    }

    // Hide serverSeed if not REVEALED
    if (round.status !== 'REVEALED') {
      round.serverSeed = null;
    }

    return NextResponse.json(round);
  } catch (error) {
    console.error('Get round error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve round' },
      { status: 500 }
    );
  }
}
