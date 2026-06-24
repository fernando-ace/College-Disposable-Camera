import * as React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { EventSummary, Photo } from "@eventfilm/shared";
import { challengeLabel, photoChallengeLabel } from "@eventfilm/shared";

export const colors = {
  ink: "#1c1917",
  inkSoft: "#3f342d",
  muted: "#78716c",
  soft: "#a8a29e",
  border: "#e7ded3",
  paper: "#fff8ed",
  paperSoft: "#fffcf7",
  paperDeep: "#f7ead7",
  surface: "#ffffff",
  surfaceWarm: "#fffbf5",
  amber: "#f59e0b",
  amberSoft: "#fef3c7",
  amberWash: "#fff7dc",
  amberDark: "#653e00",
  coral: "#ef6f58",
  coralDark: "#d94f33",
  rose: "#fff1ec",
  plum: "#6d3f5b",
  danger: "#b91c1c",
  dangerWash: "#fee2e2",
  success: "#047857",
  successWash: "#dcfce7",
  wash: "#faf7f2",
  focusRing: "#f3ce79",
};

type Tone = "default" | "muted" | "danger" | "success";

function toneColor(tone: Tone) {
  if (tone === "danger") return colors.danger;
  if (tone === "success") return colors.success;
  if (tone === "muted") return colors.muted;
  return colors.ink;
}

export function Screen({
  children,
  bottomPadding = 104,
  wide = false,
}: {
  children: React.ReactNode;
  bottomPadding?: number;
  wide?: boolean;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        width: "100%",
        maxWidth: wide ? 760 : 560,
        alignSelf: "center",
        paddingHorizontal: 18,
        paddingTop: 14,
        gap: 15,
        paddingBottom: bottomPadding,
      }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  tone = "default",
  padding = 16,
}: {
  children: React.ReactNode;
  tone?: "default" | "warm" | "accent" | "success" | "danger";
  padding?: number;
}) {
  const palette = {
    default: { backgroundColor: colors.surface, borderColor: colors.border },
    warm: { backgroundColor: colors.surfaceWarm, borderColor: "#f1ddc4" },
    accent: { backgroundColor: colors.amberWash, borderColor: "#f3ce79" },
    success: { backgroundColor: colors.successWash, borderColor: "#bbf7d0" },
    danger: { backgroundColor: colors.dangerWash, borderColor: "#fecaca" },
  }[tone];

  return (
    <View
      style={{
        gap: 13,
        padding,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
        boxShadow: "0 10px 28px rgba(101, 62, 0, 0.065)",
      }}
    >
      {children}
    </View>
  );
}

export function HeroHeader({
  eyebrow,
  title,
  body,
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        gap: compact ? 10 : 13,
        padding: compact ? 18 : 22,
        borderRadius: compact ? 24 : 28,
        borderCurve: "continuous",
        backgroundColor: colors.ink,
        overflow: "hidden",
      }}
    >
      {eyebrow ? <Badge tone="amber">{eyebrow}</Badge> : null}
      <View style={{ gap: 7 }}>
        <Text selectable style={{ color: "#fffaf0", fontSize: compact ? 24 : 30, lineHeight: compact ? 30 : 36, fontWeight: "900" }}>{title}</Text>
        {body ? <Text selectable style={{ color: "#f5e9d7", fontSize: 16, lineHeight: 24 }}>{body}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function TaskHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 12, paddingTop: 2 }}>
      {eyebrow ? <Badge tone="stone">{eyebrow}</Badge> : null}
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 28, lineHeight: 33, fontWeight: "900" }}>{title}</Text>
        {body ? <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Section({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      {title || action ? <SectionHeader title={title || ""} action={action} /> : null}
      {children}
    </View>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "900" }}>{title}</Text>
        {subtitle ? <Body tone="muted">{subtitle}</Body> : null}
      </View>
      {action}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text selectable style={{ color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 }}>{children}</Text>;
}

export function Body({ children, tone = "default" }: { children: React.ReactNode; tone?: Tone }) {
  return <Text selectable style={{ color: toneColor(tone), fontSize: 15, lineHeight: 22 }}>{children}</Text>;
}

export function Caption({ children, tone = "muted" }: { children: React.ReactNode; tone?: Tone }) {
  return <Text selectable style={{ color: toneColor(tone), fontSize: 13, lineHeight: 18, fontWeight: "600" }}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{children}</Text>;
}

