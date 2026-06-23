import * as React from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import type { EventAnalyticsSummary, LaunchLinkVerification } from "@eventfilm/api-client";
import type { EventSettingsFieldErrors, EventSummary, HostFeedbackInput, Photo, PhotoVisibilityStatus, UpdateEventSettingsInput } from "@eventfilm/shared";
import { buildDuplicateEventInput, buildEventRecapStory, buildHostLaunchKit, buildHostShareAssets, buildLiveWallDisplayLinks, buildPostEventHostSummary, challengeLabel, deriveEventLifecycleStatus, getEventTemplate, validateEventSettingsInput, validateHostFeedback } from "@eventfilm/shared";
import { ActionButton, Badge, Body, Button, Card, EmptyState, ErrorState, Field, FieldGroup, LinkBlock, LoadingState, PhotoCard, Screen, SectionHeader, StatTile, TaskHeader, colors } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDateObject(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

type PickerMode = "date" | "time";

function DateTimeField({ label, helper, value, onChange, error }: { label: string; helper?: string; value: Date; onChange: (value: Date) => void; error?: string }) {
  const [pickerMode, setPickerMode] = React.useState<PickerMode | null>(null);
  const isIos = process.env.EXPO_OS === "ios";

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    setPickerMode(null);
    if (event.type === "dismissed" || !selected) return;
    onChange(selected);
  }

  return (
    <View style={{ gap: 8 }}>
      <FieldGroup label={label} helper={helper} error={error}>
        <Pressable
          onPress={() => setPickerMode((mode) => (mode ? null : "date"))}
          style={({ pressed }) => ({
            minHeight: 54,
            justifyContent: "center",
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: "#fff",
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: 15,
          })}
        >
          <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>{formatDateObject(value)}</Text>
        </Pressable>
      </FieldGroup>
      {isIos ? (
        <DateTimePicker
          mode="datetime"
          value={value}
          display="compact"
          onChange={(_event, selected) => {
            if (selected) onChange(selected);
          }}
          style={{ alignSelf: "flex-start" }}
        />
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton onPress={() => setPickerMode("date")}>Change date</ActionButton>
          <ActionButton onPress={() => setPickerMode("time")}>Change time</ActionButton>
        </View>
      )}
      {pickerMode && !isIos ? <DateTimePicker mode={pickerMode} value={value} display="default" onChange={handleChange} /> : null}
    </View>
  );
}

function buildWebUrl(event: EventSummary, path: string) {
  try {
    return new URL(path, event.eventLink).toString();
  } catch {
    return path;
  }
}

const BETA_ISSUE_AREAS = [
  ["guest_upload", "Guest upload"],
  ["live_wall", "Live Wall"],
  ["recap", "Recap"],
  ["qr_poster", "QR or poster"],
  ["moderation", "Moderation"],
  ["analytics", "Analytics"],
  ["other", "Other"],
] as const;

type EventSettingsForm = {
  name: string;
  description: string;
  eventDate: Date;
  revealAt: Date;
  photoLimitPerGuest: string;
};

function eventSettingsFormFromEvent(event: Pick<EventSummary, "name" | "description" | "eventDate" | "revealAt" | "photoLimitPerGuest">): EventSettingsForm {
  return {
    name: event.name,
    description: event.description || "",
    eventDate: new Date(event.eventDate),
    revealAt: new Date(event.revealAt),
    photoLimitPerGuest: String(event.photoLimitPerGuest),
  };
}

function eventSettingsInputFromForm(form: EventSettingsForm): UpdateEventSettingsInput {
  return {
    name: form.name,
    description: form.description,
    eventDate: form.eventDate.toISOString(),
    revealAt: form.revealAt.toISOString(),
    photoLimitPerGuest: Number(form.photoLimitPerGuest),
  };
}

