import * as React from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { ChallengeCategory, ChallengeMode, ChallengeParticipant, ChallengePrompt } from "@eventfilm/shared";
import { CHALLENGE_TYPES, COLOR_HUNT_PALETTE } from "@eventfilm/shared";
import {
  ActionButton,
  Badge,
  Body,
  Button,
  Card,
  Caption,
  Chip,
  ErrorState,
  Field,
  FieldGroup,
  HeroHeader,
  Label,
  ModeOptionCard,
  ProgressSteps,
  Screen,
  SectionHeader,
  colors,
} from "../src/components/ui";
import { useAuth } from "../src/auth";
import {
  type ChallengeDraft,
  CHALLENGE_PACKS,
  buildChallengePayload,
  challengeTypeName,
  colorBySlug,
  createCategory,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createPrompt,
  createStarterPrompts,
  hasDuplicateCategories,
  hasDuplicateParticipantColors,
  hasDuplicateParticipantNames,
  hasDuplicatePrompts,
  validateChallengeDraft,
} from "../src/challenges";

type PickerMode = "date" | "time";

const wizardLabels = [
  "Step 1 of 5: Event basics",
  "Step 2 of 5: Timing and uploads",
  "Step 3 of 5: Photo mode",
  "Step 4 of 5: Customize mode",
  "Step 5 of 5: Review and create",
];

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function DateTimeField({ label, helper, value, onChange }: { label: string; helper?: string; value: Date; onChange: (value: Date) => void }) {
  const [pickerMode, setPickerMode] = React.useState<PickerMode | null>(null);
  const isIos = process.env.EXPO_OS === "ios";

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    setPickerMode(null);
    if (event.type === "dismissed" || !selected) return;
    onChange(selected);
  }

  return (
    <View style={{ gap: 8 }}>
      <FieldGroup label={label} helper={helper}>
        <Pressable
          onPress={() => setPickerMode((mode) => (mode ? null : "date"))}
          style={({ pressed }) => ({
            minHeight: 54,
            justifyContent: "center",
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#fff",
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: 15,
          })}
        >
          <Text selectable style={{ color: colors.ink, fontSize: 16, fontWeight: "800" }}>{formatDateTime(value)}</Text>
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

function ColorChoices({ selectedSlug, onChange }: { selectedSlug: string; onChange: (colorSlug: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {COLOR_HUNT_PALETTE.map((color) => (
        <Chip key={color.colorSlug} swatch={color.colorHex} selected={selectedSlug === color.colorSlug} onPress={() => onChange(color.colorSlug)}>
          {color.colorName}
        </Chip>
      ))}
    </View>
  );
}

function ColorHuntSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  function updateParticipant(index: number, nextParticipant: ChallengeParticipant) {
    onChange({
      ...draft,
      participants: draft.participants.map((participant, participantIndex) => (participantIndex === index ? nextParticipant : participant)),
    });
  }

  function addParticipant() {
    const color = COLOR_HUNT_PALETTE[draft.participants.length % COLOR_HUNT_PALETTE.length];
    onChange({ ...draft, participants: [...draft.participants, { ...color, displayName: `${color.colorName} Team` }] });
  }

  function removeParticipant(index: number) {
    onChange({ ...draft, participants: draft.participants.filter((_participant, participantIndex) => participantIndex !== index) });
  }

  return (
    <Card>
      <SectionHeader title="Color teams" subtitle="Guests choose a team, then upload photos that match their color." />
      {draft.participants.map((participant, index) => (
        <View key={participant.id || index} style={{ gap: 10, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.wash, padding: 12 }}>
          <FieldGroup label={`Team ${index + 1}`}>
            <Field
              placeholder="Team name"
              value={participant.displayName}
              onChangeText={(displayName) => updateParticipant(index, { ...participant, displayName })}
              autoCapitalize="words"
            />
          </FieldGroup>
          <ColorChoices
            selectedSlug={participant.colorSlug}
            onChange={(colorSlug) => updateParticipant(index, { ...participant, ...colorBySlug(colorSlug) })}
          />
          <ActionButton disabled={draft.participants.length <= 1} onPress={() => removeParticipant(index)}>Remove team</ActionButton>
        </View>
      ))}
      {hasDuplicateParticipantNames(draft.participants) ? <Body tone="danger">Color team names must be unique.</Body> : null}
      {hasDuplicateParticipantColors(draft.participants) ? <Body tone="muted">Two teams share a color. That is okay if it is intentional.</Body> : null}
      <Button tone="secondary" onPress={addParticipant}>Add color team</Button>
    </Card>
  );
}

function ScavengerSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const validPromptCount = draft.prompts.filter((prompt) => prompt.text.trim()).length;

  function updatePrompt(index: number, text: string) {
    onChange({ ...draft, prompts: draft.prompts.map((prompt, promptIndex) => (promptIndex === index ? { ...prompt, text } : prompt)) });
  }

  function addPrompt() {
    onChange({ ...draft, prompts: [...draft.prompts, createPrompt("", draft.prompts.length)] });
  }

  function removePrompt(index: number) {
    onChange({ ...draft, prompts: draft.prompts.filter((_prompt, promptIndex) => promptIndex !== index).map((prompt, order) => ({ ...prompt, order })) });
  }

  function movePrompt(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.prompts.length) return;
    const prompts = [...draft.prompts];
    const prompt = prompts[index] as ChallengePrompt;
    prompts[index] = prompts[nextIndex] as ChallengePrompt;
    prompts[nextIndex] = prompt;
    onChange({ ...draft, prompts: prompts.map((nextPrompt, order) => ({ ...nextPrompt, order })) });
  }

  return (
    <Card>
      <SectionHeader title="Scavenger prompts" subtitle={`${validPromptCount} prompts ready for guests.`} />
      {draft.prompts.map((prompt, index) => (
        <View key={prompt.id || index} style={{ gap: 10, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.wash, padding: 12 }}>
          <FieldGroup label={`Prompt ${index + 1}`}>
            <Field placeholder="Photo prompt" value={prompt.text} onChangeText={(text) => updatePrompt(index, text)} />
          </FieldGroup>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton disabled={index === 0} onPress={() => movePrompt(index, -1)}>Move up</ActionButton>
            <ActionButton disabled={index === draft.prompts.length - 1} onPress={() => movePrompt(index, 1)}>Move down</ActionButton>
            <ActionButton disabled={draft.prompts.length <= 1} onPress={() => removePrompt(index)}>Remove</ActionButton>
          </View>
        </View>
      ))}
      {draft.prompts.length < 3 ? <Body tone="danger">Add at least 3 prompts to start Photo Scavenger Hunt.</Body> : null}
      {draft.prompts.some((prompt) => !prompt.text.trim()) ? <Body tone="danger">Prompts cannot be empty.</Body> : null}
      {hasDuplicatePrompts(draft.prompts) ? <Body tone="danger">Remove duplicate prompts before saving.</Body> : null}
      <View style={{ gap: 10 }}>
        <Button tone="secondary" onPress={addPrompt}>Add prompt</Button>
        <Button tone="secondary" onPress={() => onChange({ ...draft, prompts: createStarterPrompts() })}>Use starter prompts</Button>
      </View>
    </Card>
  );
}

function AwardsSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const validCategoryCount = draft.categories.filter((category) => category.label.trim()).length;

  function updateCategory(index: number, label: string) {
    onChange({ ...draft, categories: draft.categories.map((category, categoryIndex) => (categoryIndex === index ? { ...category, label } : category)) });
  }

  function addCategory() {
    onChange({ ...draft, categories: [...draft.categories, createCategory("", draft.categories.length)] });
  }

  function removeCategory(index: number) {
    onChange({ ...draft, categories: draft.categories.filter((_category, categoryIndex) => categoryIndex !== index).map((category, order) => ({ ...category, order })) });
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.categories.length) return;
    const categories = [...draft.categories];
    const category = categories[index] as ChallengeCategory;
    categories[index] = categories[nextIndex] as ChallengeCategory;
    categories[nextIndex] = category;
    onChange({ ...draft, categories: categories.map((nextCategory, order) => ({ ...nextCategory, order })) });
  }

  return (
    <Card>
      <SectionHeader title="Award categories" subtitle={`${validCategoryCount} categories ready for guest submissions.`} />
      {draft.categories.map((category, index) => (
        <View key={category.id || index} style={{ gap: 10, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.wash, padding: 12 }}>
          <FieldGroup label={`Award ${index + 1}`}>
            <Field placeholder="Award category" value={category.label} onChangeText={(label) => updateCategory(index, label)} />
          </FieldGroup>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton disabled={index === 0} onPress={() => moveCategory(index, -1)}>Move up</ActionButton>
            <ActionButton disabled={index === draft.categories.length - 1} onPress={() => moveCategory(index, 1)}>Move down</ActionButton>
            <ActionButton disabled={draft.categories.length <= 1} onPress={() => removeCategory(index)}>Remove</ActionButton>
          </View>
        </View>
      ))}
      {draft.categories.length < 2 ? <Body tone="danger">Add at least 2 award categories.</Body> : null}
      {draft.categories.some((category) => !category.label.trim()) ? <Body tone="danger">Award categories cannot be empty.</Body> : null}
      {hasDuplicateCategories(draft.categories) ? <Body tone="danger">Remove duplicate award categories before saving.</Body> : null}
      <View style={{ gap: 10 }}>
        <Button tone="secondary" onPress={addCategory}>Add category</Button>
        <Button tone="secondary" onPress={() => onChange({ ...draft, categories: createDefaultAwardCategories() })}>Use default awards</Button>
      </View>
    </Card>
  );
}

function MemoryCapsuleSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  function update(field: keyof ChallengeDraft["memoryCapsule"], value: string) {
    onChange({ ...draft, memoryCapsule: { ...draft.memoryCapsule, [field]: value } });
  }

  return (
    <Card tone="warm">
      <Badge tone="amber">Reveal moment</Badge>
      <SectionHeader title="Frame the reveal" subtitle="Memory Capsule uses the event reveal time, with copy that makes the locked album feel intentional." />
      <FieldGroup label="Reveal title">
        <Field value={draft.memoryCapsule.revealTitle} onChangeText={(value) => update("revealTitle", value)} placeholder="The album unlocks after the event" />
      </FieldGroup>
      <FieldGroup label="Reveal note">
        <Field value={draft.memoryCapsule.revealNote} onChangeText={(value) => update("revealNote", value)} placeholder="Tell guests when and why to come back." multiline />
      </FieldGroup>
    </Card>
  );
}

function createDisabledReason({ name, photoLimitPerGuest, challengeDraft }: { name: string; photoLimitPerGuest: string; challengeDraft: ChallengeDraft }) {
  if (!name.trim()) return "Add an event name to create your event.";

  const photoLimit = Number(photoLimitPerGuest);
  if (!Number.isInteger(photoLimit) || photoLimit < 1) return "Set a photo limit of at least 1.";

  return validateChallengeDraft(challengeDraft);
}

