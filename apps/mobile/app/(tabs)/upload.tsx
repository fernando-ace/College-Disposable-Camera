import * as React from "react";
import * as ImagePicker from "expo-image-picker";
import { Link, useLocalSearchParams } from "expo-router";
import { Image, View } from "react-native";
import type { ChallengeCategory, ChallengeParticipant, ChallengePrompt, PublicEvent } from "@eventfilm/shared";
import { CHALLENGE_TYPES, categoriesFromChallenge, challengeLabel, getChallengePack, memoryCapsuleFromChallenge, promptsFromChallenge, validateUploadFile } from "@eventfilm/shared";
import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  FieldGroup,
  HeroHeader,
  LoadingState,
  Screen,
  SectionHeader,
  SuccessState,
} from "../../src/components/ui";
import { useAuth } from "../../src/auth";
import { getGuestClientId, slugFromInput } from "../../src/guest-session";

export default function UploadScreen() {
  const { eventLink } = useLocalSearchParams<{ eventLink?: string }>();
  const { api } = useAuth();
  const [input, setInput] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [event, setEvent] = React.useState<PublicEvent | null>(null);
  const [nickname, setNickname] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [selectedParticipantId, setSelectedParticipantId] = React.useState("");
  const [selectedPromptId, setSelectedPromptId] = React.useState("");
  const [selectedItemId, setSelectedItemId] = React.useState("");
  const [asset, setAsset] = React.useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadedPreviewUri, setUploadedPreviewUri] = React.useState("");
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [findingEvent, setFindingEvent] = React.useState(false);

  const participants = event?.challenge?.participants || [];
  const prompts = promptsFromChallenge(event?.challenge);
  const awardCategories = categoriesFromChallenge(event?.challenge);
  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId);
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId);
  const selectedAward = awardCategories.find((category) => category.id === selectedItemId);
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const canUpload = Boolean(event && asset && clientId)
    && remaining !== 0
    && (event?.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT || Boolean(selectedParticipant))
    && (event?.challenge?.type !== CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT || Boolean(selectedPrompt))
    && (event?.challenge?.type !== CHALLENGE_TYPES.EVENT_AWARDS || Boolean(selectedAward))
    && (event?.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT || Boolean(nickname.trim()));

  const loadEvent = React.useCallback(async (nextInput = input) => {
    const nextSlug = slugFromInput(nextInput);
    setSlug(nextSlug);
    setMessage("");
    setError("");
    setEvent(null);
    setFindingEvent(true);
    if (!nextSlug) {
      setFindingEvent(false);
      return setError("Enter an event slug or link.");
    }

    try {
      const nextClientId = await getGuestClientId(nextSlug);
      setClientId(nextClientId);
      const eventData = await api.getPublicEventBySlug(nextSlug);
      setEvent(eventData.event);
      const status = await api.getGuestStatus(nextSlug, nextClientId);
      setRemaining(status.remainingUploads);
      if (status.nickname) setNickname(status.nickname);
    } catch (err) {
      setError(`${(err as Error).message}. Check the event link and your API connection, then try again.`);
    } finally {
      setFindingEvent(false);
    }
  }, [api, input]);

  React.useEffect(() => {
    if (!eventLink) return;
    setInput(eventLink);
    loadEvent(eventLink);
  }, [eventLink, loadEvent]);

  async function choosePhoto(source: "camera" | "library") {
    setError("");
    setMessage("");

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(source === "camera" ? "Camera permission is required to take a photo." : "Photo library permission is required to choose a photo.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.82 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });

      if (!result.canceled) {
        const nextAsset = result.assets[0];
        const validation = validateUploadFile({ type: nextAsset.mimeType || "image/jpeg", size: nextAsset.fileSize || 0 });
        if (!validation.ok) {
          setAsset(null);
          setError(validation.message);
          return;
        }
        setAsset(nextAsset);
        setUploadedPreviewUri("");
      }
    } catch (err) {
      setError((err as Error).message || "Could not open the camera or photo library.");
    }
  }

  async function upload() {
    if (!event || !asset) return setError("Choose an event and photo first.");
    if (loading) return;
    const validation = validateUploadFile({ type: asset.mimeType || "image/jpeg", size: asset.fileSize || 0 });
    if (!validation.ok) return setError(validation.message);
    if (!clientId) return setError("Could not create a guest upload session.");
    if (event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && !selectedParticipant) return setError("Choose your Color Hunt team first.");
    if (event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && !selectedPrompt) return setError("Choose a scavenger prompt first.");
    if (event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && !selectedAward) return setError("Choose an award category first.");
    if (event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && !nickname.trim()) return setError("Enter your name or nickname first.");

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await api.uploadPhoto(slug, {
        photo: {
          uri: asset.uri,
          name: asset.fileName || "eventfilm-photo.jpg",
          type: asset.mimeType || "image/jpeg",
        },
        nickname: selectedParticipant?.displayName || nickname.trim(),
        clientId,
        challengeParticipantId: selectedParticipant?.id,
        challengePromptId: selectedPrompt?.id,
        challengeItemId: selectedAward?.id,
      });
      setUploadedPreviewUri(asset.uri);
      setAsset(null);
      setRemaining(data.remainingUploads);
      setMessage(event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? "Photo uploaded. Pick another prompt or upload another angle." : event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS ? "Photo submitted for the award category." : "Photo uploaded.");
    } catch (err) {
      setError(`${(err as Error).message}. Check your connection or choose a smaller image, then try again.`);
    } finally {
      setLoading(false);
    }
  }

  function selectFirstParticipant() {
    const first = participants[0] as ChallengeParticipant | undefined;
    if (first?.id) setSelectedParticipantId(first.id);
  }

  function selectFirstPrompt() {
    const first = prompts[0] as ChallengePrompt | undefined;
    if (first?.id) setSelectedPromptId(first.id);
  }

  return (
    <Screen bottomPadding={88}>
      <HeroHeader
        eyebrow="Guest upload"
        title={event ? event.name : "Join an EventFilm album"}
        body={event?.description || "Paste a guest link or event code, then upload photos without making an account."}
      >
        {event ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge>{challengeLabel(event.challenge)}</Badge>
            <Badge tone={remaining === 0 ? "red" : "green"}>{remaining === null ? "Checking uploads" : `${remaining} uploads left`}</Badge>
          </View>
        ) : null}
      </HeroHeader>

      <Card>
        <SectionHeader title="Find your event" subtitle="Use the QR link, full URL, or the event code from the host." />
        <Field placeholder="Paste event link or slug" value={input} onChangeText={setInput} autoCapitalize="none" />
        <Button loading={findingEvent} onPress={() => loadEvent()}>Find event</Button>
      </Card>

      {findingEvent && !event ? <LoadingState label="Looking up your event..." /> : null}
      {error && !event ? <ErrorState message={error} /> : null}

      {event ? (
        <View style={{ gap: 16 }}>
          <ChallengeInstructions
            event={event}
            participants={participants}
            prompts={prompts}
            selectedParticipantId={selectedParticipantId}
            selectedPromptId={selectedPromptId}
            selectedItemId={selectedItemId}
            onSelectParticipant={setSelectedParticipantId}
            onSelectPrompt={setSelectedPromptId}
            onSelectItem={setSelectedItemId}
            onSelectFirstParticipant={selectFirstParticipant}
            onSelectFirstPrompt={selectFirstPrompt}
            onSelectFirstItem={() => {
              const first = awardCategories[0] as ChallengeCategory | undefined;
              if (first?.id) setSelectedItemId(first.id);
            }}
          />

          <Card>
            <SectionHeader title="Upload a photo" subtitle="Choose a fresh photo from the event or pick one from your library." />
            {event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT ? (
              <FieldGroup label="Name or nickname" helper="This appears with your upload in the album.">
                <Field placeholder="Your name" value={nickname} onChangeText={setNickname} autoCapitalize="words" />
              </FieldGroup>
            ) : selectedParticipant ? (
              <Card tone="warm" padding={12}>
                <Body>Posting as {selectedParticipant.displayName}</Body>
                <Chip swatch={selectedParticipant.colorHex}>{selectedParticipant.colorName}</Chip>
              </Card>
            ) : null}

            {selectedPrompt ? (
              <Card tone="warm" padding={12}>
                <Badge>Current prompt</Badge>
                <Body>{selectedPrompt.text}</Body>
              </Card>
            ) : null}
            {selectedAward ? (
              <Card tone="warm" padding={12}>
                <Badge>Current award</Badge>
                <Body>{selectedAward.label}</Body>
              </Card>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => choosePhoto("camera")}>Take photo</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" onPress={() => choosePhoto("library")}>Library</Button>
              </View>
            </View>

            {asset ? (
              <View style={{ gap: 10 }}>
                <Image source={{ uri: asset.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 22 }} />
                <Body tone="success">Photo selected and ready to upload.</Body>
              </View>
            ) : null}

            {!asset && uploadedPreviewUri ? (
              <View style={{ gap: 10 }}>
                <Image source={{ uri: uploadedPreviewUri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 22, opacity: 0.9 }} />
                <SuccessState message={message || "Photo uploaded."} />
              </View>
            ) : message ? <SuccessState message={message} /> : null}

            {error ? <ErrorState message={error} /> : null}
            {remaining === 0 ? <ErrorState message="You have used all uploads for this event." /> : null}
            {asset ? <Button loading={loading} disabled={!canUpload} onPress={upload}>Upload photo</Button> : null}
          </Card>

          {event.isRevealed ? (
            <Link href={`/album/${event.slug}`} asChild>
              <Button tone="secondary">View album</Button>
            </Link>
          ) : (
            <EmptyState title={capsuleCopy?.revealTitle || "Album reveal is still locked"} body={capsuleCopy?.revealNote || `Photos stay hidden until ${new Date(event.revealAt).toLocaleString()}. Keep uploading throughout the event.`} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function ChallengeInstructions({
  event,
  participants,
  prompts,
  selectedParticipantId,
  selectedPromptId,
  selectedItemId,
  onSelectParticipant,
  onSelectPrompt,
  onSelectItem,
  onSelectFirstParticipant,
  onSelectFirstPrompt,
  onSelectFirstItem,
}: {
  event: PublicEvent;
  participants: ChallengeParticipant[];
  prompts: ChallengePrompt[];
  selectedParticipantId: string;
  selectedPromptId: string;
  selectedItemId: string;
  onSelectParticipant: (id: string) => void;
  onSelectPrompt: (id: string) => void;
  onSelectItem: (id: string) => void;
  onSelectFirstParticipant: () => void;
  onSelectFirstPrompt: () => void;
  onSelectFirstItem: () => void;
}) {
  const awardCategories = categoriesFromChallenge(event.challenge);
  const activePack = getChallengePack(event.challenge?.type || "NONE");
  const capsuleCopy = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;

  if (event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT) {
    return (
      <Card tone="accent">
        <Badge tone="dark">Color Hunt</Badge>
        <SectionHeader title="Choose your color team" subtitle="Find real moments that match your color, then upload them here." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {participants.map((participant) => (
            <Chip
              key={participant.id}
              swatch={participant.colorHex}
              selected={selectedParticipantId === participant.id}
              onPress={() => participant.id && onSelectParticipant(participant.id)}
            >
              {participant.displayName}
            </Chip>
          ))}
        </View>
        {!selectedParticipantId ? <Button tone="secondary" onPress={onSelectFirstParticipant}>Choose first team</Button> : null}
      </Card>
    );
  }

  if (event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    return (
      <Card tone="accent">
        <Badge tone="dark">Photo Scavenger Hunt</Badge>
        <SectionHeader title="Pick a prompt" subtitle="Choose what you are completing before you upload." />
        <View style={{ gap: 8 }}>
          {prompts.map((prompt) => (
            <Button key={prompt.id} tone={selectedPromptId === prompt.id ? "primary" : "secondary"} onPress={() => prompt.id && onSelectPrompt(prompt.id)}>
              {prompt.text}
            </Button>
          ))}
        </View>
        {!selectedPromptId ? <Button tone="secondary" onPress={onSelectFirstPrompt}>Choose first prompt</Button> : null}
      </Card>
    );
  }

  if (event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    return (
      <Card tone="accent">
        <Badge tone="dark">Event Awards</Badge>
        <SectionHeader title="Choose an award" subtitle={activePack.guestInstructions} />
        <View style={{ gap: 8 }}>
          {awardCategories.map((category) => (
            <Button key={category.id} tone={selectedItemId === category.id ? "primary" : "secondary"} onPress={() => category.id && onSelectItem(category.id)}>
              {category.label}
            </Button>
          ))}
        </View>
        {!selectedItemId ? <Button tone="secondary" onPress={onSelectFirstItem}>Choose first award</Button> : null}
      </Card>
    );
  }

  if (event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && capsuleCopy) {
    return (
      <Card tone="accent">
        <Badge tone="dark">Memory Capsule</Badge>
        <SectionHeader title={capsuleCopy.revealTitle} subtitle={capsuleCopy.revealNote} />
      </Card>
    );
  }

  return (
    <Card tone="warm">
      <Badge>Classic album</Badge>
      <Body tone="muted">Add your name, choose a photo, and send it to the private event album.</Body>
    </Card>
  );
}
