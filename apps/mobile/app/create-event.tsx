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
  Label,
  ModeOptionCard,
  ProgressSteps,
  Screen,
  SectionHeader,
  TaskHeader,
  colors,
} from "../src/components/ui";
import { useAuth } from "../src/auth";
import {
  type ChallengeDraft,
  type EventTemplateSlug,
  type PromptPackSlug,
  CHALLENGE_PACKS,
  EVENT_TEMPLATES,
  PROMPT_PACKS,
  applyEventTemplateToDraft,
  buildChallengePayload,
  challengeTypeName,
  createCategoriesFromPack,
  colorBySlug,
  createPromptsFromPack,
  createCategory,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createPrompt,
  createStarterPrompts,
  getChallengePack,
  getPromptPack,
  hasDuplicateCategories,
  hasDuplicateParticipantColors,
  hasDuplicateParticipantNames,
  hasDuplicatePrompts,
  validateChallengeDraft,
} from "../src/challenges";

type PickerMode = "date" | "time";

const wizardLabels = [
  "Template",
  "Details",
  "Timing",
  "Mode",
  "Customize",
  "Review",
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
  const { api } = useAuth();
  const validPromptCount = draft.prompts.filter((prompt) => prompt.text.trim()).length;

  function trackCustomized() {
    api.trackAnalyticsEvent({
      name: "prompts_customized",
      source: "mobile",
      path: "/create-event",
      metadata: { itemKind: "prompt", promptPackSlug: draft.promptPackSlug || "custom" },
    }).catch(() => {});
  }

  function updatePrompt(index: number, text: string) {
    trackCustomized();
    onChange({ ...draft, prompts: draft.prompts.map((prompt, promptIndex) => (promptIndex === index ? { ...prompt, text } : prompt)) });
  }

  function addPrompt() {
    trackCustomized();
    onChange({ ...draft, prompts: [...draft.prompts, createPrompt("", draft.prompts.length)] });
  }

  function removePrompt(index: number) {
    trackCustomized();
    onChange({ ...draft, prompts: draft.prompts.filter((_prompt, promptIndex) => promptIndex !== index).map((prompt, order) => ({ ...prompt, order })) });
  }

  function movePrompt(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.prompts.length) return;
    const prompts = [...draft.prompts];
    const prompt = prompts[index] as ChallengePrompt;
    prompts[index] = prompts[nextIndex] as ChallengePrompt;
    prompts[nextIndex] = prompt;
    trackCustomized();
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
        <Button tone="secondary" onPress={() => {
          trackCustomized();
          onChange({ ...draft, promptPackSlug: null, prompts: createStarterPrompts() });
        }}>Use starter prompts</Button>
      </View>
    </Card>
  );
}

function AwardsSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const { api } = useAuth();
  const validCategoryCount = draft.categories.filter((category) => category.label.trim()).length;

  function trackCustomized() {
    api.trackAnalyticsEvent({
      name: "prompts_customized",
      source: "mobile",
      path: "/create-event",
      metadata: { itemKind: "award", promptPackSlug: draft.promptPackSlug || "custom" },
    }).catch(() => {});
  }

  function updateCategory(index: number, label: string) {
    trackCustomized();
    onChange({ ...draft, categories: draft.categories.map((category, categoryIndex) => (categoryIndex === index ? { ...category, label } : category)) });
  }

  function addCategory() {
    trackCustomized();
    onChange({ ...draft, categories: [...draft.categories, createCategory("", draft.categories.length)] });
  }

  function removeCategory(index: number) {
    trackCustomized();
    onChange({ ...draft, categories: draft.categories.filter((_category, categoryIndex) => categoryIndex !== index).map((category, order) => ({ ...category, order })) });
  }

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.categories.length) return;
    const categories = [...draft.categories];
    const category = categories[index] as ChallengeCategory;
    categories[index] = categories[nextIndex] as ChallengeCategory;
    categories[nextIndex] = category;
    trackCustomized();
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
        <Button tone="secondary" onPress={() => {
          trackCustomized();
          onChange({ ...draft, promptPackSlug: null, categories: createDefaultAwardCategories() });
        }}>Use default awards</Button>
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

