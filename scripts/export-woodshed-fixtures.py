"""Export Woodshed chord-detection results as parity fixtures for packages/harmony.

Usage: WOODSHED_API=../woodshed/api python3 scripts/export-woodshed-fixtures.py

Reads Woodshed's theory modules without modifying them. The corpus is every
template Woodshed knows, on every root, in root position and first inversion,
plus its rootless practice shapes.
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.environ.get("WOODSHED_API", "../woodshed/api")))

from app.theory.chords import QUALITY_TEMPLATES, detect_chord  # noqa: E402
from app.theory.harmony import family_of  # noqa: E402
from app.theory.reference import ROOTLESS  # noqa: E402

BASE_MIDI = 48  # C3
OUT = os.path.join(os.path.dirname(__file__), "..", "packages", "harmony", "fixtures", "woodshed.json")


def voicings():
    for root in range(12):
        for quality, template in QUALITY_TEMPLATES.items():
            notes = [BASE_MIDI + root + i for i in template]
            yield notes, root, quality, "root"
            inverted = notes[1:] + [notes[0] + 12]
            yield inverted, root, quality, "first-inversion"
        for quality, shape in ROOTLESS.items():
            yield [BASE_MIDI + root + i for i in shape], root, quality, "rootless"


def main():
    fixtures = []
    for notes, root, quality, position in voicings():
        detected = detect_chord(notes)
        fixtures.append({
            "midi": notes,
            "intended": {"root_pc": root, "quality": quality, "family": family_of(quality).name},
            "position": position,
            "woodshed": None if detected is None else {
                "root": detected["root"],
                "quality": detected["quality"],
                "family": family_of(detected["quality"]).name,
                "root_inferred": detected["root_inferred"],
                "ambiguous": detected["ambiguous"],
            },
        })
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=1)
        f.write("\n")
    print(f"wrote {len(fixtures)} fixtures to {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
