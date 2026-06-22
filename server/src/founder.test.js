const assert = require("node:assert/strict");
const test = require("node:test");
const { buildFounderOverview, countByValue, usageRows } = require("./founder");

function fakePrisma() {
  return {
    user: { count: async () => 0 },
    event: {
      count: async () => 0,
      findMany: async (args = {}) => {
        if (args.distinct?.includes("hostId")) return [];
        return [];
      },
    },
    analyticsEvent: {
      count: async () => 0,
      findMany: async () => [],
    },
    photo: {
      count: async () => 0,
      findMany: async () => [],
    },
    guest: { count: async () => 0 },
    hostEventFeedback: {
      count: async () => 0,
      findMany: async () => [],
    },
    photoReport: {
      count: async () => 0,
      findMany: async () => [],
    },
    photoVote: { count: async () => 0 },
  };
}

test("founder overview handles empty beta state", async () => {
  const overview = await buildFounderOverview({
    prisma: fakePrisma(),
    requesterUserId: "founder",
    now: new Date("2026-06-22T12:00:00.000Z"),
    clientUrl: "https://eventfilm.example.com",
    serverUrl: "https://api.eventfilm.example.com",
    getPhotoPreviewUrl: (id) => `/api/photos/${id}/preview`,
  });

  assert.equal(overview.generatedAt, "2026-06-22T12:00:00.000Z");
  assert.equal(overview.overview.activeHostsLast30Days, 0);
  assert.equal(overview.overview.totalEvents, 0);
  assert.deepEqual(overview.recentEvents, []);
  assert.deepEqual(overview.reportedPhotos, []);
  assert.deepEqual(overview.recentBetaIssues, []);
  assert.equal(overview.usage.eventAwardsVotes, 0);
  assert.match(overview.metricDefinitions.activeHostsLast30Days, /created at least one event/i);
});

test("usage helpers aggregate template and mode rows", () => {
  const rows = countByValue(
    [
      { mode: "EVENT_AWARDS" },
      { mode: "EVENT_AWARDS" },
      { mode: "COLOR_HUNT" },
      { mode: "" },
    ],
    (row) => row.mode,
  );
  const usage = usageRows(rows, 4, (key) => key);

  assert.deepEqual(usage.map((row) => [row.key, row.count, row.percent]), [
    ["EVENT_AWARDS", 2, 50],
    ["COLOR_HUNT", 1, 25],
    ["unknown", 1, 25],
  ]);
});