export default function EventDetailScreen() {
  const { eventId, created } = useLocalSearchParams<{ eventId: string; created?: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = React.useState<EventAnalyticsSummary | null>(null);
  const [linkChecks, setLinkChecks] = React.useState<LaunchLinkVerification[]>([]);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [settingsForm, setSettingsForm] = React.useState<EventSettingsForm | null>(null);
  const [settingsFieldErrors, setSettingsFieldErrors] = React.useState<EventSettingsFieldErrors>({});
  const [settingsStatus, setSettingsStatus] = React.useState("");
  const [linkCopyStatus, setLinkCopyStatus] = React.useState("");
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [createdHandoffDismissed, setCreatedHandoffDismissed] = React.useState(false);

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
      setSettingsForm(eventSettingsFormFromEvent(data.event));
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

  function updateSettingsField(field: keyof EventSettingsForm, value: string | Date) {
    setSettingsForm((current) => (current ? { ...current, [field]: value } : current));
    setSettingsFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSettingsStatus("");
  }

  function cancelSettingsEdit() {
    if (!event) return;
    setSettingsForm(eventSettingsFormFromEvent(event));
    setSettingsFieldErrors({});
    setSettingsStatus("Changes canceled.");
  }

  async function saveSettingsEdit() {
    if (!eventId || !settingsForm) return;
    const input = eventSettingsInputFromForm(settingsForm);
    const validation = validateEventSettingsInput(input);
    if (!validation.ok) {
      setSettingsFieldErrors(validation.fieldErrors);
      setSettingsStatus(validation.error);
      return;
    }

    setSettingsSaving(true);
    setSettingsStatus("");
    setSettingsFieldErrors({});
    try {
      const data = await api.updateHostEventSettings(eventId, validation.value);
      setEvent(data.event);
      setSettingsForm(eventSettingsFormFromEvent(data.event));
      setSettingsStatus("Event settings saved.");
    } catch (err) {
      const apiFieldErrors = (err as { data?: { fieldErrors?: EventSettingsFieldErrors } }).data?.fieldErrors;
      if (apiFieldErrors) setSettingsFieldErrors(apiFieldErrors);
      setSettingsStatus((err as Error).message || "Could not save event settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function copyEventLink(label: string, value?: string | null) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setLinkCopyStatus(`${label} copied.`);
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
          setSettingsForm(eventSettingsFormFromEvent(data.event));
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
    api.trackAnalyticsEvent({
      name: "beta_handoff_viewed",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }, [api, event]);

  const launchKit = event ? buildHostLaunchKit(event) : null;
  const shareAssets = event ? buildHostShareAssets(event) : null;
  const liveWallDisplayLinks = event ? buildLiveWallDisplayLinks(event) : [];
  const template = event ? getEventTemplate(event.eventTemplateSlug) : null;
  const lifecycle = event ? deriveEventLifecycleStatus(event, analyticsSummary || undefined) : null;
  const lifecycleStatus = lifecycle?.status;
  const savedSettingsForm = event ? eventSettingsFormFromEvent(event) : null;
  const settingsDirty = Boolean(settingsForm && savedSettingsForm && JSON.stringify({ ...settingsForm, eventDate: settingsForm.eventDate.toISOString(), revealAt: settingsForm.revealAt.toISOString() }) !== JSON.stringify({ ...savedSettingsForm, eventDate: savedSettingsForm.eventDate.toISOString(), revealAt: savedSettingsForm.revealAt.toISOString() }));
  const liveSettingsValidation = settingsForm ? validateEventSettingsInput(eventSettingsInputFromForm(settingsForm)) : null;
  const visibleSettingsFieldErrors = {
    ...(settingsDirty && liveSettingsValidation && !liveSettingsValidation.ok ? liveSettingsValidation.fieldErrors : {}),
    ...settingsFieldErrors,
  };
  const canSaveSettings = Boolean(settingsDirty && !settingsSaving && liveSettingsValidation?.ok);
  const showCreatedHandoff = created === "1" && !createdHandoffDismissed;

  function dismissCreatedHandoff() {
    setCreatedHandoffDismissed(true);
    if (event) router.replace(`/events/${event.id}`);
  }

  React.useEffect(() => {
    if (!event || !lifecycleStatus) return;
    api.trackAnalyticsEvent({
      name: "event_lifecycle_viewed",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", lifecycleStatus },
    }).catch(() => {});
  }, [api, event, lifecycleStatus]);

  return (
    <Screen bottomPadding={96} wide>
      {event ? (
        <TaskHeader eyebrow="Event hub" title={event.name} body={event.description || "Share the guest link, monitor uploads, and keep the album moving."} action={(
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge>{event.photoCount} photos</Badge>
            {lifecycle ? <Badge tone={lifecycle.tone === "green" ? "green" : lifecycle.tone === "plum" ? "dark" : lifecycle.tone === "amber" ? "amber" : "stone"}>{lifecycle.label}</Badge> : null}
            {template ? <Badge tone="amber">{template.name}</Badge> : null}
            <Badge tone="stone">{challengeLabel(event.challenge)}</Badge>
          </View>
        )} />
      ) : (
        <TaskHeader eyebrow="Event hub" title="Loading event" body="Gathering the latest photos and sharing details." />
      )}

      {error ? <ErrorState message={error} /> : null}
      {linkCopyStatus ? <Body tone="success">{linkCopyStatus}</Body> : null}
      {!event ? <LoadingState label="Loading event details..." /> : null}

      {event ? (
        <>
          {showCreatedHandoff ? (
            <Card tone="warm">
              <SectionHeader title="Your event is ready." subtitle={event.name} action={<Badge tone="green">Event dashboard</Badge>} />
              <Body tone="muted">Start by sharing the guest upload link. Guests can add photos without an account.</Body>
              <View style={{ gap: 8 }}>
                <Body tone="muted">1. Share the guest link before people arrive.</Body>
                <Body tone="muted">2. Open the Live Wall during the event.</Body>
                <Body tone="muted">3. Share the recap after reveal.</Body>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button onPress={() => copyEventLink("Guest upload link", event.eventLink)}>Share guest link</Button>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" onPress={() => router.push(`/events/${event.id}/share`)}>Open event</Button>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" disabled={!event.liveWallLink} onPress={() => event.liveWallLink && Linking.openURL(event.liveWallLink)}>Open Live Wall</Button>
                </View>
              </View>
              <Button tone="secondary" onPress={dismissCreatedHandoff}>Dismiss</Button>
            </Card>
          ) : null}
          <View style={{ gap: 12 }}>
            <SectionHeader title="Share kit" subtitle={`Event: ${formatDate(event.eventDate)}. Reveal: ${formatDate(event.revealAt)}.`} />
            <LinkBlock label="Guest Upload" description="The link and QR code guests need before and during the event." url={event.eventLink} tone="accent">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Link href={`/events/${event.id}/share`} asChild>
                    <Button>Share kit</Button>
                  </Link>
                </View>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Button tone="secondary" onPress={() => copyEventLink("Guest upload link", event.eventLink)}>Copy guest link</Button>
                </View>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Link href={`/upload?eventLink=${encodeURIComponent(event.eventLink)}`} asChild>
                    <Button tone="secondary">Test upload</Button>
                  </Link>
                </View>
              </View>
            </LinkBlock>
            {shareAssets ? (
              <Card tone="warm">
                <SectionHeader title="QR code" subtitle="Web-only print page for table signs, group chats, and QR handoffs." />
                <Body tone="muted">{shareAssets.poster.instruction}. {shareAssets.poster.noDownloadCopy}.</Body>
                <Button tone="secondary" onPress={() => Linking.openURL(buildWebUrl(event, shareAssets.poster.posterPath))}>Open poster page</Button>
              </Card>
            ) : null}
            <LinkBlock label="Live Wall" description="Open this on a TV or projector. Use your phone to share links and keep the QR handy." url={event.liveWallLink}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button disabled={!event.liveWallLink} onPress={() => event.liveWallLink && Linking.openURL(event.liveWallLink)}>Open Live Wall</Button>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" onPress={() => router.push(`/events/${event.id}/share`)}>Share guest link</Button>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" disabled={!event.liveWallLink} onPress={() => copyEventLink("Live Wall link", event.liveWallLink)}>Copy Live Wall link</Button>
                </View>
              </View>
            </LinkBlock>
            <LinkBlock label="Recap" description="Open the finished memory page with highlights, contributors, challenge moments, and the full album." url={event.recapLink}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" disabled={!event.recapLink} onPress={() => event.recapLink && Linking.openURL(event.recapLink)}>Open Recap</Button>
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Button tone="secondary" disabled={!event.recapLink || lifecycle?.phase !== "after"} onPress={() => router.push(`/events/${event.id}/share`)}>Share recap</Button>
                </View>
              </View>
            </LinkBlock>
            {liveWallDisplayLinks.length ? (
              <Card tone="warm">
                <SectionHeader title="Advanced Live Wall modes" subtitle="Web presentation is primary. Use these when you want a specific room display." />
                <View style={{ gap: 10 }}>
                  {liveWallDisplayLinks.filter((link) => link.key !== "grid").map((link) => (
                    <LinkBlock key={link.key} label={link.label} description={link.purpose} url={link.url}>
                      <Button tone="secondary" onPress={() => Linking.openURL(link.url)}>Open</Button>
                    </LinkBlock>
                  ))}
                </View>
              </Card>
            ) : null}
            <Card tone="warm">
              <SectionHeader title="Run of show" subtitle="Guest Upload before arrival. Live Wall during the event. Recap after reveal." />
              <Body tone="muted">The share kit has copy, QR, and captions when you need to send everything cleanly.</Body>
            </Card>
            {settingsForm ? (
              <Card>
                <SectionHeader title="Event settings" subtitle="Edit the basics guests and hosts see across this event." action={settingsDirty ? <Badge tone="amber">Unsaved</Badge> : <Badge tone="stone">Saved</Badge>} />
                <FieldGroup label="Event name" error={visibleSettingsFieldErrors.name}>
                  <Field value={settingsForm.name} onChangeText={(value) => updateSettingsField("name", value)} autoCapitalize="words" />
                </FieldGroup>
                <FieldGroup label="Description" error={visibleSettingsFieldErrors.description}>
                  <Field value={settingsForm.description} onChangeText={(value) => updateSettingsField("description", value)} multiline />
                </FieldGroup>
                <DateTimeField label="Event date" value={settingsForm.eventDate} onChange={(value) => updateSettingsField("eventDate", value)} error={visibleSettingsFieldErrors.eventDate} />
                <DateTimeField label="Reveal time" helper="Guests can upload before this, but the full album stays hidden until the reveal time." value={settingsForm.revealAt} onChange={(value) => updateSettingsField("revealAt", value)} error={visibleSettingsFieldErrors.revealAt} />
                <FieldGroup label="Photo limit per guest" helper="Keep this high for casual events and lower for games or prompts." error={visibleSettingsFieldErrors.photoLimitPerGuest}>
                  <Field keyboardType="number-pad" value={settingsForm.photoLimitPerGuest} onChangeText={(value) => updateSettingsField("photoLimitPerGuest", value)} />
                </FieldGroup>
                {settingsStatus ? <Body tone={settingsStatus.includes("saved") || settingsStatus.includes("canceled") ? "success" : "danger"}>{settingsStatus}</Body> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 132 }}>
                    <Button tone="secondary" disabled={!settingsDirty || settingsSaving} onPress={cancelSettingsEdit}>Cancel</Button>
                  </View>
                  <View style={{ flex: 1, minWidth: 132 }}>
                    <Button loading={settingsSaving} disabled={!canSaveSettings} onPress={saveSettingsEdit}>Save changes</Button>
                  </View>
                </View>
              </Card>
            ) : null}
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
            <FirstEventHandoffPanel event={event} />
            <HostBetaIssuePanel event={event} />
            {lifecycle ? <RepeatEventPanel event={event} lifecycle={lifecycle} /> : null}
            <LinkHealthPanel linkChecks={linkChecks} />
            <EventMetricsPanel summary={analyticsSummary} />
            <RecapStatusPanel event={event} summary={analyticsSummary} />
            <EventAwardsVotingPanel summary={analyticsSummary} photos={event.photos} recapLink={event.recapLink} />
            {lifecycle?.phase === "after" ? (
              <>
                <PostEventSummaryPanel event={event} summary={analyticsSummary} />
                <HostFeedbackPanel event={event} summary={analyticsSummary} onSubmitted={loadEvent} />
              </>
            ) : null}
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

function FirstEventHandoffPanel({ event }: { event: EventSummary }) {
  const { api } = useAuth();

  function track(label: string) {
    api.trackAnalyticsEvent({
      name: "first_event_checklist_item_clicked",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", label },
    }).catch(() => {});
  }

  function openPoster() {
    track("open_poster");
    api.trackAnalyticsEvent({
      name: "qr_poster_viewed_from_beta_handoff",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
    Linking.openURL(buildWebUrl(event, `/dashboard/events/${event.id}/poster`));
  }

  function openLiveWall() {
    track("open_live_wall");
    api.trackAnalyticsEvent({
      name: "live_wall_opened_from_beta_handoff",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
    if (event.liveWallLink) Linking.openURL(event.liveWallLink);
  }

  function openRecap() {
    track("open_recap");
    api.trackAnalyticsEvent({
      name: "recap_opened_from_beta_handoff",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
    if (event.recapLink) Linking.openURL(event.recapLink);
  }

  return (
    <Card tone="accent">
      <SectionHeader title="Host checklist" subtitle="Use Guest Upload before and during the event, Live Wall during, and Recap after reveal." />
      <View style={{ gap: 10 }}>
        <Body tone="muted">Before: confirm the mode and share the QR poster or guest link.</Body>
        <Body tone="muted">During: keep Live Wall open and remind guests to use Safari or Chrome.</Body>
        <Body tone="muted">After: feature favorites, hide off-tone photos, then share Recap.</Body>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 132 }}>
          <Button tone="secondary" onPress={openPoster}>QR poster</Button>
        </View>
        <View style={{ flex: 1, minWidth: 132 }}>
          <Button tone="secondary" disabled={!event.liveWallLink} onPress={openLiveWall}>Live Wall</Button>
        </View>
        <View style={{ flex: 1, minWidth: 132 }}>
          <Button tone="secondary" disabled={!event.recapLink} onPress={openRecap}>Recap</Button>
        </View>
      </View>
      <Body tone="muted">Upload issues: retry with a smaller image, switch Wi-Fi or cellular, then report a beta issue below if guests still cannot upload.</Body>
    </Card>
  );
}

function HostBetaIssuePanel({ event }: { event: EventSummary }) {
  const { api } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<HostFeedbackInput>({ kind: "beta_issue", issueArea: "guest_upload", note: "" });
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function openForm() {
    setOpen(true);
    api.trackAnalyticsEvent({
      name: "beta_issue_report_opened",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }

  function openSupport() {
    api.trackAnalyticsEvent({
      name: "host_support_link_clicked",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
    Linking.openURL(buildWebUrl(event, "/support"));
  }

  async function submitIssue() {
    const validation = validateHostFeedback(form);
    if (!validation.ok) {
      setStatus(validation.message);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await api.submitHostEventFeedback(event.id, validation.value);
      setStatus("Issue sent. Fernando can see it in founder beta ops.");
      setOpen(false);
      setForm({ kind: "beta_issue", issueArea: "guest_upload", note: "" });
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader title="Report a beta issue" subtitle="Host-only, with this event attached. Do not include sensitive guest details." action={!open ? <Button onPress={openForm}>Open</Button> : undefined} />
      {open ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BETA_ISSUE_AREAS.map(([value, label]) => (
              <Button key={value} tone={form.issueArea === value ? "primary" : "secondary"} onPress={() => setForm((current) => ({ ...current, issueArea: value }))}>{label}</Button>
            ))}
          </View>
          <FieldGroup label="What happened?">
            <Field value={form.note || ""} onChangeText={(note) => setForm((current) => ({ ...current, note }))} multiline />
          </FieldGroup>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Button loading={busy} onPress={submitIssue}>Send issue</Button>
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Button tone="secondary" onPress={openSupport}>Support</Button>
            </View>
          </View>
        </View>
      ) : null}
      {status ? <Body tone={status.includes("sent") ? "success" : "danger"}>{status}</Body> : null}
    </Card>
  );
}

function RepeatEventPanel({ event, lifecycle }: { event: EventSummary; lifecycle: ReturnType<typeof deriveEventLifecycleStatus> }) {
  const { api } = useAuth();
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const duplicateDefaults = buildDuplicateEventInput(event);

  async function createSimilar() {
    setBusy(true);
    setStatus("");
    api.trackAnalyticsEvent({
      name: "duplicate_event_clicked",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", duplicateSourceEventId: event.id },
    }).catch(() => {});
    api.trackAnalyticsEvent({
      name: "repeat_event_cta_clicked",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", label: "create_similar" },
    }).catch(() => {});
    try {
      const data = await api.duplicateHostEvent(event.id, {
        name: duplicateDefaults.name,
        description: duplicateDefaults.description,
        eventDate: duplicateDefaults.eventDate,
        revealAt: duplicateDefaults.revealAt,
        photoLimitPerGuest: duplicateDefaults.photoLimitPerGuest,
      });
      api.trackAnalyticsEvent({
        name: "duplicate_event_created",
        source: "mobile",
        path: `/events/${event.id}`,
        eventId: data.event.id,
        eventSlug: data.event.slug,
        metadata: { surface: "event_detail", duplicateSourceEventId: event.id, duplicateEventId: data.event.id },
      }).catch(() => {});
      router.replace(`/events/${data.event.id}`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function shareRecap() {
    if (!event.recapLink) return;
    try {
      await Linking.openURL(event.recapLink);
      api.trackAnalyticsEvent({
        name: "recap_shared_after_event",
        source: "mobile",
        path: `/events/${event.id}`,
        eventId: event.id,
        eventSlug: event.slug,
        metadata: { surface: "event_detail", method: "open_url" },
      }).catch(() => {});
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  if (!lifecycle.shouldShowRepeatCta) {
    return (
      <Card tone="warm">
        <SectionHeader title={lifecycle.label} subtitle={lifecycle.description} />
      </Card>
    );
  }

  return (
    <Card tone="accent">
      <SectionHeader title="Run it again" subtitle="Copy this setup into a fresh event, then adjust the new date before sharing." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button loading={busy} onPress={createSimilar}>Create similar</Button>
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button tone="secondary" disabled={!event.recapLink} onPress={shareRecap}>Share recap</Button>
        </View>
      </View>
      {status ? <Body tone="danger">{status}</Body> : null}
    </Card>
  );
}

function PostEventSummaryPanel({ event, summary }: { event: EventSummary & { photos: Photo[] }; summary: EventAnalyticsSummary | null }) {
  const { api } = useAuth();
  const postSummary = buildPostEventHostSummary(event, event.photos, summary || {});

  React.useEffect(() => {
    api.trackAnalyticsEvent({
      name: "post_event_summary_viewed",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }, [api, event.id, event.slug]);

  return (
    <Card>
      <SectionHeader title="Recap activity" subtitle="Secondary event stats for host review." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatTile label="Photos" value={postSummary.totalPhotos} tone="accent" />
        <StatTile label="Contributors" value={postSummary.totalContributors} />
        <StatTile label="Guest joins" value={postSummary.guestJoins} />
        <StatTile label="Recap views" value={postSummary.recapOpens} />
        <StatTile label="Hidden" value={postSummary.hiddenPhotos} />
        <StatTile label="Reported" value={postSummary.reportedPhotos} />
      </View>
      {postSummary.topContributors.length ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title="People who uploaded" />
          {postSummary.topContributors.map((contributor) => (
            <View key={contributor.displayName} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, borderRadius: 16, borderCurve: "continuous", backgroundColor: "#faf7f2", padding: 12 }}>
              <Body>{contributor.displayName}</Body>
              <Badge tone="stone">{contributor.photoCount}</Badge>
            </View>
          ))}
        </View>
      ) : null}
      {postSummary.awardWinners.length ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title="Award winners" />
          {postSummary.awardWinners.slice(0, 4).map((winner) => (
            <Body key={winner.categoryId} tone={winner.photoId ? "success" : "muted"}>{winner.categoryLabel}: {winner.photoId ? `${winner.voteCount} votes${winner.isTie ? " - tie" : ""}` : "No winner yet"}</Body>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function RecapStatusPanel({ event, summary }: { event: EventSummary & { photos: Photo[] }; summary: EventAnalyticsSummary | null }) {
  const { api } = useAuth();
  const [status, setStatus] = React.useState("");
  const story = buildEventRecapStory(event, event.photos, { awardVoting: summary?.eventAwardsVoting });
  const lifecycle = deriveEventLifecycleStatus(event, summary || undefined);
  const featuredCount = event.photos.filter((photo) => photo.isFeatured).length;

  async function previewRecap() {
    if (!event.recapLink) return;
    await Linking.openURL(event.recapLink);
  }

  async function shareRecap() {
    if (!event.recapLink) return;
    await Linking.openURL(event.recapLink);
    api.trackAnalyticsEvent({
      name: "recap_shared_after_event",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", method: "open_url" },
    }).catch(() => {});
  }

  async function copyRecapLink() {
    if (!event.recapLink) return;
    await Clipboard.setStringAsync(event.recapLink);
    setStatus("Recap link copied.");
  }

  return (
    <Card tone="warm">
      <SectionHeader
        title={lifecycle.phase === "after" ? "Recap is ready to share" : "Recap is building"}
        subtitle="Preview the recap, feature favorites, then send one link to everyone."
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatTile label="Visible" value={story.totalPhotos} tone="accent" />
        <StatTile label="Featured" value={featuredCount} />
        <StatTile label="Contributors" value={story.contributorCount} />
      </View>
      <Body tone="muted">{story.challengeHeadline}: {story.challengeCopy}</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Button disabled={!event.recapLink} onPress={previewRecap}>Preview recap</Button>
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Button tone="secondary" disabled={!event.recapLink} onPress={shareRecap}>Share recap</Button>
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Button tone="secondary" disabled={!event.recapLink} onPress={copyRecapLink}>Copy link</Button>
        </View>
      </View>
      {status ? <Body tone="success">{status}</Body> : null}
    </Card>
  );
}

function HostFeedbackPanel({ event, summary, onSubmitted }: { event: EventSummary; summary: EventAnalyticsSummary | null; onSubmitted: () => Promise<void> }) {
  const { api } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<HostFeedbackInput>({ outcome: "great", repeatIntent: "yes", guestConfusion: "", featureRequest: "", note: "" });
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (summary?.hostFeedback) {
    return (
      <Card tone="success">
        <SectionHeader title="Feedback saved" subtitle={summary.hostFeedback.skippedAt ? "This event feedback was skipped." : "Thanks. Host feedback is stored for review."} />
      </Card>
    );
  }

  function openForm() {
    setOpen(true);
    api.trackAnalyticsEvent({
      name: "host_feedback_opened",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }

  async function submit(input: HostFeedbackInput) {
    const validation = validateHostFeedback(input);
    if (!validation.ok) {
      setStatus(validation.message);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await api.submitHostEventFeedback(event.id, validation.value);
      setStatus(validation.value.skipped ? "Skipped." : "Thanks. Feedback saved.");
      await onSubmitted();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionHeader title="Host feedback" subtitle="A quick private note about how the event went." action={!open ? <Button onPress={openForm}>Open</Button> : undefined} />
      {open ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["great", "okay", "rough"] as const).map((outcome) => (
              <Button key={outcome} tone={form.outcome === outcome ? "primary" : "secondary"} onPress={() => setForm((current) => ({ ...current, outcome }))}>{outcome}</Button>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["yes", "maybe", "no"] as const).map((repeatIntent) => (
              <Button key={repeatIntent} tone={form.repeatIntent === repeatIntent ? "primary" : "secondary"} onPress={() => setForm((current) => ({ ...current, repeatIntent }))}>{repeatIntent}</Button>
            ))}
          </View>
          <FieldGroup label="Guest confusion">
            <Field value={form.guestConfusion || ""} onChangeText={(guestConfusion) => setForm((current) => ({ ...current, guestConfusion }))} multiline />
          </FieldGroup>
          <FieldGroup label="Feature request">
            <Field value={form.featureRequest || ""} onChangeText={(featureRequest) => setForm((current) => ({ ...current, featureRequest }))} multiline />
          </FieldGroup>
          <FieldGroup label="Optional note">
            <Field value={form.note || ""} onChangeText={(note) => setForm((current) => ({ ...current, note }))} multiline />
          </FieldGroup>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Button loading={busy} onPress={() => submit(form)}>Submit</Button>
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Button tone="secondary" disabled={busy} onPress={() => submit({ skipped: true })}>Skip</Button>
            </View>
          </View>
        </View>
      ) : null}
      {status ? <Body tone={status.includes("Thanks") || status.includes("Skipped") ? "success" : "danger"}>{status}</Body> : null}
    </Card>
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
      <SectionHeader title="Event activity" subtitle="Guest, wall, recap, and moderation activity." />
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
      <SectionHeader title="Event Awards voting" subtitle="Guests vote from the public Recap, then winners appear inside the finished memory page." />
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
      <Button tone="secondary" disabled={!recapLink} onPress={() => recapLink && Linking.openURL(recapLink)}>Open Recap awards</Button>
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
