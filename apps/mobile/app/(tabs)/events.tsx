import * as React from "react";
import { Link, router } from "expo-router";
import { View } from "react-native";
import type { AnalyticsSummary } from "@eventfilm/api-client";
import type { EventSummary } from "@eventfilm/shared";
import { Badge, Body, Button, Card, EmptyState, ErrorState, EventCard, LoadingState, Screen, SectionHeader, StatTile, TaskHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

function eventTime(value: string) {
  return new Date(value).getTime();
}

function sortEvents(events: EventSummary[]) {
  const now = Date.now();
  return [...events].sort((a, b) => {
    const aDistance = Math.abs(eventTime(a.eventDate) - now);
    const bDistance = Math.abs(eventTime(b.eventDate) - now);
    return aDistance - bDistance;
  });
}

export default function EventsScreen() {
  const { api, user, signOut } = useAuth();
  const [events, setEvents] = React.useState<EventSummary[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = React.useState<AnalyticsSummary | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function loadEvents() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [data, analytics] = await Promise.all([
        api.getHostEvents(),
        api.getAnalyticsSummary().catch(() => null),
      ]);
      setEvents(data.events);
      if (analytics) setAnalyticsSummary(analytics.summary);
    } catch (err) {
      setError(`${(err as Error).message}. Check your connection and API URL, then try again.`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let isMounted = true;

    if (user) {
      Promise.all([
        api.getHostEvents(),
        api.getAnalyticsSummary().catch(() => null),
      ])
        .then(([data, analytics]) => {
          if (!isMounted) return;
          setEvents(data.events);
          if (analytics) setAnalyticsSummary(analytics.summary);
        })
        .catch((err) => {
          if (isMounted) setError(`${(err as Error).message}. Check your connection and API URL, then try again.`);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [api, user]);

  if (!user) {
    return (
      <Screen>
        <TaskHeader
          eyebrow="Host command center"
          title="Sign in to manage your events."
          body="Sign in to create albums, share QR links, and watch guest photos arrive in one organized place."
        />
        <Card>
          <Body tone="muted">EventFilm keeps hosting lightweight: create the event, share the link, and let guests do the rest.</Body>
          <Link href="/auth" asChild>
            <Button>Sign in to host</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  const sortedEvents = sortEvents(events);
  const featuredEvent = sortedEvents[0];
  const remainingEvents = sortedEvents.slice(1);
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);
  const activeEvents = events.filter((event) => new Date(event.revealAt).getTime() >= Date.now()).length;

  return (
    <Screen bottomPadding={112}>
      <TaskHeader
        eyebrow="Host command center"
        title="Your events, ready to share."
        body={`Signed in as ${user.email}`}
        action={(
          <View style={{ gap: 10 }}>
            <Link href="/create-event" asChild>
              <Button>Create event</Button>
            </Link>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" loading={loading} onPress={loadEvents}>Refresh</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="ghost" onPress={signOut}>Sign out</Button>
              </View>
            </View>
          </View>
        )}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatTile label="Events" value={events.length} tone="accent" />
        <StatTile label="Active or upcoming" value={activeEvents} />
        <StatTile label="Photos" value={totalPhotos} />
      </View>

      {error ? <ErrorState message={error} /> : null}
      {loading && !events.length ? <LoadingState label="Loading your events..." /> : null}

      {!events.length && !loading ? (
        <EmptyState
          title="Create your first EventFilm album"
          body="Start with the event name and reveal time. The guest link, QR code, Live Wall, and Recap links appear right after setup."
          action={(
            <Link href="/create-event" asChild>
              <Button>Create your first event</Button>
            </Link>
          )}
        />
      ) : null}

      {featuredEvent ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Next up" subtitle="Open this event to share links, check uploads, or prep the room display." />
          <EventCard event={featuredEvent} featured onPress={() => router.push(`/events/${featuredEvent.id}`)} />
        </View>
      ) : null}

      {analyticsSummary ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <SectionHeader title="30-day activity" subtitle="Compact signal from guest, upload, wall, and recap activity." />
            <Badge tone="stone">Beta</Badge>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatTile label="Guest joins" value={analyticsSummary.guestJoins} />
            <StatTile label="Uploads" value={analyticsSummary.uploads} />
            <StatTile label="Live Wall" value={analyticsSummary.liveWallOpens} />
            <StatTile label="Recaps" value={analyticsSummary.recapOpens} />
          </View>
        </Card>
      ) : null}

      {remainingEvents.length ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Other events" subtitle="Sorted by the event closest to now." />
          {remainingEvents.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
