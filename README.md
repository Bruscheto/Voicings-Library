<h1 align="center">
  <img src="./assets/readme/hero-v10.webp" width="100%" alt="Voicings interface with a C Maj9 chord and piano keyboard">
</h1>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs&logoColor=white" alt="Next.js 15"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-047857" alt="MIT License"></a>
</p>

Voicings is a jazz piano library with two web apps. The capture app records chords from a MIDI controller or virtual keyboard.

The library app lets users search, inspect, and play saved voicings.

<p align="center">
  <img src="./assets/readme/admin-capture.png" width="100%" alt="Capture app with a C Maj9 chord, grand staff, piano keys, and interval analysis">
  <br>
  <sub>C Maj9: C3 · G3 · B3 · D4 · E4</sub>
</p>

## Features

- Play notes with an 88-key virtual piano or a MIDI controller.
- Analyze chord quality, tensions, slash bass, and intervals.
- Review each voicing on a grand staff.
- Save voicings with names, tags, and collections.
- Prevent duplicate voicings.
- Search the library by chord, pitch, quality, tag, or tension.
- Play voicings as a chord or an arpeggio.

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

You need Node.js 20 or later, pnpm 11.18.0 or later, and PostgreSQL. A MIDI controller is optional.

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

1. Open the capture app.
2. Allow MIDI access or use the virtual keyboard.
3. Select the root and chord family.
4. Play the notes.
5. Review the chord name, staff, and interval list.
6. Add tags or collections.
7. Save the voicing.

Use `Space` to play the current voicing. Use `X` and `Z` to move it by one octave.

If a voicing already exists, the app can add new collection memberships. It does not create a duplicate row.

### Browse the library

Filter voicings by chord, pitch, quality, tag, or tension. Open a voicing to see its notation, notes, metadata, and playback controls.

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
  root: string;
  quality: string;
  tensions: string[];
  voicingName: string | null;
  pitches: string[];
  slashBass: string | null;
  contextTags: string[];
  collections: string[];
};
```

## Repository guide

| Path                                               | Purpose                          |
| -------------------------------------------------- | -------------------------------- |
| [`apps/web`](./apps/web)                           | Library app and read API         |
| [`apps/admin`](./apps/admin)                       | Capture app and write API        |
| [`packages/data-model`](./packages/data-model)     | Prisma schema and chord data     |
| [`packages/music-engine`](./packages/music-engine) | VexFlow staff notation           |
| [`packages/sampler`](./packages/sampler)           | Piano samples and audio playback |
| [`scripts`](./scripts)                             | CSV validation and import        |
| [`docs/data`](./docs/data)                         | Seed data documentation          |

### Commands

| Command                                    | Purpose                     |
| ------------------------------------------ | --------------------------- |
| `pnpm run dev`                             | Start both apps             |
| `pnpm run build`                           | Build all apps and packages |
| `pnpm run format:check`                    | Check file formatting       |
| `pnpm run seed:dry-run`                    | Validate the seed CSV file  |
| `pnpm run seed:import`                     | Import all `ready` rows     |
| `pnpm --filter data-model run db:studio`  | Open Prisma Studio          |

## Security and audio

The capture app does not have authentication. Use it only in a trusted local environment.

Add authentication and authorization before you expose the capture app on a network.

The audio package loads piano samples from the MusyngKite soundfont repository. It uses an oscillator if the samples do not load.

## License

Voicings uses the [MIT License](./LICENSE).
