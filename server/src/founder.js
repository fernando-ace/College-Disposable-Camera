const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 10;
const ACTIVITY_LIMIT = 25;

const FOUNDER_METRIC_DEFINITIONS = {
  totalHosts: "All registered host accounts.",
  activeHostsLast30Days: "Distinct hosts who created at least one event in the last 30 days.",
  totalEvents: "All events created in EventFilm.",
  eventsCreatedLast7Days: "Events created in the last 7 days.",
  eventsCreatedLast30Days: "Events created in the last 30 days.",
  totalGuestJoins: "Tracked guest_joined_event analytics events.",
  totalUploads: "Stored photos that have not been deleted.",
  uploadsLast7Days: "Stored, non-deleted photos uploaded in the last 7 days.",
  totalContributors: "Guest rows created across all events.",
  totalRecapOpens: "Tracked recap_opened analytics events.",
  totalFeedbackSubmissions: "Saved host feedback rows, including skipped feedback.",
};

function publicEventUrl(clientUrl, slug) {
  return `${clientUrl}/e/${slug}`;
}

function recapUrl(clientUrl, slug) {
  return `${clientUrl}/recap/${slug}`;
}

function compactEvent(event, { requesterUserId, clientUrl }) {
  const challenge = event.challenges?.[0] || null;
  const photoCount = event._count?.photos ?? event.photoCount ?? 0;
  const guestCount = event._count?.guests ?? event.guestCount ?? 0;
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    hostEmail: event.host?.email || null,
    isOwnEvent: event.hostId === requesterUserId,
    eventDate: event.eventDate,
    revealAt: event.revealAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    eventTemplateSlug: event.eventTemplateSlug,
    promptPackSlug: event.promptPackSlug,
    mode: challenge?.type || "NONE",
    modeLabel: challenge?.title || (challenge?.type ? challenge.type : "No Challenge"),
    photoCount,
    guestCount,
    eventLink: publicEventUrl(clientUrl, event.slug),
    recapLink: recapUrl(clientUrl, event.slug),
    hostEventPath: event.hostId === requesterUserId ? `/dashboard/events/${event.id}` : null,
  };
}

function compactUpload(photo, { clientUrl, serverUrl, getPhotoPreviewUrl }) {
  return {
    id: photo.id,
    eventId: photo.eventId,
    eventName: photo.event?.name || "Untitled event",
    eventSlug: photo.event?.slug || "",
    guestNickname: photo.guest?.nickname || null,
    createdAt: photo.createdAt,
    challengeItemLabel: photo.challengeItemLabel,
    previewUrl: `${serverUrl}${getPhotoPreviewUrl(photo.id)}`,
    eventLink: photo.event?.slug ? publicEventUrl(clientUrl, photo.event.slug) : null,
    recapLink: photo.event?.slug ? recapUrl(clientUrl, photo.event.slug) : null,
  };
}

