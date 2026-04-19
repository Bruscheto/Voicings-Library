import { NextResponse } from 'next/server';
import { prisma } from 'data-model';

export async function GET() {
  const voicings = await prisma.voicing.findMany({
    include: {
      chords: {
        include: {
          chord: true
        }
      }
    }
  });
  
  // Parse JSON fields
  const parsedVoicings = voicings.map(v => ({
    ...v,
    pitches: JSON.parse(v.pitches),
    midiNumbers: JSON.parse(v.midiNumbers)
  }));

  return NextResponse.json(parsedVoicings);
}
