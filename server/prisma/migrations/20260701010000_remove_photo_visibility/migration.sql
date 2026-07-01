UPDATE "Photo"
SET "deletedAt" = COALESCE("deletedAt", NOW())
WHERE "visibilityStatus" = 'HIDDEN'
  AND "deletedAt" IS NULL;

DROP INDEX IF EXISTS "Photo_eventId_visibilityStatus_idx";

ALTER TABLE "Photo"
DROP COLUMN "visibilityStatus",
DROP COLUMN "hiddenAt",
DROP COLUMN "hiddenReason";

DROP TYPE "PhotoVisibilityStatus";
