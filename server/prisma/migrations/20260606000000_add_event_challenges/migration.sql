-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('COLOR_HUNT');

-- CreateTable
CREATE TABLE "EventChallenge" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "eventChallengeId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "colorSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "challengeId" TEXT,
ADD COLUMN "challengeParticipantId" TEXT,
ADD COLUMN "challengeColorName" TEXT;

-- CreateIndex
CREATE INDEX "EventChallenge_eventId_idx" ON "EventChallenge"("eventId");

-- CreateIndex
CREATE INDEX "EventChallenge_eventId_isActive_idx" ON "EventChallenge"("eventId", "isActive");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_eventChallengeId_idx" ON "ChallengeParticipant"("eventChallengeId");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_eventChallengeId_colorSlug_idx" ON "ChallengeParticipant"("eventChallengeId", "colorSlug");

-- CreateIndex
CREATE INDEX "Photo_challengeId_idx" ON "Photo"("challengeId");

-- CreateIndex
CREATE INDEX "Photo_challengeParticipantId_idx" ON "Photo"("challengeParticipantId");

-- AddForeignKey
ALTER TABLE "EventChallenge" ADD CONSTRAINT "EventChallenge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_eventChallengeId_fkey" FOREIGN KEY ("eventChallengeId") REFERENCES "EventChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "EventChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_challengeParticipantId_fkey" FOREIGN KEY ("challengeParticipantId") REFERENCES "ChallengeParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
