require("dotenv").config();

const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL || "fernando+eventfilm-demo@example.com";
const DEMO_HOST_PASSWORD = process.env.DEMO_HOST_PASSWORD || "eventfilm-beta-demo";
const DEFAULT_DEMO_SLUG = "eventfilm-beta-demo-storage-smoke";
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l83XigAAAABJRU5ErkJggg==",
  "base64",
);
const REQUIRED_ENV_VARS = ["DATABASE_URL", "SERVER_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"];

const state = {
  step: "startup",
  photoId: null,
  photoRecordCreated: false,
  cleanupAttempted: false,
  cleanupSucceeded: false,
  smokeAssertionsPassed: false,
};

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Set STORAGE_SMOKE_API_URL or SERVER_URL before running storage smoke.");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function logEnvPresence(apiUrl) {
  console.log("Storage smoke safe env check:");
  console.log(`- STORAGE_SMOKE_API_URL: ${process.env.STORAGE_SMOKE_API_URL ? "present" : "missing; using SERVER_URL/default"}`);
  console.log(`- Target API URL: ${apiUrl}`);
  for (const name of REQUIRED_ENV_VARS) {
    console.log(`- ${name}: ${process.env[name] && process.env[name].trim() ? "present" : "missing"}`);
  }
}

function setStep(step) {
  state.step = step;
  console.log(`\n== ${step} ==`);
}

function suggestedAction(error) {
  const message = String(error?.message || error || "");
  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
    return "Confirm the API server is running and STORAGE_SMOKE_API_URL or SERVER_URL points at it. If the API is deployed, confirm the Supabase project is unpaused.";
  }
  if (message.includes("Supabase Storage is not configured")) {
    return "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET in the API environment.";
  }
  if (message.includes("Bucket not found") || message.includes("bucket")) {
    return "Confirm the Supabase private bucket named by SUPABASE_STORAGE_BUCKET exists.";
  }
  if (message.includes("permission") || message.includes("policy") || message.includes("row-level security") || message.includes("Unauthorized")) {
    return "Confirm the server is using the Supabase service role key and that the storage bucket/policies allow server-side object upload, download, and removal.";
  }
  if (message.includes("mime") || message.includes("Photo file") || message.includes("JPG, PNG")) {
    return "Confirm the upload handler still accepts the tiny PNG used by the smoke.";
  }
  if (message.includes("not appear") || message.includes("still appeared") || message.includes("expected")) {
    return "Inspect the API route named in the failing step for visibility, reveal, or moderation behavior.";
  }
  return "Review the failing step above, then rerun npm run demo:seed and npm run smoke:storage after fixing the blocker.";
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}: ${data?.error || response.statusText}`);
  }
  return { response, data };
}

async function expectStatus(baseUrl, path, status, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (response.status !== status) {
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}; expected ${status}.`);
  }
}

function assertPhotoInList(photos, photoId, label) {
  if (!photos.some((photo) => photo.id === photoId)) {
    throw new Error(`Uploaded photo did not appear in ${label}.`);
  }
}

function assertPhotoNotInList(photos, photoId, label) {
  if (photos.some((photo) => photo.id === photoId)) {
    throw new Error(`Hidden photo still appeared in ${label}.`);
  }
}

function firstChallengeUploadFields(event) {
  const challenge = event.challenge;
  if (!challenge) return {};
  if (challenge.type === "COLOR_HUNT") {
    const participant = challenge.participants?.[0];
    if (!participant) throw new Error("Seeded Color Hunt event has no participants for storage smoke upload.");
    return { challengeParticipantId: participant.id };
  }
  if (challenge.type === "PHOTO_SCAVENGER_HUNT") {
    const prompt = challenge.prompts?.[0];
    if (!prompt) throw new Error("Seeded Photo Scavenger Hunt event has no prompts for storage smoke upload.");
    return { challengePromptId: prompt.id };
  }
  if (challenge.type === "EVENT_AWARDS") {
    const category = challenge.categories?.[0];
    if (!category) throw new Error("Seeded Event Awards event has no categories for storage smoke upload.");
    return { challengeItemId: category.id };
  }
  return {};
}

