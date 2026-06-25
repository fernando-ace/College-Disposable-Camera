import * as React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Image, Linking, Share, View } from "react-native";
import type { LaunchLinkVerification } from "@eventfilm/api-client";
import type { AnalyticsEventName, EventSummary, Photo } from "@eventfilm/shared";
import { CHALLENGE_TYPES, buildHostShareAssets, deriveEventLifecycleStatus } from "@eventfilm/shared";
import { Badge, Body, Button, Card, ErrorState, LinkBlock, LoadingState, Screen, SectionHeader, SuccessState, TaskHeader, colors } from "../../../src/components/ui";
import { useAuth } from "../../../src/auth";

function buildWebUrl(event: EventSummary, path: string) {
  try {
    return new URL(path, event.eventLink).toString();
  } catch {
    return path;
  }
}

export default function ShareEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [linkChecks, setLinkChecks] = React.useState<LaunchLinkVerification[]>([]);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getHostEvent(eventId),
      api.verifyHostEventLinks(eventId).catch(() => null),
    ])
      .then(([data, links]) => {
        setEvent(data.event);
        if (links) setLinkChecks(links.links);
      })
      .catch((err) => setError(`${(err as Error).message}. Reopen this event when your connection is stable.`));
  }, [api, eventId]);

  React.useEffect(() => {
    if (!event) return;
    api.trackAnalyticsEvent({
      name: "host_launch_kit_opened",
      source: "mobile",
      path: `/events/${event.id}/share`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "share_screen" },
    }).catch(() => {});
  }, [api, event]);

  function trackShareAction(name: AnalyticsEventName, surface: string) {
    if (!event) return;
    api.trackAnalyticsEvent({
      name,
      source: "mobile",
      path: `/events/${event.id}/share`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface },
    }).catch(() => {});
  }

  async function copyLink(label: string, url?: string, analyticsName: AnalyticsEventName = "guest_link_copied") {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setMessage(`${label} copied.`);
    trackShareAction(analyticsName, "share_screen");
  }

  async function shareLink(label: string, url?: string, text?: string, analyticsName: AnalyticsEventName = "guest_link_shared") {
    if (!event || !url) return;
    trackShareAction("native_share_opened", "share_screen");
    await Share.share({ message: text || `${label} for ${event.name}: ${url}`, url });
    trackShareAction(analyticsName, "share_screen");
  }

  async function copyText(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    setMessage(`${label} copied.`);
  }

  const shareAssets = event ? buildHostShareAssets(event) : null;
  const lifecycle = event ? deriveEventLifecycleStatus(event) : null;
  const isMemoryCapsule = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE;
  const isRecapReady = Boolean(event?.recapLink && (!isMemoryCapsule || lifecycle?.phase === "after"));
  const recapUnavailableCopy = lifecycle?.phase === "after"
    ? "The recap link is not available yet. Refresh this event before sharing it."
    : "The recap will be ready after the Memory Capsule reveal time.";

  return (
    <Screen>
      <TaskHeader
        eyebrow="Share kit"
        title={event ? event.name : "Preparing share links"}
        body={isMemoryCapsule ? "Send the guest link before reveal, keep the QR poster visible during it, and share the recap after reveal." : "Send the guest link, keep the QR poster visible, and share the recap whenever the album is ready."}
      />
      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading sharing details..." /> : null}
      {event ? (
        <>
          {shareAssets ? (
            <>
              <Card tone="warm">
                <SectionHeader title="Event status" subtitle={lifecycle?.description || "Use the right link for the moment."} action={lifecycle ? <Badge>{lifecycle.label}</Badge> : undefined} />
                <Body tone="muted">Next step: {lifecycle?.phase === "during" ? "Keep the guest link and QR code visible while guests upload." : lifecycle?.phase === "after" || !isMemoryCapsule ? "Share the recap with everyone." : "Send the guest upload link before reveal time."}</Body>
                {lifecycle?.phase === "during" ? (
                  <Button onPress={() => copyLink("Guest upload link", event.eventLink, "guest_link_copied")}>Copy guest upload link</Button>
                ) : lifecycle?.phase === "after" ? (
                  <Button disabled={!isRecapReady} onPress={() => copyLink("Recap link", event.recapLink, "recap_link_copied")}>Copy recap link</Button>
                ) : (
                  <Button onPress={() => copyLink("Guest upload link", event.eventLink)}>Copy guest upload link</Button>
                )}
              </Card>

              <Card>
                <SectionHeader title="Guest link" subtitle="Send this in the group chat so guests can start adding photos." />
                <ShareLinkCard
                  title="Guest upload link"
                  subtitle="No account needed."
                  url={event.eventLink}
                  tone="accent"
                  shareLabel="Share guest link"
                  copyLabel="Copy guest link"
                  onShare={() => shareLink("Guest upload link", event.eventLink, shareAssets.guestInviteMessage, "guest_link_shared")}
                  onCopy={() => copyLink("Guest upload link", event.eventLink, "guest_link_copied")}
                />
                <Button tone="secondary" onPress={() => Linking.openURL(buildWebUrl(event, shareAssets.poster.posterPath))}>Open QR poster</Button>
                <Card tone="warm" padding={14}>
                  <SectionHeader title="Invite message" />
                  <Body>{shareAssets.guestInviteMessage}</Body>
                  <Button tone="secondary" onPress={() => copyText("Invite message", shareAssets.guestInviteMessage)}>Copy invite message</Button>
                </Card>
              </Card>

              <Card>
                <SectionHeader title="During the event" subtitle="Keep the guest link and QR poster handy while you review incoming photos." />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Button tone="secondary" onPress={() => shareLink("Guest upload link", event.eventLink, shareAssets.guestInviteMessage, "guest_link_shared")}>Share guest link</Button>
                  </View>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Button tone="secondary" onPress={() => copyLink("Guest upload link", event.eventLink, "guest_link_copied")}>Copy guest link</Button>
                  </View>
                </View>
                <Body tone="muted">Use the event hub to review uploads, hide off-tone photos, and keep the album clean before the recap goes out.</Body>
              </Card>

              <Card>
                <SectionHeader title="Recap" subtitle={isRecapReady ? (isMemoryCapsule ? "Send the recap when the reveal is open." : "Send the recap whenever the album is ready.") : recapUnavailableCopy} />
                {isRecapReady ? (
                  <>
                    <ShareLinkCard
                      title="Recap link"
                      subtitle="Share the finished memory page with everyone."
                      url={event.recapLink}
                      shareLabel="Share recap"
                      copyLabel="Copy recap link"
                      onShare={() => shareLink("Recap", event.recapLink, shareAssets.recapMessage, "recap_link_shared")}
                      onCopy={() => copyLink("Recap link", event.recapLink, "recap_link_copied")}
                    />
                    <Button tone="secondary" onPress={() => copyText("Recap message", shareAssets.recapMessage)}>Copy recap message</Button>
                  </>
                ) : (
                  <Body tone="muted">{recapUnavailableCopy}</Body>
                )}
              </Card>

              {message ? <SuccessState message={message} /> : null}

              <Card tone="warm">
                <SectionHeader title="QR code" subtitle={shareAssets.qrPosterHint} action={<Badge>{event.photoCount} photos</Badge>} />
                <Body>{shareAssets.poster.instruction}. {shareAssets.poster.noDownloadCopy}</Body>
                {event.qrCodeDataUrl ? (
                  <View style={{ borderRadius: 28, borderCurve: "continuous", backgroundColor: "#fff", padding: 18, borderWidth: 1, borderColor: colors.border }}>
                    <Image source={{ uri: event.qrCodeDataUrl }} style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }} />
                  </View>
                ) : null}
              </Card>
            </>
          ) : null}

          <LinkHealthPanel linkChecks={linkChecks} />
        </>
      ) : null}
    </Screen>
  );
}