function compactFeedback(feedback, { requesterUserId }) {
  return {
    id: feedback.id,
    eventId: feedback.eventId,
    eventName: feedback.event?.name || "Untitled event",
    eventSlug: feedback.event?.slug || "",
    hostEmail: feedback.host?.email || null,
    isOwnEvent: feedback.hostId === requesterUserId,
    hostEventPath: feedback.hostId === requesterUserId ? `/dashboard/events/${feedback.eventId}` : null,
    kind: feedback.kind || "post_event",
    issueArea: feedback.issueArea || null,
    outcome: feedback.outcome,
    repeatIntent: feedback.repeatIntent,
    guestConfusion: feedback.guestConfusion,
    featureRequest: feedback.featureRequest,
    note: feedback.note,
    skippedAt: feedback.skippedAt,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

function usageRows(items, total, labelFor) {
  return items
    .map((item) => ({
      key: item.key || "unknown",
      label: labelFor ? labelFor(item.key || "unknown") : item.key || "Unknown",
      count: item.count,
      percent: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function templateLabel(slug) {
  return slug === "unknown" ? "No template" : slug;
}

function promptPackLabel(slug) {
  return slug === "unknown" ? "No prompt pack" : slug;
}

function modeLabel(type) {
  if (!type || type === "NONE" || type === "unknown") return "No Challenge";
  return String(type).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function analyticsActivityLabel(name) {
  const labels = {
    guest_joined_event: "Guest joined",
    photo_upload_succeeded: "Upload succeeded",
    recap_opened: "Recap opened",
    duplicate_event_created: "Duplicate event created",
    award_vote_cast: "Event Awards vote cast",
  };
  return labels[name] || name.replace(/_/g, " ");
}

function mergeActivity({ recentEvents, recentAnalytics, recentFeedback }) {
  const eventActivities = recentEvents.map((event) => ({
    id: `event-${event.id}`,
    type: "event_created",
    label: "Event created",
    eventId: event.id,
    eventName: event.name,
    eventSlug: event.slug,
    createdAt: event.createdAt,
  }));
  const analyticsActivities = recentAnalytics.map((item) => ({
    id: `analytics-${item.id}`,
    type: item.name,
    label: analyticsActivityLabel(item.name),
    eventId: item.eventId,
    eventName: item.event?.name || item.eventSlug || "Event",
    eventSlug: item.event?.slug || item.eventSlug || "",
    createdAt: item.createdAt,
  }));
  const feedbackActivities = recentFeedback.map((feedback) => ({
    id: `feedback-${feedback.id}`,
    type: feedback.kind === "beta_issue" ? "beta_issue_submitted" : "host_feedback_submitted",
    label: feedback.kind === "beta_issue" ? "Beta issue reported" : feedback.skippedAt ? "Feedback skipped" : "Feedback submitted",
    eventId: feedback.eventId,
    eventName: feedback.event?.name || "Event",
    eventSlug: feedback.event?.slug || "",
    createdAt: feedback.createdAt,
  }));
  return [...eventActivities, ...analyticsActivities, ...feedbackActivities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, ACTIVITY_LIMIT);
}

function countByValue(rows, valueFor) {
  const counts = new Map();
  for (const row of rows) {
    const key = valueFor(row) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => ({ key, count }));
}

async function buildFounderOverview({ prisma, requesterUserId, now = new Date(), clientUrl, serverUrl, getPhotoPreviewUrl }) {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const eventInclude = {
    host: { select: { email: true } },
    challenges: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1 },
    _count: {
      select: {
        guests: true,
        photos: { where: { deletedAt: null } },
      },
    },
  };

  const [
    totalHosts,
    activeHostRows,
    totalEvents,
    eventsCreatedLast7Days,
    eventsCreatedLast30Days,
    totalGuestJoins,
    totalUploads,
    uploadsLast7Days,
    totalContributors,
    totalRecapOpens,
    totalFeedbackSubmissions,
    recentEvents,
    activeEvents,
    recentUploads,
    recentFeedback,
    recentBetaIssues,
    recentAnalytics,
    allEventsForUsage,
    awardVoteCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.event.findMany({ where: { createdAt: { gte: since30 } }, distinct: ["hostId"], select: { hostId: true } }),
    prisma.event.count(),
    prisma.event.count({ where: { createdAt: { gte: since7 } } }),
    prisma.event.count({ where: { createdAt: { gte: since30 } } }),
    prisma.analyticsEvent.count({ where: { name: "guest_joined_event" } }),
    prisma.photo.count({ where: { deletedAt: null } }),
    prisma.photo.count({ where: { deletedAt: null, createdAt: { gte: since7 } } }),
    prisma.guest.count(),
    prisma.analyticsEvent.count({ where: { name: "recap_opened" } }),
    prisma.hostEventFeedback.count(),
    prisma.event.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT, include: eventInclude }),
    prisma.event.findMany({
      where: {
        OR: [
          { createdAt: { gte: since30 } },
          { eventDate: { gte: now } },
          { revealAt: { gte: now } },
          { photos: { some: { deletedAt: null, createdAt: { gte: since30 } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
      include: eventInclude,
    }),
    prisma.photo.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      include: { event: { select: { id: true, name: true, slug: true } }, guest: true },
    }),
    prisma.hostEventFeedback.findMany({
      where: { kind: "post_event" },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      include: { event: { select: { id: true, name: true, slug: true } }, host: { select: { email: true } } },
    }),
    prisma.hostEventFeedback.findMany({
      where: { kind: "beta_issue" },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
      include: { event: { select: { id: true, name: true, slug: true } }, host: { select: { email: true } } },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        name: { in: ["guest_joined_event", "photo_upload_succeeded", "recap_opened", "duplicate_event_created", "award_vote_cast"] },
      },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LIMIT,
    }),
    prisma.event.findMany({
      select: {
        eventTemplateSlug: true,
        promptPackSlug: true,
        challenges: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1, select: { type: true } },
      },
    }),
    prisma.photoVote.count(),
  ]);

  const recentAnalyticsEventIds = [...new Set(recentAnalytics.map((item) => item.eventId).filter(Boolean))];
  const recentAnalyticsSlugs = [...new Set(recentAnalytics.map((item) => item.eventSlug).filter(Boolean))];
  const analyticsEvents = recentAnalyticsEventIds.length || recentAnalyticsSlugs.length
    ? await prisma.event.findMany({
        where: { OR: [{ id: { in: recentAnalyticsEventIds } }, { slug: { in: recentAnalyticsSlugs } }] },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const byId = new Map(analyticsEvents.map((event) => [event.id, event]));
  const bySlug = new Map(analyticsEvents.map((event) => [event.slug, event]));
  const hydratedRecentAnalytics = recentAnalytics.map((item) => ({
    ...item,
    event: (item.eventId && byId.get(item.eventId)) || (item.eventSlug && bySlug.get(item.eventSlug)) || null,
  }));

  const common = { requesterUserId, clientUrl, serverUrl, getPhotoPreviewUrl };
  const modeCounts = countByValue(allEventsForUsage, (event) => event.challenges?.[0]?.type || "NONE");
  const templateCounts = countByValue(allEventsForUsage, (event) => event.eventTemplateSlug || "unknown");
  const promptPackCounts = countByValue(allEventsForUsage, (event) => event.promptPackSlug || "unknown");

  return {
    generatedAt: now.toISOString(),
    overview: {
      totalHosts,
      activeHostsLast30Days: activeHostRows.length,
      totalEvents,
      eventsCreatedLast7Days,
      eventsCreatedLast30Days,
      totalGuestJoins,
      totalUploads,
      uploadsLast7Days,
      totalContributors,
      totalRecapOpens,
      totalFeedbackSubmissions,
    },
    funnel: {
      hosts: totalHosts,
      events: totalEvents,
      guestJoins: totalGuestJoins,
      uploads: totalUploads,
      recapOpens: totalRecapOpens,
      feedbackSubmissions: totalFeedbackSubmissions,
    },
    recentEvents: recentEvents.map((event) => compactEvent(event, common)),
    activeEvents: activeEvents.map((event) => compactEvent(event, common)),
    recentUploads: recentUploads.map((photo) => compactUpload(photo, common)),
    recentFeedback: recentFeedback.map((feedback) => compactFeedback(feedback, common)),
    recentBetaIssues: recentBetaIssues.map((feedback) => compactFeedback(feedback, common)),
    usage: {
      eventModes: usageRows(modeCounts, totalEvents, modeLabel),
      eventTemplates: usageRows(templateCounts, totalEvents, templateLabel),
      promptPacks: usageRows(promptPackCounts, totalEvents, promptPackLabel),
      eventAwardsVotes: awardVoteCount,
      colorHuntEvents: modeCounts.find((item) => item.key === "COLOR_HUNT")?.count || 0,
      memoryCapsuleEvents: modeCounts.find((item) => item.key === "MEMORY_CAPSULE")?.count || 0,
    },
    activity: mergeActivity({ recentEvents, recentAnalytics: hydratedRecentAnalytics, recentFeedback: [...recentBetaIssues, ...recentFeedback] }),
    metricDefinitions: FOUNDER_METRIC_DEFINITIONS,
  };
}

module.exports = {
  buildFounderOverview,
  countByValue,
  FOUNDER_METRIC_DEFINITIONS,
  usageRows,
};
