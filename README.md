# Voicings

Jazz piano voicing library and capture tool.

## Project

- `apps/admin` - local tool for adding voicings with MIDI or the virtual keyboard.
- `apps/web` - public browser for saved voicings.
- `packages/data-model` - Prisma schema, client, and chord naming helpers.
- `packages/music-engine` - staff rendering.
- `packages/sampler` - browser piano playback.

## Setup

This repo is private workspace code. It is not published to npm.

Requirements:

- Node 20+
- Postgres database

```bash
git clone https://github.com/Bruscheto/Voicings-Library.git
cd Voicings-Library
npm ci
```

Create `packages/data-model/.env`:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
```

Set up the database:

```bash
npm --workspace data-model run db:generate
npm --workspace data-model run db:push
npm run seed:import
```

Run the app:

```bash
npm run d
```

- Web: `http://localhost:3000`
- Admin: `http://localhost:3001`

## Useful Commands

```bash
npm run build
npm run format
npm run seed:dry-run
```

## License

MIT