async function main() {
  const apiUrl = normalizeBaseUrl(process.env.STORAGE_SMOKE_API_URL || process.env.SERVER_URL || "http://localhost:4000");
  const slug = process.env.STORAGE_SMOKE_EVENT_SLUG || DEFAULT_DEMO_SLUG;
  const clientId = `storage-smoke-${Date.now()}`;

  console.log(`Running EventFilm storage smoke against ${apiUrl}`);
  console.log(`Using event slug ${slug}`);
  logEnvPresence(apiUrl);

  setStep("API health");
  await request(apiUrl, "/api/health");

  setStep("Host login");
  const login = await request(apiUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_HOST_EMAIL, password: DEMO_HOST_PASSWORD }),
  });
  const token = login.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  setStep("Seeded event lookup");
  const events = await request(apiUrl, "/api/host/events", {
    headers: authHeaders,
  });
  const event = events.data.events.find((item) => item.slug === slug);
  if (!event) {
    throw new Error(`Seeded event ${slug} was not found for ${DEMO_HOST_EMAIL}. Run npm run seed:beta-demo -w server first.`);
  }

  setStep("Valid analytics write");
  const analyticsWrite = await request(apiUrl, "/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "guest_joined_event",
      source: "api",
      path: `/e/${slug}`,
      eventId: event.id,
      eventSlug: slug,
      anonymousId: clientId,
      metadata: { route: "storage-smoke" },
    }),
  });
  if (analyticsWrite.data?.ok !== true) {
    throw new Error("Valid analytics write did not return ok: true.");
  }

  setStep("Host event detail before upload");
  const eventDetail = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}`, {
    headers: authHeaders,
  });
  const uploadFields = firstChallengeUploadFields(eventDetail.data.event);

  const formData = new FormData();
  formData.append("photo", new Blob([TEST_PNG], { type: "image/png" }), "eventfilm-storage-smoke.png");
  formData.append("nickname", "Storage Smoke");
  formData.append("clientId", clientId);
  for (const [key, value] of Object.entries(uploadFields)) {
    formData.append(key, value);
  }

  try {
    setStep("Guest upload through public API");
    const upload = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/photos`, {
      method: "POST",
      body: formData,
    });
    state.photoId = upload.data.photo.id;
    console.log(`Uploaded test photo ${state.photoId}`);

    setStep("Host photo record check");
    const hostPhotos = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos`, {
      headers: authHeaders,
    });
    assertPhotoInList(hostPhotos.data.photos, state.photoId, "host photo records");
    state.photoRecordCreated = true;

    setStep("Public file and preview routes");
    await request(apiUrl, `/api/photos/${encodeURIComponent(state.photoId)}/file`);
    await request(apiUrl, `/api/photos/${encodeURIComponent(state.photoId)}/preview`);

    setStep("Public guest album route");
    const album = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/photos`);
    assertPhotoInList(album.data.photos, state.photoId, "guest album response");

    setStep("Live Wall route");
    const liveWall = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/live-wall`);
    if (liveWall.data.isLocked) {
      console.log("Live Wall is locked by reveal rules; skipping visible-photo assertion for this route.");
    } else {
      assertPhotoInList(liveWall.data.photos, state.photoId, "Live Wall response");
    }

    setStep("Recap route");
    const recap = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/recap`);
    if (recap.data.isLocked) {
      console.log("Recap is locked by reveal rules; skipping visible-photo assertion for this route.");
    } else {
      assertPhotoInList(recap.data.photos, state.photoId, "Recap response");
    }

    setStep("Host feature and unfeature");
    const featured = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(state.photoId)}/featured`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: true }),
    });
    if (!featured.data.photo.isFeatured) throw new Error("Host feature request did not mark photo as featured.");
    const unfeatured = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(state.photoId)}/featured`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured: false }),
    });
    if (unfeatured.data.photo.isFeatured) throw new Error("Host unfeature request left photo marked as featured.");

    setStep("Guest report flow");
    await request(apiUrl, `/api/photos/${encodeURIComponent(state.photoId)}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "privacy", note: "Storage smoke report check", reporterId: clientId }),
    });
    const reportedPhotos = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos?reported=true`, {
      headers: authHeaders,
    });
    assertPhotoInList(reportedPhotos.data.photos, state.photoId, "host reported-photo queue");

    setStep("Host hide moderation");
    const hidden = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(state.photoId)}/visibility`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ visibilityStatus: "HIDDEN", hiddenReason: "Storage smoke cleanup check" }),
    });
    if (hidden.data.photo.visibilityStatus !== "HIDDEN") throw new Error("Host hide request did not mark photo as hidden.");

    setStep("Hidden photo public visibility");
    const hiddenAlbum = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/photos`);
    assertPhotoNotInList(hiddenAlbum.data.photos, state.photoId, "guest album response");
    const hiddenLiveWall = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/live-wall`);
    assertPhotoNotInList(hiddenLiveWall.data.photos, state.photoId, "Live Wall response");
    const hiddenRecap = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/recap`);
    assertPhotoNotInList(hiddenRecap.data.photos, state.photoId, "Recap response");
    await expectStatus(apiUrl, `/api/photos/${encodeURIComponent(state.photoId)}/file`, 404);
    await expectStatus(apiUrl, `/api/photos/${encodeURIComponent(state.photoId)}/preview`, 404);

    setStep("Host restore moderation");
    const restored = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(state.photoId)}/visibility`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ visibilityStatus: "VISIBLE" }),
    });
    if (restored.data.photo.visibilityStatus !== "VISIBLE") throw new Error("Host restore request did not mark photo as visible.");

    setStep("Event analytics summary");
    const analytics = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/analytics/summary`, {
      headers: authHeaders,
    });
    if (analytics.data.summary.photoCount < 1 || analytics.data.summary.reportedPhotos < 1) {
      throw new Error("Event analytics summary did not include the uploaded/reported smoke photo.");
    }

    state.smokeAssertionsPassed = true;
  } finally {
    if (state.photoId) {
      setStep("Cleanup");
      state.cleanupAttempted = true;
      const cleanup = await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(state.photoId)}`, {
        method: "DELETE",
        headers: authHeaders,
      }).catch((error) => {
        console.warn(`Cleanup warning: ${error.message}`);
        return null;
      });
      state.cleanupSucceeded = Boolean(cleanup);
      console.log(`Cleanup requested for test photo ${state.photoId}`);
      if (!state.cleanupSucceeded) {
        throw new Error("Cleanup did not complete for the uploaded storage smoke photo.");
      }
    }
  }

  if (state.smokeAssertionsPassed && state.cleanupSucceeded) {
    console.log("\nStorage smoke passed: upload, record, album, Live Wall, Recap, feature/unfeature, report, hide/restore, public visibility, analytics, and cleanup.");
  }
}

main().catch((error) => {
  console.error(`\nStorage smoke failed at step: ${state.step}`);
  console.error(error.message);
  console.error(`Photo record created: ${state.photoRecordCreated ? "yes" : "no"}`);
  console.error(`Cleanup attempted: ${state.cleanupAttempted ? "yes" : "no"}`);
  console.error(`Cleanup succeeded: ${state.cleanupSucceeded ? "yes" : "no"}`);
  console.error(`Suggested next action: ${suggestedAction(error)}`);
  process.exitCode = 1;
});
