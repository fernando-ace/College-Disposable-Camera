-- AlterEnum
ALTER TYPE "ChallengeType" ADD VALUE 'EVENT_AWARDS';
ALTER TYPE "ChallengeType" ADD VALUE 'MEMORY_CAPSULE';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "challengeItemId" TEXT,
ADD COLUMN "challengeItemLabel" TEXT,
ADD COLUMN "challengeItemKind" TEXT;

-- CreateIndex
CREATE INDEX "Photo_challengeItemId_idx" ON "Photo"("challengeItemId");
