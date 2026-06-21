import * as React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { EventSummary, Photo } from "@eventfilm/shared";
import { challengeLabel } from "@eventfilm/shared";

export const colors = {
  ink: "#1c1917",
  muted: "#78716c",
  soft: "#a8a29e",
  border: "#e7ded3",
  paper: "#fff8ed",
  paperDeep: "#f7ead7",
  surface: "#ffffff",
  surfaceWarm: "#fffbf5",
  amber: "#f59e0b",
  amberSoft: "#fef3c7",
  amberWash: "#fff7dc",
  amberDark: "#653e00",
  coral: "#ef6f58",
  rose: "#fff1ec",
  plum: "#6d3f5b",
  danger: "#b91c1c",
  dangerWash: "#fee2e2",
  success: "#047857",
  successWash: "#dcfce7",
  wash: "#faf7f2",
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
  bottomPadding = 88,
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
        padding: 20,
        gap: 18,
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
  padding = 18,
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
        gap: 14,
        padding,
        borderRadius: 24,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: palette.borderColor,
        backgroundColor: palette.backgroundColor,
        boxShadow: "0 14px 34px rgba(101, 62, 0, 0.08)",
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
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        gap: 14,
        padding: 22,
        borderRadius: 30,
        borderCurve: "continuous",
        backgroundColor: colors.ink,
        overflow: "hidden",
      }}
    >
      <View style={{ position: "absolute", right: -42, top: -34, width: 130, height: 130, borderRadius: 999, backgroundColor: colors.amber, opacity: 0.28 }} />
      <View style={{ position: "absolute", left: -36, bottom: -42, width: 112, height: 112, borderRadius: 999, backgroundColor: colors.coral, opacity: 0.24 }} />
      {eyebrow ? <Badge tone="amber">{eyebrow}</Badge> : null}
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: "#fffaf0", fontSize: 34, lineHeight: 39, fontWeight: "900" }}>{title}</Text>
        {body ? <Text selectable style={{ color: "#f5e9d7", fontSize: 16, lineHeight: 24 }}>{body}</Text> : null}
      </View>
      {children}
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
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{title}</Text>
        {subtitle ? <Body tone="muted">{subtitle}</Body> : null}
      </View>
      {action}
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text selectable style={{ color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 38 }}>{children}</Text>;
}

export function Body({ children, tone = "default" }: { children: React.ReactNode; tone?: Tone }) {
  return <Text selectable style={{ color: toneColor(tone), fontSize: 16, lineHeight: 23 }}>{children}</Text>;
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
          borderRadius: 16,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: "#fff",
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.ink : colors.border,
        backgroundColor: selected ? colors.amberWash : "#fff",
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 12,
        paddingVertical: 7,
      })}
    >
      {swatch ? <View style={{ width: 12, height: 12, borderRadius: 999, borderWidth: 1, borderColor: "#00000022", backgroundColor: swatch }} /> : null}
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{children}</Text>
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
        backgroundColor: "#fff",
        opacity: disabled ? 0.36 : pressed ? 0.7 : 1,
        paddingHorizontal: 13,
      })}
    >
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{children}</Text>
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
  const backgroundColor = tone === "primary" ? colors.amber : tone === "danger" ? colors.danger : tone === "ghost" ? "transparent" : "#fff";
  const color = tone === "primary" ? colors.ink : tone === "danger" ? "#fff" : colors.ink;

  return (
    <Pressable
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: tone === "secondary" ? 1 : 0,
        borderColor: colors.border,
        backgroundColor,
        opacity: disabled ? 0.42 : pressed || loading ? 0.72 : 1,
        paddingHorizontal: 18,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontSize: 16, fontWeight: "900" }}>{children}</Text>}
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
        gap: 6,
        borderRadius: 20,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? colors.amberDark : colors.border,
        backgroundColor: selected ? colors.amberWash : "#fff",
        opacity: pressed ? 0.76 : 1,
        padding: 16,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ flex: 1, color: colors.ink, fontSize: 16, fontWeight: "900" }}>{title}</Text>
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
    <View style={{ alignSelf: "flex-start", borderRadius: 999, backgroundColor: palette.backgroundColor, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ color: palette.color, fontSize: 12, fontWeight: "900" }}>{children}</Text>
    </View>
  );
}

export function ProgressSteps({ current, total, labels }: { current: number; total: number; labels?: string[] }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: total }).map((_, index) => {
          const active = index <= current;
          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 7,
                borderRadius: 999,
                backgroundColor: active ? colors.amber : "#eadfce",
              }}
            />
          );
        })}
      </View>
      <Caption>{labels?.[current] || `Step ${current + 1} of ${total}`}</Caption>
    </View>
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
    <Card tone="warm">
      <Badge tone="stone">Nothing here yet</Badge>
      <View style={{ gap: 5 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{title}</Text>
        <Body tone="muted">{body}</Body>
      </View>
      {action}
    </Card>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ActivityIndicator color={colors.amberDark} />
        <Body tone="muted">{label}</Body>
      </View>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card tone="danger">
      <Badge tone="red">Needs attention</Badge>
      <Body tone="danger">{message}</Body>
    </Card>
  );
}

export function SuccessState({ message }: { message: string }) {
  return (
    <Card tone="success">
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
  const eventDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.eventDate));
  const revealDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.revealAt));

  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <Card tone={featured ? "accent" : "default"}>
        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <Text selectable style={{ flex: 1, color: colors.ink, fontSize: featured ? 24 : 20, lineHeight: featured ? 29 : 25, fontWeight: "900" }}>{event.name}</Text>
            <Badge tone={featured ? "dark" : "amber"}>{event.photoCount} photos</Badge>
          </View>
          {event.description ? <Body tone="muted">{event.description}</Body> : null}
        </View>
        <View style={{ gap: 6 }}>
          <Caption>Event: {eventDate}</Caption>
          <Caption>Reveal: {revealDate}</Caption>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge tone="stone">{challengeLabel(event.challenge)}</Badge>
          {featured ? <Badge>Active focus</Badge> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function PhotoCard({ photo, compact = false }: { photo: Photo; compact?: boolean }) {
  const [loaded, setLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = photo.previewUrl || photo.url;
  const usesLocalhost = isLocalhostUrl(imageUrl);

  return (
    <Card padding={compact ? 10 : 14}>
      <View style={{ width: "100%", aspectRatio: 1, borderRadius: compact ? 18 : 20, borderCurve: "continuous", backgroundColor: colors.wash, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
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
        <Text selectable style={{ color: colors.ink, fontSize: compact ? 14 : 16, fontWeight: "900" }}>{photo.challengeParticipantName || photo.guestNickname || "Guest"}</Text>
        {photo.challengeColorName ? <Badge tone="stone">{photo.challengeColorName}</Badge> : null}
        {photo.challengePromptText ? <Caption>{photo.challengePromptText}</Caption> : null}
      </View>
    </Card>
  );
}