export function FieldGroup({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Label>{label}</Label>
      {children}
      {error ? <Caption tone="danger">{error}</Caption> : helper ? <Caption>{helper}</Caption> : null}
    </View>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.soft}
      autoCapitalize="none"
      style={[
        {
          minHeight: props.multiline ? 96 : 52,
          borderRadius: 17,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.paperSoft,
          paddingHorizontal: 15,
          paddingVertical: props.multiline ? 13 : 0,
          color: colors.ink,
          fontSize: 16,
          textAlignVertical: props.multiline ? "top" : "center",
        },
        props.style,
      ]}
      {...props}
    />
  );
}

export function Chip({
  children,
  selected = false,
  onPress,
  swatch,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onPress?: () => void;
  swatch?: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.coralDark : colors.border,
        backgroundColor: selected ? colors.rose : "#fff",
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 11,
        paddingVertical: 7,
      })}
    >
      {swatch ? <View style={{ width: 12, height: 12, borderRadius: 999, borderWidth: 1, borderColor: "#00000022", backgroundColor: swatch }} /> : null}
      <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "900" }}>{children}</Text>
    </Pressable>
  );
}

export function ActionButton({
  children,
  onPress,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: disabled ? 0.36 : pressed ? 0.7 : 1,
        paddingHorizontal: 13,
      })}
    >
      <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "900", textAlign: "center" }}>{children}</Text>
    </Pressable>
  );
}

export function Button({
  children,
  tone = "primary",
  loading = false,
  onPress,
  disabled = false,
}: {
  children: React.ReactNode;
  tone?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const backgroundColor = tone === "primary" ? colors.coral : tone === "danger" ? colors.danger : tone === "ghost" ? "transparent" : "#fff";
  const color = tone === "primary" || tone === "danger" ? "#fff" : colors.ink;

  return (
    <Pressable
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: tone === "secondary" ? 1 : 0,
        borderColor: colors.border,
        backgroundColor,
        opacity: disabled ? 0.42 : pressed || loading ? 0.72 : 1,
        paddingHorizontal: 18,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontSize: 16, lineHeight: 20, fontWeight: "900", textAlign: "center" }}>{children}</Text>}
    </Pressable>
  );
}

export function SegmentOption({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return <ModeOptionCard title={title} description={description} selected={selected} onPress={onPress} />;
}

export function ModeOptionCard({
  title,
  description,
  meta,
  selected,
  onPress,
}: {
  title: string;
  description?: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        gap: 8,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? colors.coralDark : colors.border,
        backgroundColor: selected ? colors.rose : "#fff",
        opacity: pressed ? 0.76 : 1,
        padding: 15,
        boxShadow: selected ? "0 8px 22px rgba(232, 93, 63, 0.12)" : "0 4px 14px rgba(101, 62, 0, 0.04)",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flex: 1, color: colors.ink, fontSize: 16, lineHeight: 20, fontWeight: "900" }}>{title}</Text>
        {selected ? <Badge tone="dark">Selected</Badge> : null}
      </View>
      {description ? <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{description}</Text> : null}
      {meta ? <Caption>{meta}</Caption> : null}
    </Pressable>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return <Badge>{children}</Badge>;
}

export function Badge({
  children,
  tone = "amber",
}: {
  children: React.ReactNode;
  tone?: "amber" | "dark" | "green" | "red" | "stone";
}) {
  const palette = {
    amber: { backgroundColor: colors.amberSoft, color: colors.amberDark },
    dark: { backgroundColor: colors.ink, color: "#fffaf0" },
    green: { backgroundColor: colors.successWash, color: colors.success },
    red: { backgroundColor: colors.dangerWash, color: colors.danger },
    stone: { backgroundColor: "#f5f5f4", color: colors.muted },
  }[tone];

  return (
    <View style={{ alignSelf: "flex-start", maxWidth: "100%", borderRadius: 999, backgroundColor: palette.backgroundColor, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: palette.color, fontSize: 11, lineHeight: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.2 }}>{children}</Text>
    </View>
  );
}

export function ProgressSteps({ current, total, labels }: { current: number; total: number; labels?: string[] }) {
  return (
    <Card padding={12}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Caption>{labels?.[current] || `Step ${current + 1}`}</Caption>
          <Badge tone="stone">{current + 1}/{total}</Badge>
        </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }).map((_, index) => {
          const active = index <= current;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                backgroundColor: active ? colors.coral : "#eadfce",
              }}
            />
          );
        })}
      </View>
      </View>
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card tone="warm" padding={16}>
      <View style={{ gap: 5 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, lineHeight: 25, fontWeight: "900" }}>{title}</Text>
        <Body tone="muted">{body}</Body>
      </View>
      {action}
    </Card>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <Card padding={14}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActivityIndicator color={colors.amberDark} />
        <Body tone="muted">{label}</Body>
      </View>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card tone="danger" padding={14}>
      <Badge tone="red">Needs attention</Badge>
      <Body tone="danger">{message}</Body>
    </Card>
  );
}