function TemplateSetup({ draft, onSelect, onSkip }: { draft: ChallengeDraft; onSelect: (slug: EventTemplateSlug) => void; onSkip: () => void }) {
  const [showMoreTemplates, setShowMoreTemplates] = React.useState(false);
  const visibleTemplateSlugs: EventTemplateSlug[] = ["birthday-party", "wedding-engagement", "greek-life-event", "graduation-party", "student-org-event", "open-custom-event"];
  const visibleTemplates = visibleTemplateSlugs.map((slug) => EVENT_TEMPLATES.find((template) => template.slug === slug)).filter((template): template is (typeof EVENT_TEMPLATES)[number] => Boolean(template));
  const hiddenTemplates = EVENT_TEMPLATES.filter((template) => !visibleTemplateSlugs.includes(template.slug));
  const templates = showMoreTemplates ? [...visibleTemplates, ...hiddenTemplates] : visibleTemplates;

  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title="What are you hosting?" subtitle="Start with the shape of the event. You can adjust the mode, timing, and prompts before launch." />
      {templates.map((template) => {
        const promptPack = getPromptPack(template.promptPackSlug);
        const mode = getChallengePack(template.recommendedMode);
        const selected = draft.eventTemplateSlug === template.slug;
        return (
          <Pressable
            key={template.slug}
            onPress={() => onSelect(template.slug)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.76 : 1,
              borderRadius: 24,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: selected ? colors.coralDark : colors.border,
              backgroundColor: selected ? colors.rose : colors.surface,
              padding: 15,
              gap: 12,
              boxShadow: selected ? "0 12px 28px rgba(232, 93, 63, 0.13)" : "0 6px 18px rgba(101, 62, 0, 0.045)",
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "900" }}>{template.name}</Text>
                <Body tone="muted">{template.shortDescription}</Body>
              </View>
              <Badge tone={selected ? "dark" : "amber"}>{selected ? "Selected" : mode.name}</Badge>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip>{mode.name}</Chip>
              <Chip>{promptPack.name}</Chip>
            </View>
            <Caption>{template.bestFor}</Caption>
          </Pressable>
        );
      })}
      {!showMoreTemplates ? <Button tone="secondary" onPress={() => setShowMoreTemplates(true)}>More templates</Button> : null}
      <Button tone="secondary" onPress={onSkip}>Open custom event</Button>
    </View>
  );
}

