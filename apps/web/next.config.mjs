import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // pnpm's generated Prisma client lives outside this app; keep its native engines.
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**'],
  },
  // Piano samples are self-hosted from public/samples/piano (scripts/fetch-piano-samples.ts).
  env: { NEXT_PUBLIC_PIANO_SAMPLES_URL: '/samples/piano' },
  transpilePackages: ['music-engine', 'data-model', 'harmony', 'keyboard'],
};

export default nextConfig;
