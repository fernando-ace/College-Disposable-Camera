import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventFilmApiClient, normalizeEventFilmBaseUrl } from "./index.ts";

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
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 10,
    eventTemplateSlug: "birthday-party",
    promptPackSlug: "birthday",
    challenge: null,
  });

  const payload = JSON.parse(body);
  assert.equal(payload.eventTemplateSlug, "birthday-party");
  assert.equal(payload.promptPackSlug, "birthday");
});
