import { defineConfig } from '@playwright/test';

// Ports away from the dev servers (3000/3001/5432) so a running local setup is untouched.
const DB_PORT = 5433;
const WEB_PORT = 3100;
const ADMIN_PORT = 3101;
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable&pgbouncer=true&connection_limit=1`;
const appEnv = { DATABASE_URL, DIRECT_URL: DATABASE_URL };
// Disposable test credentials only, never production credentials.
const adminCredentials = { username: 'e2e-admin', password: 'e2e-only-password' };
const STARTUP_TIMEOUT_MS = 300_000;

export default defineConfig({
  testDir: './tests',
  // The flows share one database and the capture test writes to it.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    httpCredentials: adminCredentials,
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: [
    {
      command: 'node db-server.mjs',
      url: 'http://127.0.0.1:5434',
      env: { E2E_DB_PORT: String(DB_PORT) },
      timeout: STARTUP_TIMEOUT_MS,
    },
    {
      command: `pnpm --filter web build && pnpm --filter web exec next start -p ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}/paths`,
      env: appEnv,
      cwd: '..',
      timeout: STARTUP_TIMEOUT_MS,
    },
    {
      command: `pnpm --filter admin build && pnpm --filter admin exec next start -p ${ADMIN_PORT}`,
      url: `http://127.0.0.1:${ADMIN_PORT}`,
      env: {
        ...appEnv,
        ADMIN_USERNAME: adminCredentials.username,
        ADMIN_PASSWORD: adminCredentials.password,
      },
      cwd: '..',
      timeout: STARTUP_TIMEOUT_MS,
    },
  ],
});
