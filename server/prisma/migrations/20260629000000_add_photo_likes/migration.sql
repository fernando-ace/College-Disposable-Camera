CREATE TABLE "PhotoLike" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "guestClientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoLike_eventId_photoId_guestClientId_key" ON "PhotoLike"("eventId", "photoId", "guestClientId");
CREATE INDEX "PhotoLike_eventId_photoId_idx" ON "PhotoLike"("eventId", "photoId");
CREATE INDEX "PhotoLike_eventId_guestClientId_idx" ON "PhotoLike"("eventId", "guestClientId");

ALTER TABLE "PhotoLike"
  ADD CONSTRAINT "PhotoLike_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoLike"
  ADD CONSTRAINT "PhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PhotoLike" ("id", "eventId", "photoId", "guestClientId", "createdAt")
SELECT
  'like_' || md5("eventId" || ':' || "photoId" || ':' || "guestClientId"),
  "eventId",
  "photoId",
  "guestClientId",
  MIN("createdAt")
FROM "PhotoVote"
GROUP BY "eventId", "photoId", "guestClientId"
ON CONFLICT ("eventId", "photoId", "guestClientId") DO NOTHING;
