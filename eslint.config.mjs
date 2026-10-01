import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/dist/**',
      '**/out/**',
      '**/next-env.d.ts',
      '**/playwright-report/**',
      '**/test-results/**',
      '.codex/**',
      '.playwright-cli/**',
      'tmp/**',
      'temp/**',
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
    settings: {
      next: {
        rootDir: [`${import.meta.dirname}/apps/web/`, `${import.meta.dirname}/apps/admin/`],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],
    },
  }),
];

export default config;
