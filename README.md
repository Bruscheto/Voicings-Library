<h1 align="center">
  <img src="./assets/readme/hero-v10.webp" width="100%" alt="Voicings interface with a C Maj9 chord and piano keyboard">
</h1>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs&logoColor=white" alt="Next.js 15"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-047857" alt="MIT License"></a>
</p>

Voicings is a jazz piano library with two web apps. The capture app records chords from a MIDI controller or virtual keyboard.

The library app finds voicings for any chord in any key, typed or played, and chains them into voice-led ii–V–I progressions.

<p align="center">
  <img src="./assets/readme/admin-capture.png" width="100%" alt="Capture app with a C Maj9 chord, grand staff, piano keys, and interval analysis">
  <br>
  <sub>C Maj9: C3 · G3 · B3 · D4 · E4</sub>
</p>

## Features

- Type a chord (`Dm9`, `G7alt`, `F6/9/A`) or play one, and see every matching voicing in that key.
- Store each voicing once as a shape; it plays in all 12 keys.
- Mark guide tones and label every note's degree (3, b7, 9, 13…).
- Detect chords from played notes, including rootless voicings, and flag ambiguous ones.
- Tag structure automatically: shell, rootless A/B, drop 2/3, quartal, upper structure.
- Chain voicings through a major or minor ii–V–I with the least hand movement; swap any chord and the rest re-solve.
- Capture with a MIDI controller or the virtual piano: pick readings with number keys, save with Enter.
- Reject voicings whose chord symbol the notes do not spell, and warn when a shape is already saved in another key.

## Project design

```mermaid
flowchart LR
    input["MIDI controller<br/>or virtual keyboard"] --> admin["Capture app<br/>localhost:3001"]
    admin --> model["Data model<br/>Prisma"]
    model <--> db[(PostgreSQL)]
    db --> web["Library app<br/>localhost:3000"]
    admin --> shared["Notation and audio"]
    web --> shared
```

Both Next.js apps use the same PostgreSQL database. They also use shared packages for data, notation, and audio.

## Quick start

You need Node.js 22.13 or later, pnpm 11.18.0 (pinned in `package.json`), and PostgreSQL. A MIDI controller is optional.

1. Clone the repository.

   ```bash
   git clone https://github.com/Bruscheto/Voicings-Library.git
   cd Voicings-Library
   ```

2. Install the dependencies.

   ```bash
   pnpm install --frozen-lockfile
   ```

3. Set the database URLs for the current shell.

   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voicings"
   export DIRECT_URL="$DATABASE_URL"
   ```

4. Generate the Prisma client.

   ```bash
   pnpm --filter data-model run db:generate
   ```

5. Create the database tables.

   ```bash
   pnpm --filter data-model run db:push
   ```

6. Start both apps.

   ```bash
   pnpm run dev
   ```

| App         | URL                                     | Purpose                            |
| ----------- | --------------------------------------- | ---------------------------------- |
| Library app | [localhost:3000](http://localhost:3000) | Search, inspect, and play voicings |
| Capture app | [localhost:3001](http://localhost:3001) | Create, analyze, and save voicings |

For persistent local settings, add the database URLs to these files:

- `packages/data-model/.env`
- `apps/web/.env.local`
- `apps/admin/.env.local`

For a hosted database, use its pooled URL as `DATABASE_URL`. Use its direct URL as `DIRECT_URL`.

## Use the apps

### Capture a voicing

1. Open the capture app and allow MIDI access, or use the virtual keyboard.
2. Play a chord. It stays on screen after you let go; the next chord replaces it.
3. Press `1`–`6` to keep readings; the first is primary. With none chosen, the top reading is saved. Type another symbol to add a reading the engine did not list.
4. Optionally name it and add collections, then press `Enter`.

`Space` plays the chord, `Z` and `X` move it by an octave, and `Esc` clears it. If the shape is already saved, in any key, saving adds only the new readings and collections.

### Use the library

| Page             | What it does                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `/`              | Find voicings for a typed or played chord, grouped by structure      |
| `/voicings/[id]` | One voicing in any of the 12 keys, with staff, degrees and playback  |
| `/paths`         | A voice-led ii–V–I in any key, major or minor, with swappable chords |
| `/voicings`      | Browse and filter the whole library                                  |

## Seed data

The source CSV file is [`docs/data/voicings-seed.csv`](./docs/data/voicings-seed.csv). The import command only writes rows with a `ready` status.

Read the [seed workflow](./docs/data/voicing-seed-workflow.md) and [column schema](./docs/data/voicing-seed-schema.md) before you change the data.

Validate the file before you import it:

```bash
pnpm run seed:dry-run
pnpm run seed:import
```

Both commands can run more than once. They update existing voicings and skip rows with a `draft` or `defer` status.

## API

| Method | Endpoint                             | Purpose                     |
| ------ | ------------------------------------ | --------------------------- |
| `GET`  | `http://localhost:3000/api/voicings` | Return saved voicings       |
| `POST` | `http://localhost:3001/api/voicings` | Validate and save a voicing |

