DELETE FROM "AnalyticsEvent"
WHERE "name" LIKE 'live_wall_%'
   OR "metadata"->>'issueArea' = 'live_wall';

UPDATE "HostEventFeedback"
SET "issueArea" = 'other'
WHERE "issueArea" = 'live_wall';
