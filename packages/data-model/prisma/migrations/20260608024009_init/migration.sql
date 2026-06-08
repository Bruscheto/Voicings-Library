-- CreateTable
CREATE TABLE "Chord" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "tensions" TEXT,

    CONSTRAINT "Chord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voicing" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "pitches" TEXT NOT NULL,
    "midiNumbers" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voicing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicingChord" (
    "id" TEXT NOT NULL,
    "voicingId" TEXT NOT NULL,
    "chordId" TEXT NOT NULL,
    "context" TEXT,

    CONSTRAINT "VoicingChord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progression" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Progression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionChord" (
    "id" TEXT NOT NULL,
    "progressionId" TEXT NOT NULL,
    "chordId" TEXT NOT NULL,
    "voicingId" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProgressionChord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chord_symbol_key" ON "Chord"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "VoicingChord_voicingId_chordId_key" ON "VoicingChord"("voicingId", "chordId");

-- AddForeignKey
ALTER TABLE "VoicingChord" ADD CONSTRAINT "VoicingChord_voicingId_fkey" FOREIGN KEY ("voicingId") REFERENCES "Voicing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicingChord" ADD CONSTRAINT "VoicingChord_chordId_fkey" FOREIGN KEY ("chordId") REFERENCES "Chord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionChord" ADD CONSTRAINT "ProgressionChord_progressionId_fkey" FOREIGN KEY ("progressionId") REFERENCES "Progression"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionChord" ADD CONSTRAINT "ProgressionChord_chordId_fkey" FOREIGN KEY ("chordId") REFERENCES "Chord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionChord" ADD CONSTRAINT "ProgressionChord_voicingId_fkey" FOREIGN KEY ("voicingId") REFERENCES "Voicing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
