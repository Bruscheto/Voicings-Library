-- AlterTable
ALTER TABLE "Voicing" ADD COLUMN     "slashBass" TEXT;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicingTag" (
    "voicingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "VoicingTag_pkey" PRIMARY KEY ("voicingId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- AddForeignKey
ALTER TABLE "VoicingTag" ADD CONSTRAINT "VoicingTag_voicingId_fkey" FOREIGN KEY ("voicingId") REFERENCES "Voicing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicingTag" ADD CONSTRAINT "VoicingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
