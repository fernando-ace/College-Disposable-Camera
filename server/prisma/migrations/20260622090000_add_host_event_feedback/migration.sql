-- CreateTable
CREATE TABLE "HostEventFeedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "outcome" TEXT,
    "repeatIntent" TEXT,
    "guestConfusion" TEXT,
    "featureRequest" TEXT,
    "note" TEXT,
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostEventFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostEventFeedback_eventId_idx" ON "HostEventFeedback"("eventId");

-- CreateIndex
CREATE INDEX "HostEventFeedback_hostId_idx" ON "HostEventFeedback"("hostId");

-- CreateIndex
CREATE INDEX "HostEventFeedback_eventId_hostId_idx" ON "HostEventFeedback"("eventId", "hostId");

-- AddForeignKey
ALTER TABLE "HostEventFeedback" ADD CONSTRAINT "HostEventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostEventFeedback" ADD CONSTRAINT "HostEventFeedback_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
