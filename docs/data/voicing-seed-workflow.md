# Voicing Seed Workflow

How to author voicings in a spreadsheet, check them against the chord engine, and import them. Columns are described in [`voicing-seed-schema.md`](./voicing-seed-schema.md).

## 1. Author

1. Start from `docs/data/voicing-seed-template.csv` and keep the header order.
2. Play the voicing in the capture app and copy its pitches into `pitches`.
3. Write the chord in `symbols`, or leave it blank to accept the engine's reading. Add more readings after a `;` when the shape honestly reads more than one way (`C6; Am7/C`).
4. Keep `status` at `draft` until the row is reviewed, then set it to `ready`.
5. Commit the sheet as `docs/data/voicings-seed.csv`.

## 2. Check

```bash
pnpm run seed:dry-run
```

The dry run prints every row with the readings it would store, whether they were authored or detected, and the structure tags. It fails, writing nothing, if a ready row:

- has a symbol the notes do not spell (the message names the chord they do spell),
- has a slash bass that is not the lowest note,
- has an invalid status, or
- duplicates the shape of another ready row.

## 3. Import

`pnpm run seed:import` writes to PostgreSQL. Confirm the target database and get explicit approval first. The command is idempotent: it upserts by shape, replaces readings from the sheet, and only adds tags, so collection memberships made in the capture app survive.

## 4. After a migration or engine change

Structure tags and reading tensions come from the engine. Re-check stored voicings whenever either changes:

```bash
pnpm run voicings:reanalyze
pnpm run voicings:reanalyze --write
```

The first command only reports. `--write` refreshes structure tags, corrects tensions to what the notes spell, and gives any voicing without a reading the engine's top reading. Readings the notes cannot support are listed for review and never deleted.
