# Voicings

Find, hear, and practice jazz piano voicings in your browser.

Start with a chord symbol or the notes under your fingers. Compare ways to play it, see how each voicing is built, and connect your choices into a ii–V–I.

[Launch Voicings](https://voicingslibrary.vercel.app/) · [Explore ii–V–I](https://voicingslibrary.vercel.app/paths) · [Browse the library](https://voicingslibrary.vercel.app/voicings)

![Voicings: search for a chord and explore playable voicings on piano keyboards](./assets/readme/live-library.jpg)

## From a chord to something you can play

### Find your voicing

Type a chord like `Dm9`, `G7alt`, or `F6/9/A`. Voicings brings up matching shapes from the library, grouped by structure so you can compare shells, rootless voicings, quartal shapes, and more.

You can also play notes on a MIDI keyboard or the on-screen piano. See the possible chord readings, choose the one you hear, and explore voicings for it.

### Hear the difference

Play a voicing as a chord or an arpeggio. Open it to follow the notes on the staff and piano, with guide tones and degrees such as `3`, `b7`, `9`, and `13` marked along the way.

Change the key to practice the same shape across all 12 keys. The keyboard and notation move with you.

### Put it in a progression

Build a major or minor ii–V–I in any key. Voicings chooses a path that balances voice movement with register, so you can hear how one chord leads into the next.

Swap a voicing to try another color. The surrounding chords adjust, and the path shows how far the voices move in semitones.

## Try it at the piano

1. [Open the finder](https://voicingslibrary.vercel.app/), type `Dm9`, and listen to a few results.
2. Open a voicing, look at its notes, and try it in another key.
3. [Open ii–V–I](https://voicingslibrary.vercel.app/paths), choose a key, and compare the chord changes.

A MIDI controller is optional. Type a chord or use the virtual keyboard to get started. MIDI input needs a browser with Web MIDI support and permission to access your device.

## Learn the shape, explore the harmony

The same notes can tell more than one harmonic story. `C3 E3 G3 A3` can be heard as `C6` or `Am7/C`; move the shape up two semitones and you get `D6` or `Bm7/D`.

Voicings keeps those readings together and makes each saved shape available in every key. Search explores the curated library, so the results are limited to the shapes it contains.

## Behind the product

The public app is for finding, listening, and practicing. A separate, password-protected capture app lets the library maintainer record voicings through MIDI or the virtual piano, select chord readings, and organize collections. Capture runs locally and is not part of the hosted public app.

Both apps share a TypeScript harmony engine, piano playback, and staff notation. The project uses Next.js, PostgreSQL, and Prisma.

<details>
<summary>Run locally</summary>

You need **Node.js ≥22.13**, **pnpm 11.18.0** (the version pinned in `package.json`), and a running **PostgreSQL** instance. Start with an empty local database named `voicings`.

### 1. Install

```bash
git clone https://github.com/Bruscheto/Voicings-Library.git
cd Voicings-Library
pnpm install --frozen-lockfile
```

### 2. Configure the database and capture login

Create the app environment files from the supplied examples:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Set `DATABASE_URL` and `DIRECT_URL` in both files to the same local database. In `apps/admin/.env.local`, set `ADMIN_USERNAME` and choose an `ADMIN_PASSWORD`. Capture returns `503` until both credentials are configured.

Also export the database URLs in the terminal used for Prisma and import commands. For the local database in the examples:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voicings"
export DIRECT_URL="$DATABASE_URL"
```

Use your PostgreSQL username, password, and port if they differ. For a hosted database, use the pooled connection as `DATABASE_URL` and the direct connection as `DIRECT_URL`. Keep these values server-only.

### 3. Initialize and populate the local database

```bash
pnpm --filter data-model run db:generate
pnpm --filter data-model exec prisma migrate deploy
pnpm run seed:dry-run
pnpm run seed:import
```

Run these against the empty local database configured above. Migrations create the schema and its database constraints; the import adds the reviewed `ready` rows from the seed CSV. Importing again replaces those shapes' readings with the CSV readings and preserves existing collection memberships.

### 4. Start both apps

```bash
pnpm run dev
```

| App     | Address                                 | First action                                                   |
| ------- | --------------------------------------- | -------------------------------------------------------------- |
| Library | [localhost:3000](http://localhost:3000) | Search for `Dm9` and play a result                             |
| Capture | [localhost:3001](http://localhost:3001) | Sign in, then play notes on the virtual piano or MIDI keyboard |

The app environment files let Next.js load its settings when started through Turborepo. For persistent Prisma CLI settings, you can also put the database URLs in `packages/data-model/.env`; the root import scripts still need them in the shell.

</details>

<details>
<summary>Capture workflow and shortcuts</summary>

To capture a voicing:

1. Play a chord on a MIDI controller or the virtual keyboard. The notes stay on screen after release; the next chord replaces them.
2. Select the readings you want to keep with `1`–`6`. The first selected reading is primary; with none selected, capture uses the top suggestion. You can also type another chord symbol.
3. Optionally add a name and collections, then press `Enter` to save.

| Shortcut  | Action                    |
| --------- | ------------------------- |
| `1`–`6`   | Toggle chord readings     |
| `Enter`   | Save the voicing          |
| `Space`   | Play the captured notes   |
| `Z` / `X` | Shift down / up an octave |
| `Esc`     | Clear the notes           |

Shortcuts apply when you are not typing into a field. Saving a shape with no new readings or collections returns an already-saved message.

</details>

<details>
<summary>Codebase, tests, and library maintenance</summary>

| Workspace                                          | Responsibility                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [`apps/web`](./apps/web)                           | Public library and read API                                            |
| [`apps/admin`](./apps/admin)                       | Protected capture app and write API                                    |
| [`packages/harmony`](./packages/harmony)           | Chord parsing and detection, shape analysis, search, and voice leading |
| [`packages/data-model`](./packages/data-model)     | Prisma schema, persistence, and save validation                        |
| [`packages/music-engine`](./packages/music-engine) | Staff notation                                                         |
| [`packages/keyboard`](./packages/keyboard)         | MIDI input, virtual keyboards, and shared piano playback               |
| [`scripts`](./scripts)                             | Seed import, re-analysis, model training, and sample fetching          |
| [`e2e`](./e2e)                                     | Playwright tests with a disposable PostgreSQL database                 |

| Command                                  | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `pnpm run dev`                           | Start both apps                           |
| `pnpm run build`                         | Build the apps                            |
| `pnpm run format:check`                  | Check formatting                          |
| `pnpm run lint`                          | Run ESLint                                |
| `pnpm run typecheck`                     | Check workspace and script types          |
| `pnpm run test`                          | Run package tests                         |
| `pnpm run test:coverage`                 | Check harmony and piano playback coverage |
| `pnpm run test:e2e`                      | Build both apps and run browser tests     |
| `pnpm --filter data-model run db:studio` | Inspect the database in Prisma Studio     |

[GitHub Actions](./.github/workflows/ci.yml) checks the dependency audit, formatting, lint, types, unit tests, coverage, and E2E. Coverage thresholds are 90% for harmony and 80% for keyboard piano playback.

For local browser tests, install Chromium first:

```bash
pnpm --filter e2e exec playwright install chromium
pnpm run test:e2e
```

E2E applies migrations and imports the seed into an in-memory PGlite database. It uses ports `5433`/`5434` for the database and health check, and `3100`/`3101` for the apps, with disposable capture credentials. It needs no hosted database credentials. Failed runs retain traces and screenshots in the Playwright report.

### Maintain the library

The source data is [`docs/data/voicings-seed.csv`](./docs/data/voicings-seed.csv). Only rows marked `ready` are imported; `draft` and `defer` rows are skipped. The dry run checks the data without writing to the database.

Read the [seed workflow](./docs/data/voicing-seed-workflow.md) and [column schema](./docs/data/voicing-seed-schema.md) before editing or importing. Confirm the target database before running `seed:import`, which replaces readings for matching shapes.

After a harmony engine change, review stored voicings with `pnpm run voicings:reanalyze`. Add `--write` to refresh structure tags and tensions. Unsupported readings are reported for review and are never deleted automatically.

</details>

<details>
<summary>Chord detection and model training</summary>

The engine ranks candidate chord readings with a weighted feature model and converts their scores to relative percentages. Rootless and ambiguous chords can have several plausible readings; the percentages describe the model's ranking.

- [`chord-prior.json`](./packages/harmony/src/data/chord-prior.json) contains chord-frequency statistics derived from the [iRealPro Corpus of Jazz Standards](https://doi.org/10.5281/zenodo.3546040) by Daniel Shanahan and Yuri Broze, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The source corpus is not included.
- [`reading-weights.json`](./packages/harmony/src/data/reading-weights.json) contains weights fitted on synthetic voicings sampled from that prior.

To rebuild the files, obtain the corpus and run these commands in order:

```bash
pnpm run harmony:prior /path/to/iRb_v1-0
pnpm run harmony:train --write
```

Training is deterministic and reports held-out agreement with the authored seed readings and Woodshed fixtures.

</details>

<details>
<summary>Read and write APIs</summary>

| Method | Endpoint                             | Purpose                                              |
| ------ | ------------------------------------ | ---------------------------------------------------- |
| `GET`  | `http://localhost:3000/api/voicings` | Return saved voicings                                |
| `POST` | `http://localhost:3001/api/voicings` | Validate and save a shape, readings, and collections |

The write endpoint requires the same Basic Auth credentials as the capture app and accepts:

```ts
type SaveVoicingRequest = {
  pitches: string[]; // e.g. ["B3", "E4", "F4", "A4"]; the lowest note is the bass
  symbols?: string[]; // first reading is primary; omit to use the top suggestion
  voicingName?: string | null;
  collections?: string[];
};
```

Unsupported chord readings return `422`. An existing shape receives new readings and collections; if neither adds anything, the endpoint returns `409`.

</details>

<details>
<summary>Deploy your own instance</summary>

The [public demo](https://voicingslibrary.vercel.app/) hosts `apps/web`. To host your own library on Vercel:

1. Set the project root to `apps/web`, use Node.js `22.x`, and enable source files outside the root directory.
2. Configure server-only `DATABASE_URL` and `DIRECT_URL` for your PostgreSQL database.
3. Apply the repository's migrations and import the desired seed data into that database before deployment.

[`apps/web/vercel.json`](./apps/web/vercel.json) installs the frozen lockfile, generates the Prisma client, and builds the library. It does not migrate or seed the database. [`.vercelignore`](./.vercelignore) excludes local environment files and build/test output from source uploads.

Capture uses HTTP Basic Auth through `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Pages and API routes enforce authentication, missing credentials deny access, and cross-origin writes are rejected. Run capture locally, or use a separate protected HTTPS deployment if you need remote access.

</details>

## License and credits

The project uses the [MIT License](./LICENSE). Chord-frequency statistics are derived from the iRealPro Corpus of Jazz Standards by Daniel Shanahan and Yuri Broze under CC BY 4.0; attribution and source links are in the model documentation above.

Piano playback uses [smplr](https://github.com/danigb/smplr) and the public-domain Splendid Grand Piano samples. See the [sample credits](./apps/web/public/samples/piano/README.md). `pnpm run piano:samples` restores the library's sample files.
