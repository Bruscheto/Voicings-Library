import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // pnpm's generated Prisma client lives outside this app; keep its native engines.
  outputFileTracingIncludes: {
    '/*': ['../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**'],
  },
  transpilePackages: ['music-engine', 'sampler', 'data-model', 'harmony', 'keyboard'],
};

export default nextConfig;
