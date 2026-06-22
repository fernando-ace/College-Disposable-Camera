import * as React from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import type { EventAnalyticsSummary, LaunchLinkVerification } from "@eventfilm/api-client";
import type { EventSummary, Photo, PhotoVisibilityStatus } from "@eventfilm/shared";
import { buildHostLaunchKit, challengeLabel, getEventTemplate } from "@eventfilm/shared";
import { Badge, Body, Button, Card, EmptyState, ErrorState, LinkBlock, LoadingState, PhotoCard, Screen, SectionHeader, StatTile, TaskHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = React.useState<EventAnalyticsSummary | null>(null);
  const [linkChecks, setLinkChecks] = React.useState<LaunchLinkVerification[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function loadEvent() {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const [data, links] = await Promise.all([
        api.getHostEvent(eventId),
        api.verifyHostEventLinks(eventId).catch(() => null),
      ]);
      setEvent(data.event);
      if (links) setLinkChecks(links.links);
      const analytics = await api.getEventAnalyticsSummary(eventId).catch(() => null);
      if (analytics) setAnalyticsSummary(analytics.summary);
    } catch (err) {
      setError(`${(err as Error).message}. Check your connection and retry before the event.`);
    } finally {
      setLoading(false);
    }
  }

  async function updateVisibility(photo: Photo, visibilityStatus: PhotoVisibilityStatus) {
    if (!eventId) return;
    try {
      const data = await api.updatePhotoVisibility(eventId, photo.id, visibilityStatus, visibilityStatus === "HIDDEN" ? "Hidden by host" : undefined);
      setEvent((current) => current ? { ...current, photos: current.photos.map((item) => item.id === photo.id ? data.photo : item) } : current);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateFeatured(photo: Photo, isFeatured: boolean) {
    if (!eventId) return;
    try {
      const data = await api.updatePhotoFeatured(eventId, photo.id, isFeatured);
      setEvent((current) => current ? { ...current, photos: current.photos.map((item) => item.id === photo.id ? data.photo : item) } : current);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  React.useEffect(() => {
    let isMounted = true;

    if (eventId) {
      Promise.all([
        api.getHostEvent(eventId),
        api.verifyHostEventLinks(eventId).catch(() => null),
        api.getEventAnalyticsSummary(eventId).catch(() => null),
      ])
        .then(([data, links, analytics]) => {
          if (!isMounted) return;
          setEvent(data.event);
          if (links) setLinkChecks(links.links);
          if (analytics) setAnalyticsSummary(analytics.summary);
        })
        .catch((err) => {
          if (isMounted) setError(`${(err as Error).message}. Check your connection and retry before the event.`);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [api, eventId]);

  React.useEffect(() => {
    if (!event) return;
    api.trackAnalyticsEvent({
      name: "host_launch_kit_opened",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }, [api, event]);

  const launchKit = event ? buildHostLaunchKit(event) : null;
  const template = event ? getEventTemplate(event.eventTemplateSlug) : null;

  return (
    <Screen bottomPadding={96} wide>
      {event ? (
        <TaskHeader eyebrow="Event hub" title={event.name} body={event.description || "Share the guest link, monitor uploads, and keep the album moving."} action={(
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge>{event.photoCount} photos</Badge>
            {template ? <Badge tone="amber">{template.name}</Badge> : null}
            <Badge tone="stone">{challengeLabel(event.challenge)}</Badge>
          </View>
        )} />
      ) : (
        <TaskHeader eyebrow="Event hub" title="Loading event" body="Gathering the latest photos and sharing details." />
      )}

      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading event details..." /> : null}

      {event ? (
        <>
          <View style={{ gap: 12 }}>
            <SectionHeader title="Launch kit" subtitle={`Event: ${formatDate(event.eventDate)}. Reveal: ${formatDate(event.revealAt)}.`} />
            <LinkBlock label="Guest Upload" description="The link and QR code guests need before and during the event." url={event.eventLink} tone="accent">
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Link href={`/events/${event.id}/share`} asChild>
                    <Button>Share kit</Button>
                  </Link>
                </View>
                <View style={{ flex: 1 }}>
                  <Link href={`/upload?eventLink=${encodeURIComponent(event.eventLink)}`} asChild>
                    <Button tone="secondary">Test upload</Button>
                  </Link>
                </View>
              </View>
            </LinkBlock>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <LinkBlock label="Live Wall" description="Open on a TV, projector, or laptop while guests upload." url={event.liveWallLink}>
                  <Button tone="secondary" disabled={!event.liveWallLink} onPress={() => event.liveWallLink && Linking.openURL(event.liveWallLink)}>Open Live Wall</Button>
                </LinkBlock>
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <LinkBlock label="Recap" description="Share after reveal as the finished memory page." url={event.recapLink}>
                  <Button tone="secondary" disabled={!event.recapLink} onPress={() => event.recapLink && Linking.openURL(event.recapLink)}>Open Recap</Button>
                </LinkBlock>
              </View>
            </View>
            <Card tone="warm">
              <SectionHeader title="Run of show" subtitle="Guest Upload before arrival. Live Wall during the event. Recap after reveal." />
              <Body tone="muted">The share kit has copy, QR, and captions when you need to send everything cleanly.</Body>
            </Card>
            {launchKit ? (
              <Card>
                <SectionHeader title="Host checklist" subtitle="A quick run-of-show for the first event." />
                <View style={{ gap: 10 }}>
                  {launchKit.checklist.map((item, index) => (
                    <View key={item.key} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Badge tone={item.complete ? "green" : "stone"}>{index + 1}</Badge>
                      <Body tone={item.complete ? "success" : "muted"}>{item.label}</Body>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
            <LinkHealthPanel linkChecks={linkChecks} />
            <EventMetricsPanel summary={analyticsSummary} />
            <EventAwardsVotingPanel summary={analyticsSummary} photos={event.photos} recapLink={event.recapLink} />
            <RunOfShow />
            <Button tone="secondary" loading={loading} onPress={loadEvent}>Refresh photos</Button>
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Album activity" subtitle="Moderate recent uploads without losing sight of the event." />
            {event.photos.length ? (
              <View style={{ gap: 14 }}>
                {event.photos.map((photo) => (
                  <View key={photo.id} style={{ gap: 10 }}>
                    <PhotoCard photo={photo} compact />
                    <Card padding={13}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {photo.isFeatured ? <Badge>Featured</Badge> : null}
                        {photo.visibilityStatus === "HIDDEN" ? <Badge tone="red">Hidden</Badge> : null}
                        {photo.reportCount ? <Badge tone="red">{photo.reportCount} reported</Badge> : null}
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        <View style={{ flex: 1, minWidth: 132 }}>
                          {photo.visibilityStatus === "HIDDEN" ? (
                            <Button tone="secondary" onPress={() => updateVisibility(photo, "VISIBLE")}>Restore</Button>
                          ) : (
                            <Button tone="secondary" onPress={() => updateVisibility(photo, "HIDDEN")}>Hide</Button>
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 132 }}>
                          <Button tone="secondary" disabled={photo.visibilityStatus === "HIDDEN"} onPress={() => updateFeatured(photo, !photo.isFeatured)}>{photo.isFeatured ? "Unfeature" : "Feature"}</Button>
                        </View>
                      </View>
                      <Body tone="muted">Hide removes a photo from public views and keeps it restorable.</Body>
                    </Card>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                title="No guest photos yet"
                body="Share the QR link or open guest view to test the upload flow before the event starts."
                action={(
                  <Link href={`/events/${event.id}/share`} asChild>
                    <Button>Share event</Button>
                  </Link>
                )}
              />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function EventMetricsPanel({ summary }: { summary: EventAnalyticsSummary | null }) {
  if (!summary) return null;
  const rows = [
    ["Guest joins", summary.guestJoins],
    ["Uploads", summary.uploads],
    ["Live Wall", summary.liveWallOpens],
    ["Recaps", summary.recapOpens],
    ["Hidden", summary.hiddenPhotos],
    ["Reported", summary.reportedPhotos],
  ];

  return (
    <Card>
      <SectionHeader title="Event signal" subtitle="Guest, wall, recap, and moderation activity." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {rows.map(([label, value]) => (
          <StatTile key={label} label={String(label)} value={Number(value)} />
        ))}
      </View>
    </Card>
  );
}

function EventAwardsVotingPanel({ summary, photos, recapLink }: { summary: EventAnalyticsSummary | null; photos: Photo[]; recapLink?: string | null }) {
  const awardVoting = summary?.eventAwardsVoting;
  if (!awardVoting?.categories.length) return null;
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));

  return (
    <Card tone="warm">
      <SectionHeader title="Event Awards voting" subtitle="Guests vote from the public web Recap link." />
      <View style={{ gap: 10 }}>
        {awardVoting.categories.map((category) => {
          const leader = category.leaderPhotoIds[0] ? photosById.get(category.leaderPhotoIds[0]) : null;
          const voteCount = category.voteTotals[0]?.voteCount || 0;
          return (
            <Card key={category.categoryId} padding={13}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Body>{category.categoryLabel}</Body>
                {category.isTie ? <Badge tone="amber">Tie</Badge> : null}
              </View>
              <Body tone="muted">{category.submissionCount} submissions - {category.totalVotes} votes</Body>
              <Body tone={leader ? "success" : "muted"}>
                {leader ? `Leader: ${leader.guestNickname || "Guest photo"} (${voteCount} ${voteCount === 1 ? "vote" : "votes"})` : category.noSubmissions ? "No submissions yet." : "No votes yet."}
              </Body>
            </Card>
          );
        })}
      </View>
      <Button tone="secondary" disabled={!recapLink} onPress={() => recapLink && Linking.openURL(recapLink)}>Open Recap voting</Button>
      <Body tone="muted">Voting is browser/session based and intentionally lightweight.</Body>
    </Card>
  );
}

function LinkHealthPanel({ linkChecks }: { linkChecks: LaunchLinkVerification[] }) {
  if (!linkChecks.length) return null;

  return (
    <Card>
      <SectionHeader title="Public link check" subtitle="Confirm these are usable before the event starts." />
      <View style={{ gap: 10 }}>
        {linkChecks.map((link) => (
          <View key={link.key} style={{ gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Body>{link.label}</Body>
              <Badge tone={link.ok ? "green" : "red"}>{link.ok ? "Ready" : "Review"}</Badge>
            </View>
            <Body tone={link.ok ? "muted" : "danger"}>{link.warning || link.url}</Body>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RunOfShow() {
  const rows = [
    ["Before", "Create the event, verify the guest link, and place the QR code where guests will see it."],
    ["During", "Keep the Live Wall open and hide any reported or off-tone photos instead of deleting them."],
    ["After", "Refresh the album, feature favorites, then share the Recap link after reveal."],
  ];

  return (
    <Card tone="warm">
      <SectionHeader title="Before, during, after" subtitle="A compact host checklist." />
      {rows.map(([label, body]) => (
        <View key={label} style={{ gap: 4 }}>
          <Badge tone="stone">{label}</Badge>
          <Body tone="muted">{body}</Body>
        </View>
      ))}
    </Card>
  );
}
