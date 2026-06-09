/**
 * Chord-quality canonicalization — STORAGE vs DISPLAY.
 *
 * Architectural principle (per project owner):
 *   The raw tension set is the source of truth. Compound quality names
 *   (min9 / min11 / min13 / Maj9 / Maj13 / 9 / 13) are computed at display
 *   time, not stored.
 *
 * Storage:
 *   - Chord.quality holds a BASE quality only (min7, Maj7, 7, etc.).
 *   - Chord.tensions holds the FULL tension set.
 *   - Use toBase() to convert any input form into the storage tuple.
 *
 * Display:
 *   - canonicalizeChord() lifts back to the compound shorthand for human
 *     readers ("min11" instead of "min7(9,11)").
 *   - Use buildSymbol() to assemble the symbol string from display pieces.
 *
 * Display rule (jazz convention):
 *   - A larger tension number implies the presence of the smaller ones, EXCEPT
 *     for the 11 on major/dominant (whose usual 11 is #11, not natural).
 *   - min7(9)          ≡ min9            (and equivalents for 11, 13)
 *   - min7(13)         ≠ min13           (min13 IMPLIES the full {9,11,13} stack)
 *   - m7b5 behaves like minor: m9b5 / m11b5 / m13b5.
 *   - dim7 folds natural 11 (dim9 / dim11) but has NO 13 (its bb7 is the 13).
 *   - aug7 folds natural 11 (aug9 / aug11), distinct from aug7(#11).
 *   - Maj13 / 13 imply {9,13} only; natural 11 or #11 stays explicit.
 *   - No-seventh sixth chords display as Maj6/min6, not add13.
 *   - Players prefer the compound form (min9, min11, min13).
 *
 * Worked examples (canonicalizeChord — display):
 *   min7  + {9}            → min9   + {}
 *   min7  + {9, 11}        → min11  + {}
 *   min7  + {9, 11, 13}    → min13  + {}
 *   min7  + {13}           → min7   + {13}        (not lifted — min13 needs all three)
 *   min7  + {9, #11}       → min9   + {#11}       (lifted; chromatic color preserved)
 *   min9  + {11}           → min11  + {}          (lifted through compound expansion)
 *   min13 + {9}            → min13  + {}          (redundant tension stripped)
 *   7     + {9}            → 9      + {}
 *   7     + {9, 13}        → 13     + {}
 *   Maj7  + {9}            → Maj9   + {}
 *   Maj7  + {9, 13}        → Maj13  + {}
 *   Maj7  + {9, 11, 13}    → Maj13  + {11}
 *   Maj7  + {9, #11, 13}   → Maj13  + {#11}
 *   Maj   + {13}           → 6      + {}
 *   min   + {13}           → m6     + {}
 *
 * Worked examples (toBase — storage):
 *   min7  + {9, 11}        → min7   + {9, 11}     (already base)
 *   min11 + {}             → min7   + {9, 11}     (compound → base)
 *   min11 + {b13}          → min7   + {9, 11, b13}
 *   min13 + {}             → min7   + {9, 11, 13}
 *   13    + {#11}          → 7      + {9, #11, 13}
 */

export type CanonicalChord = {
  quality: string;
  tensions: string[];
};

type CompoundDef = { base: string; implies: string[] };

const QUALITY_ALIASES: Record<string, string> = {
  Maj6: '6',
  maj6: '6',
  min6: 'm6',
};

const COMPOUND_IMPLIES: Record<string, CompoundDef> = {
  // Minor family — natural 11, larger tension implies the full smaller stack.
  min9: { base: 'min7', implies: ['9'] },
  min11: { base: 'min7', implies: ['9', '11'] },
  min13: { base: 'min7', implies: ['9', '11', '13'] },
  // Half-diminished behaves like minor.
  m9b5: { base: 'm7b5', implies: ['9'] },
  m11b5: { base: 'm7b5', implies: ['9', '11'] },
  m13b5: { base: 'm7b5', implies: ['9', '11', '13'] },
  // Diminished — natural 11 folds, but there is no 13 (the bb7 is the 13).
  dim9: { base: 'dim7', implies: ['9'] },
  dim11: { base: 'dim7', implies: ['9', '11'] },
  // Augmented — natural 11 folds (aug11 stays distinct from aug7(#11)).
  aug9: { base: 'aug7', implies: ['9'] },
  aug11: { base: 'aug7', implies: ['9', '11'] },
  // Major / dominant — 11 is EXCLUDED (their usual 11 is #11), so 13 implies
  // only {9,13} and natural 11 stays explicit.
  Maj9: { base: 'Maj7', implies: ['9'] },
  Maj13: { base: 'Maj7', implies: ['9', '13'] },
  '9': { base: '7', implies: ['9'] },
  '13': { base: '7', implies: ['9', '13'] },
};