function LinkHealthPanel({ linkChecks }: { linkChecks: LaunchLinkVerification[] }) {
  if (!linkChecks.length) return null;

  return (
    <Card tone={linkChecks.some((link) => !link.ok) ? "danger" : "success"}>
      <SectionHeader title="Beta link check" subtitle="Use deployed HTTPS links before sharing with real guests." />
      <View style={{ gap: 9 }}>
        {linkChecks.map((link) => (
          <View key={link.key} style={{ gap: 4 }}>
            <Badge tone={link.ok ? "green" : "red"}>{link.ok ? "Ready" : "Review"}</Badge>
            <Body tone={link.ok ? "muted" : "danger"}>{link.warning || `${link.label}: ${link.url}`}</Body>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ShareLinkCard({
  title,
  subtitle,
  url,
  tone,
  onShare,
  onCopy,
  shareLabel = "Share",
  copyLabel = "Copy link",
}: {
  title: string;
  subtitle: string;
  url?: string;
  tone?: "accent";
  onShare: () => void;
  onCopy: () => void;
  shareLabel?: string;
  copyLabel?: string;
}) {
  return (
    <LinkBlock label={title} description={subtitle} url={url || "Link unavailable until the event reloads."} tone={tone}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button disabled={!url} onPress={onShare}>{shareLabel}</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button tone="secondary" disabled={!url} onPress={onCopy}>{copyLabel}</Button>
        </View>
      </View>
    </LinkBlock>
  );
}
