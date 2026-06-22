CREATE TABLE "PhotoVote" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "challengeItemId" TEXT NOT NULL,
  "guestClientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoVote_eventId_challengeItemId_guestClientId_key" ON "PhotoVote"("eventId", "challengeItemId", "guestClientId");
CREATE INDEX "PhotoVote_eventId_photoId_idx" ON "PhotoVote"("eventId", "photoId");
CREATE INDEX "PhotoVote_eventId_challengeItemId_idx" ON "PhotoVote"("eventId", "challengeItemId");

ALTER TABLE "PhotoVote"
  ADD CONSTRAINT "PhotoVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoVote"
  ADD CONSTRAINT "PhotoVote_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
