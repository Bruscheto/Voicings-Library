# Voicings

A jazz piano voicings library — capture voicings with a MIDI keyboard, browse them
on a grand staff, hear them played back.

## What's here

- **`apps/web`** — public library (browse + play voicings). Next.js 15.
- **`apps/admin`** — capture tool with virtual piano + MIDI input. Next.js 15, runs locally only.
- **`packages/data-model`** — Prisma schema + shared client (Postgres / Neon).
- **`packages/music-engine`** — VexFlow staff renderer.
- **`packages/sampler`** — Web Audio piano sampler.

## Local setup

```bash
# 1. Install
npm install

# 2. Set up the database
# Create a free Postgres on Neon (https://neon.tech) and copy the connection string.
# Then create packages/data-model/.env:
#
#   DATABASE_URL="postgresql://...?pgbouncer=true&connect_timeout=15"
#   DIRECT_URL="postgresql://..."  # same URL without -pooler in hostname
#
# Apply migrations:
cd packages/data-model
npx prisma migrate deploy

# 3. (Optional) Seed
cd ../..
npm run seed:import

# 4. Run
npm run dev          # both apps via turbo
# web   → http://localhost:3000
# admin → http://localhost:3001
```

## Docs

- [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) — long-lived product blueprint
- [`docs/TODO.md`](docs/TODO.md) — strategic roadmap (Stages A–D)
- [`docs/sprints/`](docs/sprints/) — current and past sprint plans
- [`docs/data/`](docs/data/) — seed CSV + schema notes

## License

MIT — see [`LICENSE`](LICENSE).
