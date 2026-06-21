require("dotenv").config();

const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL || "fernando+eventfilm-demo@example.com";
const DEMO_HOST_PASSWORD = process.env.DEMO_HOST_PASSWORD || "eventfilm-beta-demo";
const DEFAULT_DEMO_SLUG = "eventfilm-beta-demo-memory-capsule";
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l83XigAAAABJRU5ErkJggg==",
  "base64",
);

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Set STORAGE_SMOKE_API_URL or SERVER_URL before running storage smoke.");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
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

async function main() {
  const apiUrl = normalizeBaseUrl(process.env.STORAGE_SMOKE_API_URL || process.env.SERVER_URL || "http://localhost:4000");
  const slug = process.env.STORAGE_SMOKE_EVENT_SLUG || DEFAULT_DEMO_SLUG;
  const clientId = `storage-smoke-${Date.now()}`;

  console.log(`Running EventFilm storage smoke against ${apiUrl}`);
  console.log(`Using event slug ${slug}`);

  await request(apiUrl, "/api/health");

  const login = await request(apiUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_HOST_EMAIL, password: DEMO_HOST_PASSWORD }),
  });
  const token = login.data.token;

  const events = await request(apiUrl, "/api/host/events", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const event = events.data.events.find((item) => item.slug === slug);
  if (!event) {
    throw new Error(`Seeded event ${slug} was not found for ${DEMO_HOST_EMAIL}. Run npm run seed:beta-demo -w server first.`);
  }

  const formData = new FormData();
  formData.append("photo", new Blob([TEST_PNG], { type: "image/png" }), "eventfilm-storage-smoke.png");
  formData.append("nickname", "Storage Smoke");
  formData.append("clientId", clientId);

  let photoId;
  try {
    const upload = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/photos`, {
      method: "POST",
      body: formData,
    });
    photoId = upload.data.photo.id;
    console.log(`Uploaded test photo ${photoId}`);

    await request(apiUrl, `/api/photos/${encodeURIComponent(photoId)}/file`);
    await request(apiUrl, `/api/photos/${encodeURIComponent(photoId)}/preview`);

    const liveWall = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/live-wall`);
    if (!liveWall.data.photos.some((photo) => photo.id === photoId)) {
      throw new Error("Uploaded photo did not appear in the Live Wall response before moderation.");
    }

    await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(photoId)}/visibility`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ visibilityStatus: "HIDDEN", hiddenReason: "Storage smoke cleanup check" }),
    });

    const hiddenLiveWall = await request(apiUrl, `/api/events/${encodeURIComponent(slug)}/live-wall`);
    if (hiddenLiveWall.data.photos.some((photo) => photo.id === photoId)) {
      throw new Error("Hidden photo still appeared in the Live Wall response.");
    }

    const hiddenFile = await fetch(`${apiUrl}/api/photos/${encodeURIComponent(photoId)}/file`);
    if (hiddenFile.status !== 404) {
      throw new Error(`Hidden photo file route returned ${hiddenFile.status}; expected 404.`);
    }

    console.log("Storage smoke passed: upload, record, file, preview, public visibility, hide behavior.");
  } finally {
    if (photoId) {
      await request(apiUrl, `/api/host/events/${encodeURIComponent(event.id)}/photos/${encodeURIComponent(photoId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((error) => {
        console.warn(`Cleanup warning: ${error.message}`);
      });
      console.log(`Cleanup requested for test photo ${photoId}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
