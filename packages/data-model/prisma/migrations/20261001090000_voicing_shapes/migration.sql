-- Voicings become transposition-invariant shapes; chords become readings of a
-- shape relative to its bass. Existing rows are converted, not discarded:
--   Voicing.pitches            -> bassMidi + intervals + shapeKey
--   VoicingChord + Chord       -> VoicingReading (rootOffset from the bass)
--   voicings sharing a shape   -> merged into the earliest, keeping readings and tags
-- Structure tags are engine-derived; run `pnpm run voicings:reanalyze` after
-- this migration to fill them (and to re-check readings against the engine).

-- ============================================================
-- Temporary helpers
-- ============================================================
CREATE FUNCTION pg_temp.note_pc(name TEXT) RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT ((CASE upper(substr(name, 1, 1))
            WHEN 'C' THEN 0 WHEN 'D' THEN 2 WHEN 'E' THEN 4 WHEN 'F' THEN 5
            WHEN 'G' THEN 7 WHEN 'A' THEN 9 WHEN 'B' THEN 11 END)
          + length(name) - length(replace(name, '#', ''))
          - (length(substr(name, 2)) - length(replace(substr(name, 2), 'b', ''))) + 24) % 12
$$;

CREATE FUNCTION pg_temp.pitch_midi(pitch TEXT) RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT (substring(pitch FROM '(-?\d+)$')::INTEGER + 1) * 12
       + ((CASE upper(substr(pitch, 1, 1))
            WHEN 'C' THEN 0 WHEN 'D' THEN 2 WHEN 'E' THEN 4 WHEN 'F' THEN 5
            WHEN 'G' THEN 7 WHEN 'A' THEN 9 WHEN 'B' THEN 11 END)
          + length(pitch) - length(replace(pitch, '#', ''))
          - (length(substring(pitch FROM '^[A-Ga-g]([#b]*)')) - length(replace(substring(pitch FROM '^[A-Ga-g]([#b]*)'), 'b', ''))))
$$;

-- ============================================================
-- 1. Voicing: pitches -> shape
-- ============================================================
ALTER TABLE "Voicing"
  ADD COLUMN "intervals" INTEGER[],
  ADD COLUMN "bassMidi" INTEGER,
  ADD COLUMN "shapeKey" TEXT,
  ADD COLUMN "structure" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN "source" TEXT;

-- A voicing with no pitches has no shape and cannot be shown or played.
DELETE FROM "VoicingTag" WHERE "voicingId" IN (SELECT id FROM "Voicing" WHERE cardinality(pitches) = 0);
DELETE FROM "VoicingChord" WHERE "voicingId" IN (SELECT id FROM "Voicing" WHERE cardinality(pitches) = 0);
DELETE FROM "Voicing" WHERE cardinality(pitches) = 0;

WITH notes AS (
  SELECT v.id, array_agg(DISTINCT pg_temp.pitch_midi(p)) AS midi
  FROM "Voicing" v, unnest(v.pitches) AS p
  GROUP BY v.id
), shaped AS (
  SELECT n.id, b.bass,
         ARRAY(SELECT m - b.bass FROM unnest(n.midi) AS m ORDER BY m) AS intervals
  FROM notes n, LATERAL (SELECT min(m) AS bass FROM unnest(n.midi) AS m) b
)
UPDATE "Voicing" v
SET "bassMidi" = s.bass,
    "intervals" = s.intervals,
    "shapeKey" = array_to_string(s.intervals, '-')
FROM shaped s
WHERE v.id = s.id;

-- ============================================================
-- 2. VoicingReading from VoicingChord + Chord
-- ============================================================
CREATE TABLE "VoicingReading" (
    "id" TEXT NOT NULL,
    "voicingId" TEXT NOT NULL,
    "rootOffset" INTEGER NOT NULL,
    "quality" TEXT NOT NULL,
    "tensions" TEXT[] NOT NULL DEFAULT '{}',
    "rootless" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VoicingReading_pkey" PRIMARY KEY ("id")
);

-- Legacy base qualities that are really a base plus tensions are unfolded;
-- 'Quartal' names a structure, not a chord, so it yields no reading.
INSERT INTO "VoicingReading" ("id", "voicingId", "rootOffset", "quality", "tensions", "rootless", "isPrimary")
SELECT DISTINCT ON (r."voicingId", r."rootOffset", r.quality)
       r."chordLinkId", r."voicingId", r."rootOffset", r.quality, r.tensions,
       NOT ((r."rootOffset") = ANY (ARRAY(SELECT i % 12 FROM unnest(r.intervals) AS i))),
       r."linkRank" = 1
FROM (
  SELECT vc.id AS "chordLinkId", vc."voicingId", v.intervals,
         ((pg_temp.note_pc(c.root) - v."bassMidi" % 12) % 12 + 12) % 12 AS "rootOffset",
         CASE c.quality WHEN '6/9' THEN '6' WHEN 'add9' THEN 'Maj' WHEN '7#5' THEN 'aug7' WHEN '7alt' THEN '7' ELSE c.quality END AS quality,
         CASE WHEN c.quality IN ('6/9', 'add9') AND NOT ('9' = ANY (c.tensions))
              THEN array_prepend('9', c.tensions) ELSE c.tensions END AS tensions,
         row_number() OVER (PARTITION BY vc."voicingId" ORDER BY vc.id) AS "linkRank"
  FROM "VoicingChord" vc
  JOIN "Chord" c ON c.id = vc."chordId"
  JOIN "Voicing" v ON v.id = vc."voicingId"
  WHERE c.quality <> 'Quartal'
) r
ORDER BY r."voicingId", r."rootOffset", r.quality, r."linkRank";

