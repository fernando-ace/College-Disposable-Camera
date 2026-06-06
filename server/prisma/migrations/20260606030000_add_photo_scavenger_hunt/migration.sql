-- AlterEnum
ALTER TYPE "ChallengeType" ADD VALUE 'PHOTO_SCAVENGER_HUNT';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "challengePromptId" TEXT,
ADD COLUMN "challengePromptText" TEXT;

-- CreateIndex
CREATE INDEX "Photo_challengePromptId_idx" ON "Photo"("challengePromptId");
