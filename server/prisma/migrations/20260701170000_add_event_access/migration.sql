CREATE TABLE "EventAccess" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventAccess_userId_eventId_key" ON "EventAccess"("userId", "eventId");
CREATE INDEX "EventAccess_eventId_idx" ON "EventAccess"("eventId");
CREATE INDEX "EventAccess_userId_idx" ON "EventAccess"("userId");

ALTER TABLE "EventAccess"
  ADD CONSTRAINT "EventAccess_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAccess"
  ADD CONSTRAINT "EventAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
