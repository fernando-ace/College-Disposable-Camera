-- CreateEnum
CREATE TYPE "PhotoVisibilityStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PhotoReportReason" AS ENUM ('INAPPROPRIATE', 'PRIVACY', 'SPAM', 'OTHER');

-- AlterTable
ALTER TABLE "Photo"
ADD COLUMN "visibilityStatus" "PhotoVisibilityStatus" NOT NULL DEFAULT 'VISIBLE',
ADD COLUMN "hiddenAt" TIMESTAMP(3),
ADD COLUMN "hiddenReason" TEXT,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featuredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PhotoReport" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "reason" "PhotoReportReason" NOT NULL,
    "note" TEXT,
    "reporterHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "PhotoReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_eventId_visibilityStatus_idx" ON "Photo"("eventId", "visibilityStatus");

-- CreateIndex
CREATE INDEX "Photo_eventId_isFeatured_idx" ON "Photo"("eventId", "isFeatured");

-- CreateIndex
CREATE INDEX "PhotoReport_photoId_idx" ON "PhotoReport"("photoId");

-- CreateIndex
CREATE INDEX "PhotoReport_eventId_idx" ON "PhotoReport"("eventId");

-- CreateIndex
CREATE INDEX "PhotoReport_eventId_createdAt_idx" ON "PhotoReport"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "PhotoReport" ADD CONSTRAINT "PhotoReport_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoReport" ADD CONSTRAINT "PhotoReport_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
