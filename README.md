<div align="center">

# Voicings

**A full-stack jazz piano voicing library for capturing, organizing, visualizing, and hearing chord voicings.**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

Voicings combines a public, searchable library with a local capture tool. Record notes from a MIDI controller or virtual keyboard, let the app analyze the chord, and save the result with notation, audio playback, tags, and collections.

## Features

- **Capture naturally** — enter notes with a MIDI keyboard or an on-screen 88-key piano.
- **Analyze automatically** — infer chord quality, tensions, slash bass, and note intervals from the active pitches.
- **Organize deliberately** — group voicings with context tags and collections while preventing duplicate entries.
- **Search precisely** — filter the public library by chord symbol, pitch, quality, tags, and tensions.
- **See and hear every voicing** — render grand-staff notation with VexFlow and play chords or arpeggios through Web Audio.
- **Import reproducibly** — validate and upsert curated voicings from the versioned CSV dataset.

## Architecture

```mermaid
flowchart LR
    input["MIDI controller<br/>or virtual keyboard"] --> admin["Admin app · :3001<br/>Next.js"]
    admin -->|"POST /api/voicings"| data["Data model<br/>Prisma + chord normalization"]
    web["Library app · :3000<br/>Next.js"] -->|"Queries"| data
    web -->|"GET /api/voicings"| data
    data <--> db[(PostgreSQL)]
    admin --> notation["Music engine<br/>VexFlow"]
    web --> notation
    admin --> audio["Sampler<br/>Web Audio"]
    web --> audio
    audio --> samples["MusyngKite<br/>piano samples"]
```

The two Next.js applications share the same database and workspace packages. Pages in the public app fetch data on the server; notation and playback run in the browser.

## Repository layout

| Path                                             | Purpose                                                     |
| ------------------------------------------------ | ----------------------------------------------------------- |
| [`apps/web`](apps/web)                           | Public library, filters, voicing detail pages, and read API |
| [`apps/admin`](apps/admin)                       | Local MIDI/virtual-keyboard capture tool and write API      |
| [`packages/data-model`](packages/data-model)     | Prisma schema/client and chord canonicalization             |
| [`packages/music-engine`](packages/music-engine) | Responsive grand-staff rendering with VexFlow               |
| [`packages/sampler`](packages/sampler)           | Piano sample loading and Web Audio playback                 |
| [`scripts`](scripts)                             | CSV validation and import tooling                           |
| [`docs/data`](docs/data)                         | Seed schema, template, workflow, and canonical CSV dataset  |

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL
- A modern browser; a MIDI controller is optional

### 1. Install

```bash
git clone https://github.com/Bruscheto/Voicings-Library.git
cd Voicings-Library
npm ci
```

### 2. Configure the database

For a single terminal session, export both database URLs so Prisma and the two Next.js apps inherit them:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voicings"
export DIRECT_URL="$DATABASE_URL"
```

For persistent local configuration, place the same values in `packages/data-model/.env` for Prisma CLI commands and in both `apps/web/.env.local` and `apps/admin/.env.local` for the applications. With a hosted PostgreSQL provider, use its pooled URL for `DATABASE_URL` and direct connection URL for `DIRECT_URL`.

### 3. Initialize the database

```bash
npm --workspace data-model run db:generate
npm --workspace data-model run db:push
```

Optionally validate and import the curated seed library:

```bash
npm run seed:dry-run
npm run seed:import
```

### 4. Start both apps

```bash
npm run dev
```

| Service | URL                                            | Role                                     |
| ------- | ---------------------------------------------- | ---------------------------------------- |
| Library | [http://localhost:3000](http://localhost:3000) | Browse, filter, view, and play voicings  |
| Admin   | [http://localhost:3001](http://localhost:3001) | Capture, analyze, tag, and save voicings |

## Usage

### Capture a voicing

1. Open the admin app and allow MIDI access, or use the virtual keyboard.
2. Choose a chord root and family; the app derives the specific quality, tensions, and slash bass from the notes.
3. Review the grand staff and interval analysis, then add context tags or collections.
4. Save the voicing to PostgreSQL. Existing voicings can gain new collection memberships without creating duplicate rows.

Keyboard shortcuts in the admin app:

| Key       | Action                             |
| --------- | ---------------------------------- |
| `Space`   | Play the current voicing           |
| `X` / `Z` | Transpose up or down by one octave |

### Browse the library

The public app supports combined filters for chord text or pitch, chord quality, one or more tags, selected tensions, and voicings with no tensions. Each detail page includes staff notation, pitch names, metadata, and block or arpeggiated playback.

### Import CSV data

The canonical seed file is [`docs/data/voicings-seed.csv`](docs/data/voicings-seed.csv). Rows marked `ready` are imported; rows marked `draft` or `defer` are skipped. See the [seed workflow](docs/data/voicing-seed-workflow.md) and [column schema](docs/data/voicing-seed-schema.md) before editing the dataset.

Always run a dry run before writing to the database:

```bash
npm run seed:dry-run
npm run seed:import
```

## API

| Method | Development endpoint                 | Description                                         |
| ------ | ------------------------------------ | --------------------------------------------------- |
| `GET`  | `http://localhost:3000/api/voicings` | Return all voicings with chords and tags            |
| `POST` | `http://localhost:3001/api/voicings` | Validate, canonicalize, and save a captured voicing |

The write endpoint accepts this JSON shape:

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

## Scripts

| Command                                    | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `npm run dev`                              | Start both apps through Turborepo              |
| `npm run build`                            | Build all applications and packages            |
| `npm run format`                           | Format the repository with Prettier            |
| `npm run format:check`                     | Check formatting without changing files        |
| `npm run seed:dry-run`                     | Validate the canonical CSV and preview imports |
| `npm run seed:import`                      | Upsert ready CSV rows into PostgreSQL          |
| `npm --workspace data-model run db:studio` | Open Prisma Studio                             |

## Browser and deployment notes

- Web MIDI works best in Chromium-based browsers and requires browser permission.
- Piano samples are loaded at runtime from the MusyngKite soundfont repository; playback falls back to a synthesized oscillator when a sample is unavailable.
- The admin app has no authentication and is intended for trusted local use. Add access control before exposing it publicly.
- Configure `DATABASE_URL` and `DIRECT_URL` in each deployment environment and deploy the two apps as separate services.

## License

Released under the [MIT License](LICENSE).
