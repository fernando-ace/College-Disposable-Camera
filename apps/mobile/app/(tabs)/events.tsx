import * as React from "react";
import { Link, router } from "expo-router";
import { View } from "react-native";
import type { EventSummary } from "@eventfilm/shared";
import { challengeLabel } from "@eventfilm/shared";
import { Body, Button, Card, EmptyState, ErrorState, EventCard, Field, FieldGroup, LoadingState, Screen, SectionHeader, TaskHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

export default function EventsScreen() {
  const { api, user, signOut } = useAuth();
  const [events, setEvents] = React.useState<EventSummary[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function loadEvents() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getHostEvents();
      setEvents(data.events);
    } catch (err) {
      setError(`${(err as Error).message}. Check your connection and API URL, then try again.`);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let isMounted = true;

    if (user) {
      api.getHostEvents()
        .then((data) => {
          if (!isMounted) return;
          setEvents(data.events);
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
          eyebrow="Host dashboard"
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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = React.useMemo(() => {
    if (!normalizedQuery) return events;
    return events.filter((event) => [
      event.name,
      event.description || "",
      challengeLabel(event.challenge),
    ].join(" ").toLowerCase().includes(normalizedQuery));
  }, [events, normalizedQuery]);

  return (
    <Screen bottomPadding={112}>
      <TaskHeader
        eyebrow="Host dashboard"
        title="Event library"
        body={`Signed in as ${user.email}. Open an event to manage links, photos, recap, and settings.`}
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

      {error ? <ErrorState message={error} /> : null}
      {loading && !events.length ? <LoadingState label="Loading your events..." /> : null}

      {!events.length && !loading ? (
        <EmptyState
          title="Create your first EventFilm album"
          body="Start with the event name and photo setup. The guest link, QR code, and Recap links appear right after setup."
          action={(
            <Link href="/create-event" asChild>
              <Button>Create your first event</Button>
            </Link>
          )}
        />
      ) : null}

      {events.length ? (
        <View style={{ gap: 12 }}>
          <Card>
            <FieldGroup label="Search events" helper={`${filteredEvents.length} of ${events.length} ${events.length === 1 ? "event" : "events"}`}>
              <Field value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by name or photo setup" autoCapitalize="none" />
            </FieldGroup>
          </Card>
          <SectionHeader title="Your events" subtitle="Open an event to manage guest links, photos, recap, downloads, and settings." />
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
          ))}
          {!filteredEvents.length ? (
            <EmptyState
              title="No matching events"
              body="Try a different event name or photo setup."
              action={<Button tone="secondary" onPress={() => setSearchQuery("")}>Clear search</Button>}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
