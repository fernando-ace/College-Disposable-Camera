import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventFilmApiClient, EventFilmApiError, normalizeEventFilmBaseUrl } from "./index.ts";
import type { AwardVoteRequest, PhotoLikeRequest } from "./index.ts";

test("normalizes EventFilm API base URLs", () => {
  assert.equal(normalizeEventFilmBaseUrl("http://localhost:4000/"), "http://localhost:4000");
  assert.equal(normalizeEventFilmBaseUrl("api.eventfilm.test"), "https://api.eventfilm.test");
});

test("requires a non-empty EventFilm API base URL", () => {
  assert.throws(() => normalizeEventFilmBaseUrl("  "), /API base URL is required/);
});

test("client exposes normalized base URL", () => {
  const client = createEventFilmApiClient({ baseUrl: "https://api.eventfilm.test/" });
  assert.equal(client.baseUrl, "https://api.eventfilm.test");
});

test("health check uses the API health endpoint", async () => {
  const calls: string[] = [];
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  const health = await client.checkHealth();
  assert.deepEqual(health, { ok: true });
  assert.equal(calls[0], "https://api.eventfilm.test/api/health");
});

test("classifies invalid credentials as an auth error", async () => {
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  });

  await assert.rejects(() => client.login({ email: "host@example.com", password: "wrong-password" }), (error) => {
    assert.ok(error instanceof EventFilmApiError);
    assert.equal(error.kind, "auth");
    assert.equal(error.status, 401);
    assert.equal(error.message, "Invalid email or password");
    return true;
  });
});

test("classifies network failures", async () => {
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch,
  });

  await assert.rejects(() => client.checkHealth(), (error) => {
    assert.ok(error instanceof EventFilmApiError);
    assert.equal(error.kind, "network");
    assert.equal(error.status, 0);
    return true;
  });
});

test("classifies timed out requests", async () => {
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    timeoutMs: 1,
    fetchImpl: (async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
      })) as typeof fetch,
  });

  await assert.rejects(() => client.checkHealth(), (error) => {
    assert.ok(error instanceof EventFilmApiError);
    assert.equal(error.kind, "timeout");
    assert.equal(error.status, 0);
    return true;
  });
});

