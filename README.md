<h1 align="center">
  <img src="./assets/readme/hero-v10.webp" width="100%" alt="Voicings presented as a retro-space jazz mission console with the real C Maj9 capture interface and keyboard">
</h1>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs&logoColor=white" alt="Next.js 15"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-047857" alt="MIT License"></a>
</p>

Voicings is a full-stack jazz piano library for capturing chords from a MIDI controller or virtual keyboard, analyzing their harmonic structure, and saving them with notation and audio playback.

<p align="center">
  <img src="./assets/readme/admin-capture.png" width="100%" alt="Voicings admin showing a C Maj9 chord on a grand staff, selected piano keys, and interval analysis">
</p>

<p align="center"><sub>A real C Maj9 capture: C3 · G3 · B3 · D4 · E4</sub></p>

## What it does

- **Capture** notes with an 88-key virtual piano or a Web MIDI controller.
- **Understand** chord quality, tensions, slash bass, and interval roles as you play.
- **Keep** voicings in PostgreSQL with names, tags, collections, and duplicate protection.
- **Explore** a searchable public library with grand-staff notation, piano samples, and arpeggiated playback.

## How it works

```mermaid
flowchart LR
    input["MIDI controller<br/>or virtual keyboard"] --> admin["Capture app<br/>Next.js · :3001"]
    admin -->|"analyze + save"| model["Shared data model<br/>Prisma + normalization"]
    model <--> db[(PostgreSQL)]
    db --> web["Library app<br/>Next.js · :3000"]
    web --> output["Search · notation<br/>piano playback"]
    admin --> output
```

The two Next.js applications share the database and three workspace packages: chord canonicalization and persistence, VexFlow notation, and Web Audio playback.

## Quick start

You need Node.js 20+, npm 10+, and PostgreSQL. A MIDI controller is optional; Chromium-based browsers provide the best Web MIDI support.

```bash
git clone https://github.com/Bruscheto/Voicings-Library.git
cd Voicings-Library
npm ci
```

Set the database URLs for the current shell:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voicings"
export DIRECT_URL="$DATABASE_URL"
```

For persistent local configuration, add the same values to:

- `packages/data-model/.env` for Prisma commands
- `apps/web/.env.local` for the public library
- `apps/admin/.env.local` for the capture app

With a hosted PostgreSQL provider, use its pooled URL for `DATABASE_URL` and its direct connection URL for `DIRECT_URL`.

Initialize the schema and start both apps:

```bash
npm --workspace data-model run db:generate
npm --workspace data-model run db:push
npm run dev
```

| App     | URL                                     | Purpose                                          |
| ------- | --------------------------------------- | ------------------------------------------------ |
| Library | [localhost:3000](http://localhost:3000) | Browse, filter, inspect, and play saved voicings |
| Capture | [localhost:3001](http://localhost:3001) | Play, analyze, tag, and save new voicings        |

## Use it

### Capture a voicing

1. Open the capture app and allow MIDI access, or use the virtual keyboard.
2. Choose a root and chord family; Voicings derives the quality, tensions, and slash bass from the active notes.
3. Review the staff and interval analysis, then add tags or collections.
4. Save the voicing. Existing matches can gain collection memberships without creating duplicate rows.

Use `Space` to play the current voicing and `X` / `Z` to transpose it by an octave.

### Browse the library

Filter by chord or pitch, quality, tags, and tensions. Each detail page shows the staff, pitch names, metadata, and block or arpeggiated playback.

## Data and API

<details>
<summary><strong>Curated CSV workflow</strong></summary>

The canonical dataset is [`docs/data/voicings-seed.csv`](docs/data/voicings-seed.csv). Rows marked `ready` are imported; `draft` and `defer` rows are skipped.

Read the [seed workflow](docs/data/voicing-seed-workflow.md) and [column schema](docs/data/voicing-seed-schema.md), then validate before writing:

```bash
npm run seed:dry-run
npm run seed:import
```

</details>

<details>
<summary><strong>Development API</strong></summary>

| Method | Endpoint                             | Purpose                                    |
| ------ | ------------------------------------ | ------------------------------------------ |
| `GET`  | `http://localhost:3000/api/voicings` | Return voicings with chords and tags       |
| `POST` | `http://localhost:3001/api/voicings` | Validate, canonicalize, and save a capture |

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

</details>

## Repository guide

| Path                                             | Responsibility                                        |
| ------------------------------------------------ | ----------------------------------------------------- |
| [`apps/web`](apps/web)                           | Public library, filters, detail pages, and read API   |
| [`apps/admin`](apps/admin)                       | Local capture interface and write API                 |
| [`packages/data-model`](packages/data-model)     | Prisma schema, client, and chord canonicalization     |
| [`packages/music-engine`](packages/music-engine) | Responsive grand-staff rendering with VexFlow         |
| [`packages/sampler`](packages/sampler)           | Piano samples, synth fallback, and Web Audio playback |
| [`scripts`](scripts)                             | CSV validation and import                             |
| [`docs/data`](docs/data)                         | Seed dataset, schema, and workflow                    |

### Commands

| Command                                    | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `npm run dev`                              | Start both apps through Turborepo             |
| `npm run build`                            | Build every app and package                   |
| `npm run format:check`                     | Check repository formatting                   |
| `npm run seed:dry-run`                     | Validate and preview the canonical CSV import |
| `npm run seed:import`                      | Upsert all `ready` CSV rows                   |
| `npm --workspace data-model run db:studio` | Open Prisma Studio                            |

## Operational notes

- Piano samples load at runtime from the MusyngKite soundfont repository; an oscillator provides fallback playback.
- The capture app has no authentication and is intended for trusted local use. Add access control before exposing it publicly.
- Deploy the public and capture apps as separate services, with `DATABASE_URL` and `DIRECT_URL` configured in each environment.

## License

Released under the [MIT License](LICENSE).