export default function CreateEventScreen() {
  const { api, user } = useAuth();
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [eventDate, setEventDate] = React.useState(() => new Date());
  const [revealAt, setRevealAt] = React.useState(() => new Date(Date.now() + 3 * 60 * 60 * 1000));
  const [photoLimitPerGuest, setPhotoLimitPerGuest] = React.useState("10");
  const [challengeDraft, setChallengeDraft] = React.useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const disabledReason = createDisabledReason({ name, photoLimitPerGuest, challengeDraft });
  const canCreate = !disabledReason;

  function updateType(type: ChallengeMode) {
    setChallengeDraft((draft) => ({ ...draft, type }));
  }

  function stepProblem(nextStep = step) {
    if (nextStep > 0 && !name.trim()) return "Add an event name before continuing.";
    if (nextStep > 2) {
      const photoLimit = Number(photoLimitPerGuest);
      if (!Number.isInteger(photoLimit) || photoLimit < 1) return "Set a photo limit of at least 1.";
    }
    if (nextStep > 4) return disabledReason;
    return "";
  }

  function goNext() {
    const problem = stepProblem(step + 1);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, 4));
  }

  function goBack() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function createEvent() {
    if (!user) {
      router.push("/auth");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (disabledReason) throw new Error(disabledReason);
      const photoLimit = Number(photoLimitPerGuest);
      const data = await api.createEvent({
        name: name.trim(),
        description: description.trim() || null,
        eventDate: eventDate.toISOString(),
        revealAt: revealAt.toISOString(),
        photoLimitPerGuest: photoLimit,
        challenge: buildChallengePayload(challengeDraft),
      });
      api.trackAnalyticsEvent({
        name: "event_created",
        source: "mobile",
        path: "/create-event",
        eventId: data.event.id,
        eventSlug: data.event.slug,
        metadata: { mode: challengeDraft.type, hasChallenge: challengeDraft.type !== "NONE" },
      }).catch(() => {});
      router.replace(`/events/${data.event.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen bottomPadding={96}>
      <HeroHeader
        eyebrow="Host setup"
        title="Create an event guests will actually enjoy joining."
        body="A guided setup keeps the details clear now, then gives you a polished QR link to share."
      />
      <ProgressSteps current={step} total={5} labels={wizardLabels} />

      {step === 0 ? (
        <Card>
          <SectionHeader title="Event basics" subtitle="Give guests a name and a little context before they upload." />
          <FieldGroup label="Event name" helper="Use the name guests will recognize on the QR page.">
            <Field placeholder="Graduation party" value={name} onChangeText={setName} autoCapitalize="words" />
          </FieldGroup>
          <FieldGroup label="Description" helper="Optional, but helpful for instructions, dress code, or the host note.">
            <Field placeholder="Drop your favorite candid photos here." value={description} onChangeText={setDescription} multiline />
          </FieldGroup>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <SectionHeader title="Timing and uploads" subtitle="Set when the event happens and when guests can see the album." />
          <DateTimeField label="Event date and time" helper="This helps hosts spot upcoming and active events." value={eventDate} onChange={setEventDate} />
          <DateTimeField label="Reveal date and time" helper="Guests can upload before reveal, but the album stays locked until this time." value={revealAt} onChange={setRevealAt} />
          <FieldGroup label="Photo limit per guest" helper="A friendly cap keeps the album useful without blocking the best moments.">
            <Field keyboardType="number-pad" value={photoLimitPerGuest} onChangeText={setPhotoLimitPerGuest} />
          </FieldGroup>
        </Card>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Choose photo mode" subtitle="Start simple, or add a lightweight game for the room." />
          {CHALLENGE_PACKS.map((pack) => (
            <ModeOptionCard
              key={pack.slug}
              title={pack.name}
              description={pack.shortDescription}
              meta={`${pack.badge} - ${pack.setupComplexity} setup - ${pack.bestFor}`}
              selected={challengeDraft.type === pack.mode}
              onPress={() => updateType(pack.mode)}
            />
          ))}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: 12 }}>
          {challengeDraft.type === "NONE" ? (
            <Card tone="warm">
              <Badge tone="amber">Classic album</Badge>
              <SectionHeader title="No challenge setup needed" subtitle="Guests will enter a name, choose a photo, and upload straight into the album." />
            </Card>
          ) : null}
          {challengeDraft.type === CHALLENGE_TYPES.COLOR_HUNT ? <ColorHuntSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? <ScavengerSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.EVENT_AWARDS ? <AwardsSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? <MemoryCapsuleSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
        </View>
      ) : null}

      {step === 4 ? (
        <Card>
          <SectionHeader title="Review" subtitle="One last look before EventFilm creates the share link and QR code." />
          <View style={{ gap: 10 }}>
            <ReviewRow label="Event" value={name.trim() || "Untitled event"} />
            <ReviewRow label="Mode" value={challengeTypeName(challengeDraft.type)} />
            <ReviewRow label="Event date" value={formatDateTime(eventDate)} />
            <ReviewRow label="Reveal" value={formatDateTime(revealAt)} />
            <ReviewRow label="Uploads" value={`${photoLimitPerGuest || "0"} per guest`} />
          </View>
          {challengeDraft.type === CHALLENGE_TYPES.COLOR_HUNT ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {challengeDraft.participants.map((participant, index) => (
                <Chip key={participant.id || index} swatch={participant.colorHex}>{participant.displayName || "Unnamed team"}</Chip>
              ))}
            </View>
          ) : null}
          {challengeDraft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? (
            <View style={{ gap: 8 }}>
              {challengeDraft.prompts.slice(0, 5).map((prompt, index) => (
                <Caption key={prompt.id || index}>{index + 1}. {prompt.text || "Empty prompt"}</Caption>
              ))}
            </View>
          ) : null}
          {challengeDraft.type === CHALLENGE_TYPES.EVENT_AWARDS ? (
            <View style={{ gap: 8 }}>
              {challengeDraft.categories.slice(0, 5).map((category, index) => (
                <Caption key={category.id || index}>{index + 1}. {category.label || "Empty category"}</Caption>
              ))}
            </View>
          ) : null}
          {challengeDraft.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? (
            <View style={{ gap: 8 }}>
              <Caption>{challengeDraft.memoryCapsule.revealTitle}</Caption>
              <Caption>{challengeDraft.memoryCapsule.revealNote}</Caption>
            </View>
          ) : null}
          <Body tone={canCreate ? "success" : "muted"}>{disabledReason || "Ready to create. You can share the QR link after setup."}</Body>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      <Card padding={14}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {step > 0 ? <View style={{ flex: 1 }}><Button tone="secondary" onPress={goBack}>Back</Button></View> : null}
          <View style={{ flex: 1 }}>
            {step < 4 ? (
              <Button onPress={goNext}>Continue</Button>
            ) : (
              <Button loading={loading} disabled={!canCreate} onPress={createEvent}>Create event</Button>
            )}
          </View>
        </View>
      </Card>
    </Screen>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 }}>
      <Label>{label}</Label>
      <Text selectable style={{ flex: 1, textAlign: "right", color: colors.ink, fontSize: 14, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}
