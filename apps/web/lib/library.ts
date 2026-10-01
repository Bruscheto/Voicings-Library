import { prisma } from 'data-model';
import type { LibraryVoicing } from 'harmony';

/**
 * Every ready voicing as plain shapes. The library is small enough to match
 * in the browser, which keeps search instant and works for played notes.
 */
export async function loadLibrary(): Promise<LibraryVoicing[]> {
  const voicings = await prisma.voicing.findMany({
    where: { status: 'ready' },
    select: {
      id: true,
      name: true,
      intervals: true,
      bassMidi: true,
      structure: true,
      readings: {
        select: {
          rootOffset: true,
          quality: true,
          tensions: true,
          rootless: true,
          isPrimary: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return voicings;
}