const COMPOUND_CHAIN: Record<string, string[]> = {
  min7: ['min13', 'min11', 'min9'],
  m7b5: ['m13b5', 'm11b5', 'm9b5'],
  dim7: ['dim11', 'dim9'],
  aug7: ['aug11', 'aug9'],
  Maj7: ['Maj13', 'Maj9'],
  '7': ['13', '9'],
};

const DISPLAY_QUALITY: Record<string, string> = {
  '6': 'Maj6',
  m6: 'min6',
};

const TENSION_ORDER = ['b9', '9', '#9', '11', '#11', 'b13', '13'];

function sortTensions(tensions: Iterable<string>): string[] {
  return Array.from(tensions).sort((a, b) => {
    const ai = TENSION_ORDER.indexOf(a);
    const bi = TENSION_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function isSubset(needles: string[], haystack: Set<string>): boolean {
  return needles.every((n) => haystack.has(n));
}

/**
 * Storage form. Expands any compound quality back to (base quality, full
 * tension set). This is what should be written to the DB.
 */
export function toBase(quality: string, tensions: string[]): CanonicalChord {
  const inputQuality = QUALITY_ALIASES[quality] ?? quality;
  const lookup = COMPOUND_IMPLIES[inputQuality];
  let base = lookup?.base ?? inputQuality;
  const allTensions = new Set(tensions.filter(Boolean));
  if (lookup) {
    for (const t of lookup.implies) allTensions.add(t);
  }
  if ((base === 'Maj' || base === 'min') && allTensions.has('13')) {
    allTensions.delete('13');
    base = base === 'Maj' ? '6' : 'm6';
  }
  // On a diminished 7th the bb7 IS the 13 (enharmonically), so 13 is never a
  // separate tension — drop it if note-detection or input added it.
  if (base === 'dim7') {
    allTensions.delete('13');
  }
  return { quality: base, tensions: sortTensions(allTensions) };
}

/**
 * Display form. Takes any (quality, tensions) pair and produces the
 * compound shorthand used in chord symbols. Idempotent.
 */
export function canonicalizeChord(quality: string, tensions: string[]): CanonicalChord {
  const { quality: base, tensions: allTensionsSorted } = toBase(quality, tensions);
  const allTensions = new Set(allTensionsSorted);

  const chain = COMPOUND_CHAIN[base];
  if (chain) {
    for (const compound of chain) {
      const compoundImplies = COMPOUND_IMPLIES[compound].implies;
      if (isSubset(compoundImplies, allTensions)) {
        const impliedSet = new Set(compoundImplies);
        const remaining = Array.from(allTensions).filter((t) => !impliedSet.has(t));
        return { quality: compound, tensions: sortTensions(remaining) };
      }
    }
  }
  return { quality: DISPLAY_QUALITY[base] ?? base, tensions: allTensionsSorted };
}

const ALTERED_PATTERN = /[#b]/;

function isAltered(tension: string): boolean {
  return ALTERED_PATTERN.test(tension);
}

/**
 * Returns chord-name segments for visual rendering or symbol assembly.
 *
 * Order: [root, displayQuality, (alterations)?, addN..., slash?].
 *
 * Tension formatting rule:
 *   - Alterations (anything with # or b) join with comma inside parens.
 *   - Naturals (9 / 11 / 13) each become their own `addN` segment.
 *   - Either group is omitted when empty.
 *
 * Examples after canonicalize:
 *   {}                  → ["C","Maj9"]
 *   {13}                → ["C","Maj9","add13"]
 *   {#11}               → ["C","Maj9","(#11)"]
 *   {#11, 13}           → ["C","Maj9","(#11)","add13"]
 *   {b9, #11, 13}       → ["C","Maj7","(b9,#11)","add13"]
 *
 * Inputs may be either STORAGE form (base + full tensions) or DISPLAY form;
 * the function internally runs canonicalizeChord so it's idempotent.
 */
export function chordSegments(
  root: string,
  quality: string,
  tensions: string[],
  slashBass: string | null,
): string[] {
  const display = canonicalizeChord(quality, tensions);
  const parentheticalNaturals = display.quality === 'Maj13' ? ['11'] : [];
  const altered = display.tensions.filter(
    (t) => isAltered(t) || parentheticalNaturals.includes(t),
  );
  const natural = display.tensions.filter(
    (t) => !isAltered(t) && !parentheticalNaturals.includes(t),
  );

  const segments: string[] = [root, display.quality];

  if (altered.length > 0) {
    segments.push(`(${altered.join(',')})`);
  }
  for (const n of natural) {
    segments.push(`add${n}`);
  }
  if (slashBass) {
    segments.push('/');
    segments.push(slashBass);
  }

  return segments;
}

/**
 * Joined chord-symbol string. Same inputs and idempotency as chordSegments.
 */
export function buildSymbol(
  root: string,
  quality: string,
  tensions: string[],
  slashBass: string | null,
): string {
  return chordSegments(root, quality, tensions, slashBass).join('');
}
