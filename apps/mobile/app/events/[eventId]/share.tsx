import * as React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Image, Linking, Share, View } from "react-native";
import type { LaunchLinkVerification } from "@eventfilm/api-client";
import type { AnalyticsEventName, EventSummary, Photo } from "@eventfilm/shared";
import { buildHostLaunchKit, buildHostShareAssets, getEventTemplate } from "@eventfilm/shared";
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

  const launchKit = event ? buildHostLaunchKit(event) : null;
  const shareAssets = event ? buildHostShareAssets(event) : null;
  const template = event ? getEventTemplate(event.eventTemplateSlug) : null;

  return (
    <Screen>
      <TaskHeader
        eyebrow="Share event"
        title={event ? `${event.name} is ready to share.` : "Preparing share link"}
        body={template ? `${template.name}. Keep Guest Upload, Live Wall, and Recap in their own moments.` : "Guests scan the QR code or open the guest link from any browser. No account needed."}
      />
      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading sharing details..." /> : null}
      {event ? (
        <>
          {shareAssets ? (
            <>
              {shareAssets.links.map((link) => (
                <ShareLinkCard
                  key={link.key}
                  title={link.label}
                  subtitle={`${link.audience}. ${link.timing}. ${link.purpose}`}
                  url={link.url}
                  tone={link.key === "guest" ? "accent" : undefined}
                  onShare={() => shareLink(link.label, link.url, link.shareText, link.shareAnalyticsName)}
                  onCopy={() => copyLink(link.label, link.url, link.copyAnalyticsName)}
                />
              ))}
              {message ? <SuccessState message={message} /> : null}

              <Card tone="warm">
                <SectionHeader title="Invite poster" subtitle="Web-only poster page for printing or saving as PDF." />
                <Body>{shareAssets.poster.instruction}. {shareAssets.poster.noDownloadCopy}.</Body>
                <Button tone="secondary" onPress={() => Linking.openURL(buildWebUrl(event, shareAssets.poster.posterPath))}>Open poster page</Button>
              </Card>
            </>
          ) : null}

          <LinkHealthPanel linkChecks={linkChecks} />

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <SectionHeader title="QR code" subtitle="Place this where guests naturally pause." />
              <Badge>{event.photoCount} photos</Badge>
            </View>
            {event.qrCodeDataUrl ? (
              <View style={{ borderRadius: 28, borderCurve: "continuous", backgroundColor: "#fff", padding: 18, borderWidth: 1, borderColor: colors.border }}>
                <Image source={{ uri: event.qrCodeDataUrl }} style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }} />
              </View>
            ) : null}
          </Card>

          {launchKit ? (
            <>
              <Card tone="warm">
                <SectionHeader title="Invite text" subtitle="Short enough for a group chat or story." />
                <Body>{launchKit.inviteText}</Body>
                <Button tone="secondary" onPress={() => copyText("Guest invite", shareAssets?.inviteText || launchKit.inviteText)}>Copy invite text</Button>
              </Card>

              <Card>
                <SectionHeader title="Host notes" subtitle="A quick reminder for the event flow." />
                <Body tone="muted">{launchKit.hostInstructions}</Body>
                <Body tone="muted">{launchKit.modeInstructions}</Body>
                <Button tone="secondary" onPress={() => copyText("Host instructions", launchKit.hostInstructions)}>Copy host instructions</Button>
              </Card>

              <Card>
                <SectionHeader title="Suggested caption" subtitle="Ready for social or a group message." />
                <Body>{shareAssets?.socialPostCopy || launchKit.socialCaption}</Body>
                <Button tone="secondary" onPress={() => copyText("Caption", shareAssets?.socialPostCopy || launchKit.socialCaption)}>Copy caption</Button>
              </Card>
            </>
          ) : null}
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
}: {
  title: string;
  subtitle: string;
  url?: string;
  tone?: "accent";
  onShare: () => void;
  onCopy: () => void;
}) {
  return (
    <LinkBlock label={title} description={subtitle} url={url || "Link unavailable until the event reloads."} tone={tone}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button disabled={!url} onPress={onShare}>Share</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button tone="secondary" disabled={!url} onPress={onCopy}>Copy link</Button>
        </View>
      </View>
    </LinkBlock>
  );
}
