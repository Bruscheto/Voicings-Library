-- ============================================================
-- Wipe voicings/chords (Tag rows are preserved as the canonical lookup).
-- ============================================================
DELETE FROM "VoicingTag";
DELETE FROM "VoicingChord";
DELETE FROM "Voicing";
DELETE FROM "Chord";

-- ============================================================
-- Drop unused progression tables.
-- ============================================================
DROP TABLE IF EXISTS "ProgressionChord";
DROP TABLE IF EXISTS "Progression";

-- ============================================================
-- Convert tensions to TEXT[] and pitches to TEXT[].
-- Drop midiNumbers (derivable from pitches).
-- ============================================================
ALTER TABLE "Chord" DROP COLUMN tensions;
ALTER TABLE "Chord" ADD COLUMN tensions TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "Voicing" DROP COLUMN pitches;
ALTER TABLE "Voicing" ADD COLUMN pitches TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Voicing" DROP COLUMN "midiNumbers";

-- ============================================================
-- CHECK constraints — enforce canonical vocabularies without lookup tables.
-- ============================================================
ALTER TABLE "Chord" ADD CONSTRAINT chord_root_valid CHECK (
  root IN (
    'C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'
  )
);

ALTER TABLE "Chord" ADD CONSTRAINT chord_quality_valid CHECK (
  quality IN (
    'Maj','Maj7','Maj9','Maj13','6','6/9',
    'min','min7','min9','min11','min13','mMaj7','m6',
    '7','9','13','7alt','7sus4','7#5',
    'dim','dim7','m7b5',
    'aug','aug7',
    'sus2','sus4','add9',
    'Quartal'
  )
);

-- ============================================================
-- Indexes for filter UI.
-- ============================================================
CREATE INDEX "Chord_quality_idx" ON "Chord"(quality);
CREATE INDEX "VoicingTag_tagId_idx" ON "VoicingTag"("tagId");