function PromptPackPicker({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const { api } = useAuth();
  const [open, setOpen] = React.useState(false);
  const selectedPack = getPromptPack(draft.promptPackSlug);

  function selectPromptPack(promptPackSlug: PromptPackSlug) {
    const pack = getPromptPack(promptPackSlug);
    api.trackAnalyticsEvent({
      name: "prompt_pack_selected",
      source: "mobile",
      path: "/create-event",
      metadata: { promptPackSlug, itemKind: pack.kind },
    }).catch(() => {});
    if (pack.kind === "award") {
      onChange({ ...draft, type: CHALLENGE_TYPES.EVENT_AWARDS, promptPackSlug, categories: createCategoriesFromPack(promptPackSlug) });
    } else {
      onChange({ ...draft, type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT, promptPackSlug, prompts: createPromptsFromPack(promptPackSlug) });
    }
  }

  return (
    <Card>
      <SectionHeader title={`Prompt set selected: ${selectedPack.name}`} subtitle={`Includes ${selectedPack.items.length} prompts. You can edit them after creating the event.`} />
      <Button tone="secondary" onPress={() => setOpen((current) => !current)}>{open ? "Hide prompts" : "Edit prompts"}</Button>
      {open ? PROMPT_PACKS.filter((pack) => pack.kind !== "custom").map((pack) => (
        <ModeOptionCard
          key={pack.slug}
          title={pack.name}
          description={pack.description}
          meta={`${pack.kind === "award" ? "Awards" : "Photo Prompts"} - ${pack.items.length} ready-to-use ideas`}
          selected={draft.promptPackSlug === pack.slug}
          onPress={() => selectPromptPack(pack.slug)}
        />
      )) : null}
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

  React.useEffect(() => {
    api.trackAnalyticsEvent({
      name: "event_template_viewed",
      source: "mobile",
      path: "/create-event",
      metadata: { surface: "create_event" },
    }).catch(() => {});
  }, [api]);

  function selectTemplate(templateSlug: EventTemplateSlug) {
    const template = EVENT_TEMPLATES.find((item) => item.slug === templateSlug);
    setChallengeDraft((draft) => applyEventTemplateToDraft(templateSlug, draft));
    if (template?.suggestedUploadLimit) setPhotoLimitPerGuest(String(template.suggestedUploadLimit));
    api.trackAnalyticsEvent({
      name: "event_template_selected",
      source: "mobile",
      path: "/create-event",
      metadata: { templateSlug, mode: template?.recommendedMode || "NONE", promptPackSlug: template?.promptPackSlug || null },
    }).catch(() => {});
  }

  function skipTemplate() {
    setChallengeDraft((draft) => ({ ...draft, eventTemplateSlug: "open-custom-event", promptPackSlug: "custom" }));
    api.trackAnalyticsEvent({
      name: "template_skipped",
      source: "mobile",
      path: "/create-event",
      metadata: { templateSlug: "open-custom-event" },
    }).catch(() => {});
  }

  function updateType(type: ChallengeMode) {
    setChallengeDraft((draft) => ({ ...draft, type }));
  }

  function stepProblem(nextStep = step) {
    if (nextStep > 1 && !name.trim()) return "Add an event name before continuing.";
    if (nextStep > 3) {
      const photoLimit = Number(photoLimitPerGuest);
      if (!Number.isInteger(photoLimit) || photoLimit < 1) return "Set a photo limit of at least 1.";
    }
    if (nextStep > 5) return disabledReason;
    return "";
  }

  function goNext() {
    const problem = stepProblem(step + 1);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, 5));
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
        eventTemplateSlug: challengeDraft.eventTemplateSlug,
        promptPackSlug: challengeDraft.promptPackSlug,
        challenge: buildChallengePayload(challengeDraft),
      });
      const metadata = { mode: challengeDraft.type, hasChallenge: challengeDraft.type !== "NONE", templateSlug: challengeDraft.eventTemplateSlug, promptPackSlug: challengeDraft.promptPackSlug };
      api.trackAnalyticsEvent({
        name: "event_created",
        source: "mobile",
        path: "/create-event",
        eventId: data.event.id,
        eventSlug: data.event.slug,
        metadata,
      }).catch(() => {});
      if (challengeDraft.eventTemplateSlug && challengeDraft.eventTemplateSlug !== "open-custom-event") {
        api.trackAnalyticsEvent({
          name: "event_created_from_template",
          source: "mobile",
          path: "/create-event",
          eventId: data.event.id,
          eventSlug: data.event.slug,
          metadata,
        }).catch(() => {});
      }
      router.replace(`/events/${data.event.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen bottomPadding={96}>
      <TaskHeader
        eyebrow="Host setup"
        title="Create an event guests will actually join."
        body="A guided setup keeps the details clear now, then gives you a polished QR link to share."
      />
      <ProgressSteps current={step} total={6} labels={wizardLabels} />

      {step === 0 ? (
        <TemplateSetup draft={challengeDraft} onSelect={selectTemplate} onSkip={skipTemplate} />
      ) : null}

      {step === 1 ? (
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

      {step === 2 ? (
        <Card>
          <SectionHeader title="Timing and uploads" subtitle="Set when the event happens and when guests can see the album." />
          <DateTimeField label="Event date and time" helper="This helps hosts spot upcoming and active events." value={eventDate} onChange={setEventDate} />
          <DateTimeField label="Reveal date and time" helper="Guests can upload before reveal, but the album stays locked until this time." value={revealAt} onChange={setRevealAt} />
          <FieldGroup label="Photo limit per guest" helper="A friendly cap keeps the album useful without blocking the best moments.">
            <Field keyboardType="number-pad" value={photoLimitPerGuest} onChangeText={setPhotoLimitPerGuest} />
          </FieldGroup>
        </Card>
      ) : null}

      {step === 3 ? (
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

      {step === 4 ? (
        <View style={{ gap: 12 }}>
          {challengeDraft.type === "NONE" ? (
            <Card tone="warm">
              <Badge tone="amber">Classic album</Badge>
              <SectionHeader title="No challenge setup needed" subtitle="Guests will enter a name, choose a photo, and upload straight into the album." />
            </Card>
          ) : null}
          {challengeDraft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT || challengeDraft.type === CHALLENGE_TYPES.EVENT_AWARDS ? <PromptPackPicker draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.COLOR_HUNT ? <ColorHuntSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? <ScavengerSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.EVENT_AWARDS ? <AwardsSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
          {challengeDraft.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? <MemoryCapsuleSetup draft={challengeDraft} onChange={setChallengeDraft} /> : null}
        </View>
      ) : null}

      {step === 5 ? (
        <Card>
          <Badge tone={canCreate ? "green" : "stone"}>{canCreate ? "Ready to launch" : "Review needed"}</Badge>
          <SectionHeader title="Confirm your event" subtitle="EventFilm will create the guest upload link, Live Wall, Recap, and QR code next." />
          <View style={{ gap: 8, borderRadius: 18, borderCurve: "continuous", backgroundColor: colors.wash, padding: 12 }}>
            <ReviewRow label="Event" value={name.trim() || "Untitled event"} />
            <ReviewRow label="Template" value={EVENT_TEMPLATES.find((template) => template.slug === challengeDraft.eventTemplateSlug)?.name || "Custom event"} />
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

      <Card padding={13}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {step > 0 ? <View style={{ flex: 1, minWidth: 132 }}><Button tone="secondary" onPress={goBack}>Back</Button></View> : null}
          <View style={{ flex: 1, minWidth: 132 }}>
            {step < 5 ? (
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
