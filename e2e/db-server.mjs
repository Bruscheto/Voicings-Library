// Disposable Postgres for end-to-end tests: an in-memory PGlite database with
// every migration applied and the seed CSV imported through the real importer,
// served over the Postgres wire protocol. Nothing outside this process is
// touched. A health endpoint tells Playwright when it is ready.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = path.join(ROOT, 'packages/data-model/prisma/migrations');
const DB_PORT = Number(process.env.E2E_DB_PORT ?? 5433);
const HEALTH_PORT = Number(process.env.E2E_DB_HEALTH_PORT ?? 5434);
const MAX_CONNECTIONS = 10;

const databaseUrl = (port = DB_PORT) =>
  // pgbouncer mode: unnamed prepared statements, since every client shares one PGlite session.
  `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&pgbouncer=true&connection_limit=1`;

const db = await PGlite.create();
for (const migration of fs
  .readdirSync(MIGRATIONS)
  .filter((d) => /^\d/.test(d))
  .sort()) {
  const sql = fs.readFileSync(path.join(MIGRATIONS, migration, 'migration.sql'), 'utf8');
  await db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
}
await new PGLiteSocketServer({
  db,
  port: DB_PORT,
  host: '127.0.0.1',
  maxConnections: MAX_CONNECTIONS,
}).start();

// Async on purpose: the importer talks to the server running in this process.
const url = databaseUrl();
await new Promise((resolve, reject) => {
  const importer = spawn('pnpm', ['run', 'seed:import'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: 'inherit',
  });
  importer.on('error', reject);
  importer.on('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`seed import exited with ${code}`)),
  );
});

http
  .createServer((_, res) => {
    res.writeHead(200);
    res.end('ready');
  })
  .listen(HEALTH_PORT, '127.0.0.1');
console.log(`e2e database ready on ${DB_PORT}`);
