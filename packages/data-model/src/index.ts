import { PrismaClient } from '@prisma/client';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
export {
  toBase,
  canonicalizeChord,
  chordSegments,
  buildSymbol,
  analyzeVoicing,
  realizeVoicing,
  VoicingAnalysisError,
} from 'harmony';
export type { CanonicalChord, VoicingAnalysis, ReadingRecord, StoredVoicing } from 'harmony';