-- A voicing whose first chord link was dropped (Quartal) promotes its next reading.
UPDATE "VoicingReading" vr
SET "isPrimary" = true
WHERE vr.id IN (
  SELECT DISTINCT ON ("voicingId") id
  FROM "VoicingReading"
  WHERE "voicingId" NOT IN (SELECT "voicingId" FROM "VoicingReading" WHERE "isPrimary")
  ORDER BY "voicingId", id
);

-- ============================================================
-- 3. Merge voicings that share a shape into the earliest one
-- ============================================================
CREATE TEMP TABLE shape_keeper AS
SELECT id, first_value(id) OVER (PARTITION BY "shapeKey" ORDER BY "createdAt", id) AS keeper
FROM "Voicing";

INSERT INTO "VoicingReading" ("id", "voicingId", "rootOffset", "quality", "tensions", "rootless", "isPrimary")
SELECT vr.id || '-merged', k.keeper, vr."rootOffset", vr.quality, vr.tensions, vr.rootless, false
FROM "VoicingReading" vr
JOIN shape_keeper k ON k.id = vr."voicingId" AND k.id <> k.keeper
WHERE NOT EXISTS (
  SELECT 1 FROM "VoicingReading" kept
  WHERE kept."voicingId" = k.keeper AND kept."rootOffset" = vr."rootOffset" AND kept.quality = vr.quality
);

INSERT INTO "VoicingTag" ("voicingId", "tagId")
SELECT k.keeper, vt."tagId"
FROM "VoicingTag" vt
JOIN shape_keeper k ON k.id = vt."voicingId" AND k.id <> k.keeper
ON CONFLICT DO NOTHING;

UPDATE "Voicing" v
SET name = d.name
FROM "Voicing" d
JOIN shape_keeper k ON k.id = d.id AND k.id <> k.keeper
WHERE v.id = k.keeper AND v.name IS NULL AND d.name IS NOT NULL;

DELETE FROM "VoicingReading" WHERE "voicingId" IN (SELECT id FROM shape_keeper WHERE id <> keeper);
DELETE FROM "VoicingTag" WHERE "voicingId" IN (SELECT id FROM shape_keeper WHERE id <> keeper);
DELETE FROM "VoicingChord" WHERE "voicingId" IN (SELECT id FROM shape_keeper WHERE id <> keeper);
DELETE FROM "Voicing" WHERE id IN (SELECT id FROM shape_keeper WHERE id <> keeper);

-- ============================================================
-- 4. Drop the stored-chord model
-- ============================================================
DROP TABLE "VoicingChord";
DROP TABLE "Chord";
ALTER TABLE "Voicing" DROP COLUMN "pitches", DROP COLUMN "slashBass";

-- ============================================================
-- 5. Constraints and indexes
-- ============================================================
ALTER TABLE "Voicing"
  ALTER COLUMN "intervals" SET NOT NULL,
  ALTER COLUMN "bassMidi" SET NOT NULL,
  ALTER COLUMN "shapeKey" SET NOT NULL;

ALTER TABLE "Voicing" ADD CONSTRAINT voicing_shape_valid CHECK (
  cardinality("intervals") >= 1 AND "intervals"[1] = 0
);
ALTER TABLE "Voicing" ADD CONSTRAINT voicing_bass_valid CHECK ("bassMidi" BETWEEN 21 AND 108);
ALTER TABLE "Voicing" ADD CONSTRAINT voicing_status_valid CHECK ("status" IN ('draft', 'ready'));

ALTER TABLE "VoicingReading" ADD CONSTRAINT reading_root_offset_valid CHECK ("rootOffset" BETWEEN 0 AND 11);
ALTER TABLE "VoicingReading" ADD CONSTRAINT reading_quality_valid CHECK (
  quality IN (
    'Maj','Maj7','6',
    'min','min7','m6','mMaj7',
    '7','7sus4','sus4','sus2',
    'dim','dim7','m7b5',
    'aug','aug7'
  )
);

CREATE UNIQUE INDEX "Voicing_shapeKey_key" ON "Voicing"("shapeKey");
CREATE UNIQUE INDEX "VoicingReading_voicingId_rootOffset_quality_key" ON "VoicingReading"("voicingId", "rootOffset", "quality");
CREATE INDEX "VoicingReading_quality_idx" ON "VoicingReading"("quality");
-- At most one primary reading per voicing (Prisma cannot express partial indexes).
CREATE UNIQUE INDEX "VoicingReading_one_primary" ON "VoicingReading"("voicingId") WHERE "isPrimary";

ALTER TABLE "VoicingReading" ADD CONSTRAINT "VoicingReading_voicingId_fkey"
  FOREIGN KEY ("voicingId") REFERENCES "Voicing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
