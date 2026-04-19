import { NextResponse } from 'next/server';
import { prisma } from 'data-model';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { symbol, quality, root, tensions, voicingName, pitches, midiNumbers, context } = body;

    // 1. Upsert Chord
    const chord = await prisma.chord.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        quality,
        root,
        tensions
      }
    });

    // 2. Create Voicing
    const voicing = await prisma.voicing.create({
      data: {
        name: voicingName,
        pitches: JSON.stringify(pitches),
        midiNumbers: JSON.stringify(midiNumbers),
        // register removed
        chords: {
          create: {
            chordId: chord.id,
            context
          }
        }
      }
    });

    return NextResponse.json({ success: true, voicing });
  } catch (error) {
    console.error('Failed to save voicing:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
