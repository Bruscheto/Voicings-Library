# Voicing Seed Schema

Each row of `docs/data/voicings-seed.csv` is one voicing: the notes as played, plus the chords they should be read as. The chord engine (`packages/harmony`) derives everything else, including chord tones, tensions, rootless flags and structure tags, so the sheet holds only what a person has to decide.

| Column    | Required | Format                                   | Stored as                                  | Notes                                                                                                                                  |
| --------- | -------- | ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pitches` | ✓        | Space-separated pitches (`E3 B3 D4 F#4`) | `Voicing.intervals`, `bassMidi`, `shapeKey` | The lowest pitch is the bass. Any spelling works (`F#4`, `Gb4`); the shape is what is stored.                                           |
| `symbols` |          | `;`-separated chord symbols              | `VoicingReading` rows                      | First symbol is the primary reading. Each must match the notes exactly, including every tension and any slash bass. Blank: the engine's top reading. |
| `name`    |          | Short text                               | `Voicing.name`                             | e.g. "Bill Evans Rootless A".                                                                                                          |
| `tags`    |          | Comma-separated                          | `Tag` + `VoicingTag`                       | Free tags (`Ballad`) and collections (`collection:Rootless ii-V-I`). Added on import, never removed.                                  |
| `source`  |          | Text                                     | `Voicing.source`                           | Provenance, e.g. "Bill Evans - Waltz for Debby".                                                                                       |
| `status`  | ✓        | `ready`, `draft` or `defer`              | importer gate                              | Only `ready` rows are written. Draft rows are still analysed in the dry run.                                                          |
| `notes`   |          | Free text                                | not imported                               | Reviewer notes, e.g. why a row is still a draft.                                                                                       |

## What the engine checks

- Every symbol must parse (`Cmaj7`, `CΔ7`, `C-7`, `Bø`, `Bb13(#11)`, `G7alt`, `F6/9/A`) and its notes must spell it. `Cmaj9(#11)/E` over notes that include the 13th is rejected with the symbol the notes do spell.
- A slash bass must be the lowest note.
- `7alt` accepts any dominant whose tensions are all altered (♭9, ♯9, ♯11, ♭13).
- Two ready rows with the same shape in any key are rejected, because they would overwrite each other.

## Identity

A voicing is its shape (intervals above the bass), so `B3 E4 F4 A4` and `E3 A3 Bb3 D4` are the same voicing in different keys. Readings are stored relative to the bass, so they transpose with it. Re-importing a row replaces its readings and adds its tags.
