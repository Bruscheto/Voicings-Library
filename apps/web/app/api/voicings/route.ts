import { NextResponse } from 'next/server';
import { prisma } from 'data-model';

export async function GET() {
  const voicings = await prisma.voicing.findMany({
    include: {
      chords: { include: { chord: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const payload = voicings.map((v) => ({
    id: v.id,
    name: v.name,
    pitches: v.pitches,
    slashBass: v.slashBass,
    createdAt: v.createdAt,
    chords: v.chords.map((vc) => ({ chord: vc.chord })),
    tags: v.tags.map((vt) => vt.tag),
  }));

  return NextResponse.json(payload);
}
