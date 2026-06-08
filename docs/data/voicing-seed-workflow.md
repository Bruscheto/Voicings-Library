# Voicing Seed Workflow

This guide explains how we author new voicings in a spreadsheet, validate the data, and feed it into the Prisma seed so the public apps can consume the same source of truth.

## 1. Authoring Flow

1. **Create a working copy**: Duplicate `docs/data/voicing-seed-template.csv` (or import it into Google Sheets/Numbers). Preserve the header order.
2. **Capture the voicing**: Use the admin tool to grab the staff + interval analysis. Copy the auto-generated `symbol`, `pitches`, and `midi_numbers` directly into the sheet.
3. **Fill metadata**: Complete the remaining columns defined in `docs/data/voicing-seed-schema.md`.
4. **Status gate**: Keep `status` set to `draft` until the row has been double-checked (notes, tensions, slash bass, spelling). Flip to `ready` once reviewed so the importer will pick it up.
5. **Version control**: Commit the canonical sheet as `docs/data/voicings-seed.csv` (and any supporting references) so every seed drop is reproducible. Keep the template file untouched for onboarding.

## 2. Preparing for Import

1. **Export to CSV** from Sheets (UTF-8, commas). Save/overwrite `docs/data/voicings-seed.csv`.
2. **Validate format** using any CSV linter or the importer dry-run (`npm run seed:dry-run`). The validator will ensure:
   - UUIDs are unique.
   - Required columns are present and non-empty when `status=ready`.
   - JSON-like columns (`pitches`, `midi_numbers`) parse successfully.
3. **Dry run**: `npm run seed:dry-run` (or `ts-node --project tsconfig.scripts.json scripts/import-voicings-from-csv.ts docs/data/voicings-seed.csv --dry-run`) prints the upsert plan without touching the database.

## 3. Importing into Prisma

1. `npm run seed:import` upserts the CSV rows into Postgres (Chord + Voicing + VoicingChord tables) so the admin app reads the same data the spreadsheet defines.
2. `cd packages/data-model && npx prisma db seed` executes the same importer via Prisma’s seed hook, which is what CI/prod deployments will use.
3. Both commands are idempotent: rerunning them updates existing voicings (by `voicing_id`) and skips rows whose status is `draft` or `defer`.

> Tip: running `npm run seed:dry-run` before every commit provides a quick lint for malformed JSON or missing required fields.

## 4. Review & QA Checklist

- Compare the rendered staff from the admin tool against VexFlow output in the public app.
- Use the sampler playback to confirm MIDI numbers align with written pitches (no octave typos).
- Ensure context tags align with the options exposed in `apps/admin/app/page.tsx`.
- When referencing tunes/progressions, verify the slug format matches what the future `Progression` table will expect.

Documenting this workflow now keeps Step 2 self-contained: the schema lives in `voicing-seed-schema.md`, the template in `voicing-seed-template.csv`, and this file captures the process from capture → review → import.
