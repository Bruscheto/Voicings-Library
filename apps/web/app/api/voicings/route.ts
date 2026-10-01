import { NextResponse } from 'next/server';
import { prisma, realizeVoicing } from 'data-model';

export async function GET() {
  const voicings = await prisma.voicing.findMany({
    include: {
      readings: true,
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const payload = voicings.map((v) => {
    const { pitches, readings } = realizeVoicing(v);
    return {
      id: v.id,
      name: v.name,
      pitches,
      intervals: v.intervals,
      bassMidi: v.bassMidi,
      structure: v.structure,
      createdAt: v.createdAt,
      readings,
      tags: v.tags.map((vt) => vt.tag),
    };
  });

  return NextResponse.json(payload);
}
