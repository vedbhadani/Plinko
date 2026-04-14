import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    // Ensure limit logic corresponds to implementation plan (default 20, max 500)
    let limit = 20;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 500);
      }
    }

    const format = searchParams.get('format');

    const rounds = await prisma.round.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      // Only returning rounds that have at least started
      where: {
        status: { in: ['STARTED', 'REVEALED'] },
      },
    });

    // Hide serverSeed if not REVEALED
    const sanitizedRounds = rounds.map((round) => {
      if (round.status !== 'REVEALED') {
         round.serverSeed = null;
      }
      return round;
    });

    if (format === 'csv') {
      // Bonus content: CSV Export 
      // Columns: id, createdAt, commitHex, combinedSeed, pegMapHash, binIndex, payoutMultiplier, betCents
      const header = 'id,createdAt,commitHex,combinedSeed,pegMapHash,binIndex,payoutMultiplier,betCents\n';
      const rows = sanitizedRounds.map((r) => {
        return [
          r.id,
          r.createdAt.toISOString(),
          r.commitHex,
          r.combinedSeed || '',
          r.pegMapHash || '',
          r.binIndex ?? '',
          r.payoutMultiplier ?? '',
          r.betCents ?? '',
        ].join(',');
      }).join('\n');

      const csvString = header + rows;

      return new NextResponse(csvString, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="plinko-rounds-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(sanitizedRounds);
  } catch (error) {
    console.error('List rounds error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve rounds' },
      { status: 500 }
    );
  }
}