The write endpoint accepts this request:

```ts
type SaveVoicingRequest = {
  pitches: string[]; // e.g. ["B3", "E4", "F4", "A4"]; the lowest is the bass
  symbols?: string[]; // readings to keep, first one primary; omit for the engine's reading
  voicingName?: string | null;
  collections?: string[];
};
```

It returns `422` with the chord the notes do spell when a symbol does not match them. Saving a shape that already exists, in any key, adds new readings and collections instead of creating a duplicate.

## Repository guide

| Path                                               | Purpose                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [`apps/web`](./apps/web)                           | Library app and read API                                         |
| [`apps/admin`](./apps/admin)                       | Capture app and write API                                        |
| [`packages/harmony`](./packages/harmony)           | Chord engine: detection, symbols, finder, voice-led paths        |
| [`packages/data-model`](./packages/data-model)     | Prisma schema and voicing records                                |
| [`packages/music-engine`](./packages/music-engine) | VexFlow staff notation                                           |
| [`packages/sampler`](./packages/sampler)           | Piano samples and audio playback                                 |
| [`packages/keyboard`](./packages/keyboard)         | MIDI input, virtual piano and playback hooks shared by both apps |
| [`scripts`](./scripts)                             | CSV import and voicing re-analysis                               |
| [`docs/data`](./docs/data)                         | Seed data documentation                                          |

### Commands

| Command                                  | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `pnpm run dev`                           | Start both apps                                                    |
| `pnpm run build`                         | Build all apps and packages                                        |
| `pnpm run format:check`                  | Check file formatting                                              |
| `pnpm run seed:dry-run`                  | Validate the seed CSV file                                         |
| `pnpm run seed:import`                   | Import all `ready` rows                                            |
| `pnpm run voicings:reanalyze`            | Re-check stored voicings against the engine                        |
| `pnpm run lint`                          | Lint apps, packages and scripts                                    |
| `pnpm run typecheck`                     | Typecheck all workspaces and import scripts                        |
| `pnpm run test:coverage`                 | Check harmony and sampler coverage thresholds                      |
| `pnpm run test`                          | Run package tests                                                  |
| `pnpm run test:e2e`                      | Build both apps and run browser tests against a throwaway database |
| `pnpm --filter data-model run db:studio` | Open Prisma Studio                                                 |

## Continuous integration

[GitHub Actions](./.github/workflows/ci.yml) runs on pull requests, pushes to `main`, and manual dispatches. It uses Node.js 22.22.3, the pinned pnpm version, and a frozen lockfile to check dependencies, formatting, lint, types, unit tests, coverage, and E2E.

The E2E suite builds both apps in production mode, applies migrations, and imports the seed CSV into an in-memory PGlite PostgreSQL database. It uses local ports 5433/5434 for the database and health check, and 3100/3101 for the apps. No Neon credentials or GitHub secrets are needed.

To run browser tests locally, install Playwright's Chromium first:

```bash
pnpm --filter e2e exec playwright install chromium
pnpm run test:e2e
```

Coverage keeps the existing aggregate thresholds: 90% for harmony and 80% for sampler, across statements, branches, functions, and lines. Failed E2E runs retain traces and screenshots in the Playwright report; CI uploads them for seven days.

## Security and audio

The capture app does not have authentication. Use it only in a trusted local environment.

Add authentication and authorization before you expose the capture app on a network.

The audio package loads piano samples from the MusyngKite soundfont repository. It uses an oscillator if the samples do not load.

## License

Voicings uses the [MIT License](./LICENSE).