test("event analytics summary uses the host event endpoint", async () => {
  const calls: string[] = [];
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ summary: { eventId: "event 1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.getEventAnalyticsSummary("event 1", "token");
  assert.equal(calls[0], "https://api.eventfilm.test/api/host/events/event%201/analytics/summary");
});

test("founder overview helper uses founder endpoint with auth", async () => {
  const calls: string[] = [];
  let authHeader = "";
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url, init) => {
      calls.push(String(url));
      authHeader = String(new Headers(init?.headers).get("Authorization") || "");
      return new Response(JSON.stringify({ overview: { overview: {}, funnel: {}, recentEvents: [], activeEvents: [], recentUploads: [], recentFeedback: [], recentBetaIssues: [], usage: {}, activity: [], metricDefinitions: {}, generatedAt: "now" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.getFounderOverview("token");
  assert.equal(calls[0], "https://api.eventfilm.test/api/founder/overview");
  assert.equal(authHeader, "Bearer token");
});

test("recap helper accepts optional clientId query", async () => {
  const calls: string[] = [];
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ event: null, photos: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.getRecapData("abc", "client-1");
  assert.equal(calls[0], "https://api.eventfilm.test/api/events/abc/recap?clientId=client-1");
});

test("guest my uploads helper sends clientId query", async () => {
  const calls: string[] = [];
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ uploadedCount: 1, remainingUploads: null, photos: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  const data = await client.getGuestMyUploads("spring formal", "client 1");
  assert.deepEqual(data, { uploadedCount: 1, remainingUploads: null, photos: [] });
  assert.equal(calls[0], "https://api.eventfilm.test/api/events/spring%20formal/my-uploads?clientId=client%201");
});

test("award vote endpoint helper sends requested payload", async () => {
  const calls: string[] = [];
  let seenBody = "";
  const input: AwardVoteRequest = { photoId: "photo-1", clientId: "client-1", challengeItemId: "award-1" };

  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url, init) => {
      calls.push(String(url));
      seenBody = String(init?.body || "");
      return new Response(JSON.stringify({ ok: true, photoId: input.photoId, challengeItemId: input.challengeItemId, selected: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.castEventAwardVote("abc", input);
  assert.equal(calls[0], "https://api.eventfilm.test/api/events/abc/votes");
  assert.equal(seenBody, JSON.stringify(input));
});

test("photo like endpoint helper sends requested payload", async () => {
  const calls: string[] = [];
  let seenBody = "";
  const input: PhotoLikeRequest = { clientId: "client-1", liked: true };

  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url, init) => {
      calls.push(String(url));
      seenBody = String(init?.body || "");
      return new Response(JSON.stringify({ ok: true, photoId: "photo-1", liked: true, likeCount: 2 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  const response = await client.setPhotoLike("spring formal", "photo 1", input);
  assert.deepEqual(response, { ok: true, photoId: "photo-1", liked: true, likeCount: 2 });
  assert.equal(calls[0], "https://api.eventfilm.test/api/events/spring%20formal/photos/photo%201/likes");
  assert.equal(seenBody, JSON.stringify(input));
});

test("create event sends template and prompt pack slugs", async () => {
  let body = "";
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (_url, init) => {
      body = String(init?.body || "");
      return new Response(JSON.stringify({ event: { id: "event-1" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.createEvent({
    name: "Birthday",
    revealAt: "2026-01-02T00:00:00.000Z",
    eventTemplateSlug: "birthday-party",
    promptPackSlug: "birthday",
    challenge: null,
  });

  const payload = JSON.parse(body);
  assert.equal(payload.eventTemplateSlug, "birthday-party");
  assert.equal(payload.promptPackSlug, "birthday");
});

test("duplicate host event posts overrides to duplicate endpoint", async () => {
  const calls: string[] = [];
  let body = "";
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url, init) => {
      calls.push(String(url));
      body = String(init?.body || "");
      return new Response(JSON.stringify({ event: { id: "event-copy" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.duplicateHostEvent("event 1", { name: "Next Formal" }, "token");

  assert.equal(calls[0], "https://api.eventfilm.test/api/host/events/event%201/duplicate");
  assert.equal(body, JSON.stringify({ name: "Next Formal" }));
});

test("update host event settings patches the encoded host event endpoint", async () => {
  const calls: string[] = [];
  let method = "";
  let auth = "";
  let body = "";
  const input = {
    name: "Updated Formal",
    description: "New host note",
    revealAt: "2026-06-22T16:00:00.000Z",
  };
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (url, init) => {
      calls.push(String(url));
      method = init?.method || "";
      auth = new Headers(init?.headers).get("Authorization") || "";
      body = String(init?.body || "");
      return new Response(JSON.stringify({ event: { id: "event-1", photos: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.updateHostEventSettings("event 1", input, "token");

  assert.equal(calls[0], "https://api.eventfilm.test/api/host/events/event%201");
  assert.equal(method, "PATCH");
  assert.equal(auth, "Bearer token");
  assert.equal(body, JSON.stringify(input));
});

test("host feedback helper posts submit and skip payloads", async () => {
  const bodies: string[] = [];
  const client = createEventFilmApiClient({
    baseUrl: "https://api.eventfilm.test/",
    fetchImpl: (async (_url, init) => {
      bodies.push(String(init?.body || ""));
      return new Response(JSON.stringify({ feedback: { id: "feedback-1", createdAt: "now", updatedAt: "now" } }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch,
  });

  await client.submitHostEventFeedback("event-1", { outcome: "great", repeatIntent: "yes", note: "Guests got it." }, "token");
  await client.submitHostEventFeedback("event-1", { skipped: true }, "token");
  await client.submitHostEventFeedback("event-1", { kind: "beta_issue", issueArea: "guest_upload", note: "Upload stalled." }, "token");

  assert.equal(bodies[0], JSON.stringify({ outcome: "great", repeatIntent: "yes", note: "Guests got it." }));
  assert.equal(bodies[1], JSON.stringify({ skipped: true }));
  assert.equal(bodies[2], JSON.stringify({ kind: "beta_issue", issueArea: "guest_upload", note: "Upload stalled." }));
});
