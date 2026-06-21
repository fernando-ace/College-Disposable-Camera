import * as React from "react";
import { Link, router } from "expo-router";
import { View } from "react-native";
import type { AnalyticsSummary } from "@eventfilm/api-client";
import type { EventSummary } from "@eventfilm/shared";
import { Badge, Body, Button, Card, EmptyState, ErrorState, EventCard, HeroHeader, LoadingState, Screen, SectionHeader } from "../../src/components/ui";
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
        <HeroHeader
          eyebrow="Host command center"
          title="Your events live here."
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

  return (
    <Screen>
      <HeroHeader
        eyebrow="Host command center"
        title="Plan it. Share it. Watch the album fill up."
        body={`Signed in as ${user.email}`}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Link href="/create-event" asChild>
              <Button>Create event</Button>
            </Link>
          </View>
          <View style={{ flex: 1 }}>
            <Button tone="secondary" loading={loading} onPress={loadEvents}>Refresh</Button>
          </View>
        </View>
      </HeroHeader>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatCard label="Events" value={String(events.length)} />
        <StatCard label="Photos" value={String(totalPhotos)} />
      </View>

      {analyticsSummary ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <SectionHeader title="30-day activity" subtitle="Simple beta signal across your hosted events." />
            <Badge tone="stone">Beta</Badge>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Metric label="Guest joins" value={analyticsSummary.guestJoins} />
            <Metric label="Uploads" value={analyticsSummary.uploads} />
            <Metric label="Live Wall" value={analyticsSummary.liveWallOpens} />
            <Metric label="Recaps" value={analyticsSummary.recapOpens} />
          </View>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} /> : null}
      {loading && !events.length ? <LoadingState label="Loading your events..." /> : null}

      {!events.length && !loading ? (
        <EmptyState
          title="Create your first EventFilm album"
          body="Start with the event name and reveal time. You will get a guest link and QR code right after setup."
          action={(
            <Link href="/create-event" asChild>
              <Button>Create your first event</Button>
            </Link>
          )}
        />
      ) : null}

      {featuredEvent ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Next up" subtitle="The event most likely to need your attention." />
          <EventCard event={featuredEvent} featured onPress={() => router.push(`/events/${featuredEvent.id}`)} />
        </View>
      ) : null}

      {remainingEvents.length ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="All events" subtitle="Open an event to share, review, or view recent uploads." />
          {remainingEvents.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          ))}
        </View>
      ) : null}

      <Button tone="ghost" onPress={signOut}>Sign out</Button>
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding={14}>
      <Body>{value}</Body>
      <Body tone="muted">{label}</Body>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ minWidth: 118, flex: 1, gap: 3 }}>
      <Body>{String(value)}</Body>
      <Body tone="muted">{label}</Body>
    </View>
  );
}
