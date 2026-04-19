# Voicing Seed Schema

This schema describes the columns we will maintain in the shared spreadsheet that drives the initial Prisma seed. Each column maps cleanly to one or more Prisma models (`Chord`, `Voicing`, `VoicingChord`, and future `SubVoicing`/`Progression` records). Columns are ordered to match authoring flow in the admin capture tool.

| Column             | Required | Type / Format                                  | Maps To                                             | Notes                                                                                     |
| ------------------ | -------- | ---------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| `voicing_id`       | ✓        | UUID (or stable slug)                          | `Voicing.id`                                        | Pre-generate to keep references stable between sheet edits and DB seeds.                  |
| `voicing_name`     |          | Short text                                     | `Voicing.name`                                      | Auto-filled from admin capture but can be overridden (e.g., "Bill Evans Rootless A").     |
| `symbol`           | ✓        | Text (`Cmaj7(#11)/E`)                          | `Chord.symbol`                                      | Must match the computed symbol logic in the admin tool so that upserts remain idempotent. |
| `root`             | ✓        | Enum (C, Db, …, B)                             | `Chord.root`                                        | Used for interval analysis + slash detection.                                             |
| `quality`          | ✓        | Enum (Maj7, min7, 7alt, etc.)                  | `Chord.quality`                                     | Mirrors the dropdown values in `page.tsx`.                                                |
| `tensions`         |          | CSV string (`9,#11,13`)                        | `Chord.tensions`                                    | Keep comma-separated list; importer will normalize to JSON array.                         |
| `slash_bass`       |          | Pitch class (`E`)                              | `VoicingChord.context` (planned JSON)               | Explicit slash target if different from `root`. Auto-derived when left blank.             |
| `context_tags`     |          | CSV (`Rootless,Drop 2`)                        | `VoicingChord.context` (today) → future JSON column | Captures structural tags toggled in the admin UI.                                         |
| `pitches`          | ✓        | JSON-ish string (`["E3","A3","D4","G4","C5"]`) | `Voicing.pitches`                                   | Preserve enharmonic spelling from capture tool for staff accuracy.                        |
| `midi_numbers`     | ✓        | JSON-ish string (`[52,57,62,67,72]`)           | `Voicing.midiNumbers`                               | Enables sampler playback and register validation.                                         |
| `register_low`     |          | Pitch (`E3`)                                   | future `Voicing.registerRange.low`                  | Optional helper until the Prisma field lands.                                             |
| `register_high`    |          | Pitch (`C6`)                                   | future `Voicing.registerRange.high`                 | Derived from `pitches` when blank.                                                        |
| `clef_hint`        |          | Enum (`treble`, `bass`, `grand`)               | future `Voicing.clefHint`                           | Guides staff renderer defaults.                                                           |
| `descriptor`       |          | Free text                                      | future `Voicing.descriptor`                         | Quick theory blurb ("3-7 shell + #11 upper structure").                                   |
| `substructures`    |          | Semi-structured (`UST: G-B-D                   | Quartal: D-G-C`)                                    | future `SubVoicing` records                                                               | Use `Label: pitches` pairs separated by ` | `. Importer will explode into rows later. |
| `tags`             |          | CSV (`Tenderly, Ballad, Left-Hand`)            | future `Tag` join                                   | Style, tune, or usage tags for later faceting.                                            |
| `progression_refs` |          | CSV of `slug:bar` (`autumn-a:3`)               | future `ProgressionChord`                           | Allows pre-linking voicings to standards when those tables arrive.                        |
| `audio_status`     |          | Enum (`sampled`, `needs-recording`)            | seed metadata only                                  | Tracks whether high-fidelity samples exist for this voicing.                              |
| `notes`            |          | Free text                                      | seed metadata only                                  | Any capture notes (player, fingering, source transcription, etc.).                        |
| `source`           |          | Text (`Bill Evans - Waltz for Debby`)          | seed metadata only                                  | Provenance for future liner notes.                                                        |
| `status`           | ✓        | Enum (`draft`, `ready`, `defer`)               | importer logic                                      | Governs whether the row is picked up by the seeding script.                               |

## Normalization Plan

- **Chord upsert**: `symbol`, `quality`, `root`, and `tensions` populate / dedupe `Chord`. Future iterations will expand `Chord` with JSON tension arrays but the CSV remains unchanged.
- **Voicing creation**: `voicing_id`, `voicing_name`, `pitches`, and `midi_numbers` become the core `Voicing` record. Optional register/clef/descriptor fields are staged for upcoming Prisma updates but can live in JSON metadata until the schema evolves.
- **Voicing ↔ Chord link**: Every row implicitly links to one chord. `slash_bass` and `context_tags` remain serialized for now (saved inside `VoicingChord.context`), then migrate to richer JSON once that column is promoted.
- **Forward compatibility**: `substructures`, `tags`, and `progression_refs` are intentionally denormalized text fields so we can pre-author data without blocking on the downstream tables. The importer script will no-op until those tables exist.

Keeping all authoring-friendly metadata in one row lets us seed quickly while still aligning with the Prisma models and future relationships.
