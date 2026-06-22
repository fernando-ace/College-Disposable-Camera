ALTER TABLE "HostEventFeedback" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'post_event';
ALTER TABLE "HostEventFeedback" ADD COLUMN "issueArea" TEXT;

CREATE INDEX "HostEventFeedback_kind_createdAt_idx" ON "HostEventFeedback"("kind", "createdAt");
