-- Source-of-truth shift: Chord.quality now stores BASE qualities only.
-- Compound names (Maj9, Maj13, min9, min11, min13, 9, 13) are computed at
-- display time from (base quality, full tension set) and never stored.

-- 1. Drop the existing CHECK constraint so we can rewrite compound-quality rows.
ALTER TABLE "Chord" DROP CONSTRAINT IF EXISTS chord_quality_valid;

-- 2. Convert compound-quality rows to (base quality, full tension set).
--    Tensions union avoids duplicates via SELECT DISTINCT UNNEST.

UPDATE "Chord"
SET quality = 'min7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9']::text[]) AS t)
WHERE quality = 'min9';

UPDATE "Chord"
SET quality = 'min7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9','11']::text[]) AS t)
WHERE quality = 'min11';

UPDATE "Chord"
SET quality = 'min7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9','11','13']::text[]) AS t)
WHERE quality = 'min13';

UPDATE "Chord"
SET quality = 'Maj7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9']::text[]) AS t)
WHERE quality = 'Maj9';

UPDATE "Chord"
SET quality = 'Maj7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9','11','13']::text[]) AS t)
WHERE quality = 'Maj13';

UPDATE "Chord"
SET quality = '7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9']::text[]) AS t)
WHERE quality = '9';

UPDATE "Chord"
SET quality = '7',
    tensions = ARRAY(SELECT DISTINCT t FROM UNNEST(tensions || ARRAY['9','13']::text[]) AS t)
WHERE quality = '13';

-- 3. Re-add CHECK constraint restricted to base qualities only.
ALTER TABLE "Chord" ADD CONSTRAINT chord_quality_valid CHECK (
  quality IN (
    'Maj','Maj7','6','6/9',
    'min','min7','mMaj7','m6',
    '7','7alt','7sus4','7#5',
    'dim','dim7','m7b5',
    'aug','aug7',
    'sus2','sus4','add9',
    'Quartal'
  )
);