export function SuccessState({ message }: { message: string }) {
  return (
    <Card tone="success" padding={14}>
      <Badge tone="green">Done</Badge>
      <Body tone="success">{message}</Body>
    </Card>
  );
}

function isLocalhostUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function EventCard({ event, onPress, featured = false }: { event: EventSummary; onPress?: () => void; featured?: boolean }) {
  const previewPhotos = (event.previewPhotos || []).slice(0, featured ? 4 : 3);

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <Card tone={featured ? "accent" : "default"} padding={featured ? 18 : 15}>
        {previewPhotos.length ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {previewPhotos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.previewUrl || photo.url }}
                resizeMode="cover"
                style={{ flex: 1, aspectRatio: 1, minHeight: featured ? 72 : 56, borderRadius: 14, backgroundColor: colors.wash }}
              />
            ))}
          </View>
        ) : null}
        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontSize: featured ? 22 : 18, lineHeight: featured ? 27 : 23, fontWeight: "700" }}>{event.name}</Text>
            <Badge tone={featured ? "dark" : "stone"}>{event.photoCount} {event.photoCount === 1 ? "photo" : "photos"}</Badge>
          </View>
          {event.description ? <Body tone="muted">{event.description}</Body> : null}
        </View>
        <View style={{ gap: 5, borderRadius: 16, borderCurve: "continuous", backgroundColor: featured ? "#fffaf0" : colors.wash, padding: 11 }}>
          <Caption>Photo setup: {challengeLabel(event.challenge)}</Caption>
        </View>
        <Caption>Open this event to manage links, photos, recap, downloads, and settings.</Caption>
      </Card>
    </Pressable>
  );
}

export function StatTile({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "accent" }) {
  return (
    <View style={{ flex: 1, minWidth: 96, gap: 2, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: tone === "accent" ? "#ffd4c7" : colors.border, backgroundColor: tone === "accent" ? colors.rose : colors.surface, padding: 12 }}>
      <Text selectable style={{ color: tone === "accent" ? colors.coralDark : colors.ink, fontSize: 21, lineHeight: 25, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{String(value)}</Text>
      <Caption>{label}</Caption>
    </View>
  );
}

export function LinkBlock({
  label,
  description,
  url,
  children,
  tone = "default",
}: {
  label: string;
  description: string;
  url?: string | null;
  children?: React.ReactNode;
  tone?: "default" | "accent" | "warm";
}) {
  return (
    <Card tone={tone === "accent" ? "accent" : tone === "warm" ? "warm" : "default"}>
      <SectionHeader title={label} subtitle={description} />
      {url ? (
        <View style={{ borderRadius: 17, borderCurve: "continuous", backgroundColor: colors.surfaceWarm, padding: 12, borderWidth: 1, borderColor: "#f1ddc4" }}>
          <Caption>{url}</Caption>
        </View>
      ) : null}
      {children}
    </Card>
  );
}

export function PhotoCard({ photo, compact = false }: { photo: Photo; compact?: boolean }) {
  const [loaded, setLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = photo.previewUrl || photo.url;
  const usesLocalhost = isLocalhostUrl(imageUrl);

  return (
    <Card padding={compact ? 8 : 11}>
      <View style={{ width: "100%", aspectRatio: 1, borderRadius: compact ? 16 : 20, borderCurve: "continuous", backgroundColor: colors.wash, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {imageUrl && !imageError ? (
          <>
            {!loaded ? <ActivityIndicator color={colors.amberDark} /> : null}
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              onLoadEnd={() => setLoaded(true)}
              onError={() => {
                setLoaded(true);
                setImageError(true);
              }}
              style={{ position: "absolute", width: "100%", height: "100%" }}
            />
          </>
        ) : (
          <Body tone="muted">Photo preview unavailable.</Body>
        )}
      </View>
      {usesLocalhost || imageError ? (
        <Body tone={usesLocalhost ? "danger" : "muted"}>
          {usesLocalhost ? "Photo link is not reachable from this phone. Restart the API with a LAN SERVER_URL." : "Could not load this photo preview."}
        </Body>
      ) : null}
      <View style={{ gap: 5 }}>
        <Text selectable style={{ color: colors.ink, fontSize: compact ? 14 : 16, lineHeight: compact ? 18 : 20, fontWeight: "900" }}>{photo.challengeParticipantName || photo.guestNickname || "Guest"}</Text>
        {photo.challengeColorName ? <Badge tone="stone">{photo.challengeColorName}</Badge> : null}
        {photoChallengeLabel(photo) && !photo.challengeColorName ? <Caption>{photoChallengeLabel(photo)}</Caption> : null}
      </View>
    </Card>
  );
}
