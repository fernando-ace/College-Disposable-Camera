import * as React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Image, Share, View } from "react-native";
import type { LaunchLinkVerification } from "@eventfilm/api-client";
import type { EventSummary, Photo } from "@eventfilm/shared";
import { buildHostLaunchKit, getEventTemplate } from "@eventfilm/shared";
import { Badge, Body, Button, Card, ErrorState, LinkBlock, LoadingState, Screen, SectionHeader, SuccessState, TaskHeader, colors } from "../../../src/components/ui";
import { useAuth } from "../../../src/auth";

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

  async function copyLink(label: string, url?: string) {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setMessage(`${label} copied.`);
    if (label === "Guest link" && event) {
      api.trackAnalyticsEvent({
        name: "guest_link_copied",
        source: "mobile",
        path: `/events/${event.id}/share`,
        eventId: event.id,
        eventSlug: event.slug,
      }).catch(() => {});
    }
  }

  async function shareLink(label: string, url?: string) {
    if (!event || !url) return;
    await Share.share({ message: `${label} for ${event.name}: ${url}`, url });
  }

  async function copyText(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    setMessage(`${label} copied.`);
  }

  const launchKit = event ? buildHostLaunchKit(event) : null;
  const template = event ? getEventTemplate(event.eventTemplateSlug) : null;

  return (
    <Screen>
      <TaskHeader
        eyebrow="Share event"
        title={event ? `Launch kit for ${event.name}` : "Preparing share link"}
        body={template ? `${template.name} template. ${template.liveWallCopy}` : "Guests scan the QR code or open the guest link from any browser. No account needed."}
      />
      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading sharing details..." /> : null}
      {event ? (
        <>
          <LinkBlock label="Guest upload link" description="Send this anywhere your guests already are. This is the one for QR codes, group chats, and invitations." url={event.eventLink} tone="accent">
            {message ? <SuccessState message={message} /> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => shareLink("Guest upload link", event.eventLink)}>Share</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" onPress={() => copyLink("Guest link", event.eventLink)}>Copy link</Button>
              </View>
            </View>
          </LinkBlock>

          <ShareLinkCard
            title="Live Wall"
            subtitle="Open this on a laptop, TV, projector, or iPad while guests upload during the event."
            url={event.liveWallLink}
            onShare={() => shareLink("Live Wall link", event.liveWallLink)}
            onCopy={() => copyLink("Live Wall link", event.liveWallLink)}
          />

          <ShareLinkCard
            title="Recap"
            subtitle="Share this polished album story after the reveal time."
            url={event.recapLink}
            onShare={() => shareLink("Recap link", event.recapLink)}
            onCopy={() => copyLink("Recap link", event.recapLink)}
          />

          <LinkHealthPanel linkChecks={linkChecks} />

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <SectionHeader title="QR code" subtitle="Place this near the entrance, bar, or table." />
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
                <SectionHeader title="Copy-ready invite text" subtitle="Use this in a group chat, Instagram story, or event message." />
                <Body>{launchKit.inviteText}</Body>
                <Button tone="secondary" onPress={() => copyText("Guest invite", launchKit.inviteText)}>Copy invite text</Button>
              </Card>

              <Card>
                <SectionHeader title="Host instructions" subtitle="Keep the three links in the right moment." />
                <Body tone="muted">{launchKit.hostInstructions}</Body>
                <Body tone="muted">{launchKit.modeInstructions}</Body>
                <Button tone="secondary" onPress={() => copyText("Host instructions", launchKit.hostInstructions)}>Copy host instructions</Button>
              </Card>

              <Card>
                <SectionHeader title="Suggested caption" subtitle="Short enough for Instagram or a group chat." />
                <Body>{launchKit.socialCaption}</Body>
                <Button tone="secondary" onPress={() => copyText("Caption", launchKit.socialCaption)}>Copy caption</Button>
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
  onShare,
  onCopy,
}: {
  title: string;
  subtitle: string;
  url?: string;
  onShare: () => void;
  onCopy: () => void;
}) {
  return (
    <LinkBlock label={title} description={subtitle} url={url || "Link unavailable until the event reloads."}>
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
