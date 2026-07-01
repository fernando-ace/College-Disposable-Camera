import { expect, test } from "@playwright/test";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const apiUrl = (process.env.BROWSER_SMOKE_API_URL || process.env.EVENTFILM_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const baseUrl = (process.env.BROWSER_SMOKE_BASE_URL || process.env.EVENTFILM_WEB_URL || "http://localhost:5173").replace(/\/+$/, "");
const seededSlug = process.env.EVENTFILM_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-memory-capsule";
const revealedSeededSlug = process.env.EVENTFILM_REVEALED_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-storage-smoke";
const landingDemoSlug = process.env.VITE_LANDING_DEMO_SLUG || revealedSeededSlug;
const defaultSmokeHostEmail = "fernando+eventfilm-demo@example.com";
const defaultSmokeHostPassword = "eventfilm-beta-demo";

function parsedUrl(value: string) {
  return new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `http://${value}`);
}

function isLocalUrl(value: string) {
  const hostname = parsedUrl(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function heartCountFromLabel(label: string | null) {
  return Number(label?.match(/(\d+)\s+hearts?/i)?.[1] || 0);
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.viewportWidth);
}

async function expectLocatorFitsViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(Math.floor(box.x)).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box.x + box.width)).toBeLessThanOrEqual(viewportWidth);
}

async function expectLocatorFullyFitsViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(Math.floor(box.x)).toBeGreaterThanOrEqual(0);
  expect(Math.floor(box.y)).toBeGreaterThanOrEqual(0);
  expect(Math.ceil(box.x + box.width)).toBeLessThanOrEqual(viewport.width);
  expect(Math.ceil(box.y + box.height)).toBeLessThanOrEqual(viewport.height);
}

async function expectLandingCreateLinks(page: Page, href: RegExp) {
  const createLinks = page.getByRole("link", { name: /^Create your first event$/i });
  await expect(createLinks).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(createLinks.nth(index)).toHaveAttribute("href", href);
  }
}

const isDeployedBrowserSmoke = !isLocalUrl(baseUrl);

function requireHttpsUrl(value: string, envName: string) {
  if (!value.startsWith("https://")) {
    throw new Error(`${envName} must include https:// for deployed smoke. Example: $env:BROWSER_SMOKE_API_URL="https://college-disposable-camera-production.up.railway.app"`);
  }
}

if (isDeployedBrowserSmoke) {
  requireHttpsUrl(apiUrl, "BROWSER_SMOKE_API_URL");
}

const smokeHostEmail = isDeployedBrowserSmoke
  ? String(process.env.BROWSER_SMOKE_HOST_EMAIL || "").trim()
  : String(process.env.BROWSER_SMOKE_HOST_EMAIL || process.env.DEMO_HOST_EMAIL || defaultSmokeHostEmail).trim();
const smokeHostPassword = isDeployedBrowserSmoke
  ? String(process.env.BROWSER_SMOKE_HOST_PASSWORD || "").trim()
  : String(process.env.BROWSER_SMOKE_HOST_PASSWORD || process.env.DEMO_HOST_PASSWORD || defaultSmokeHostPassword).trim();

if (isDeployedBrowserSmoke && (!smokeHostEmail || !smokeHostPassword)) {
  throw new Error("Set BROWSER_SMOKE_HOST_EMAIL and BROWSER_SMOKE_HOST_PASSWORD for deployed host login smoke. Do not commit these values.");
}

type BrowserLoginDiagnostic = {
  origin: string | null;
  status: number | null;
  wentToRailway: boolean;
  wentToVercelOrigin: boolean;
  corsOrNetworkFailure: boolean;
  failureText: string | null;
};

async function assertDirectRailwayAuthWorks(request: APIRequestContext) {
  let response;
  try {
    response = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email: smokeHostEmail, password: smokeHostPassword },
    });
  } catch {
    throw new Error("Railway auth endpoint could not be reached. Check BROWSER_SMOKE_API_URL and Railway deploy status.");
  }

  const contentType = response.headers()["content-type"] || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected JSON from Railway auth but received non-JSON. Check BROWSER_SMOKE_API_URL.");
  }

  if (response.status() === 200) {
    console.log("Direct Railway auth works. Continue to browser login.");
    return;
  }
  if (response.status() === 401) {
    throw new Error("The deployed host credentials were rejected by the Railway API. Confirm the production host account and BROWSER_SMOKE_HOST_PASSWORD.");
  }
  if (response.status() === 500) {
    throw new Error("Railway auth returned a server error. Check production env vars such as DATABASE_URL, JWT_SECRET, ANALYTICS_SALT, CLIENT_ORIGIN(S), and provider logs.");
  }

  throw new Error(`Railway auth returned unexpected status ${response.status()}. Check BROWSER_SMOKE_API_URL and Railway deploy status.`);
}

function summarizeBrowserLoginFailure(diagnostic: BrowserLoginDiagnostic, pageErrorText: string | null) {
  const details = [
    `Browser login request origin: ${diagnostic.origin || "not observed"}`,
    `Browser login status: ${diagnostic.status ?? "not observed"}`,
    `Browser login target: ${diagnostic.wentToRailway ? "Railway" : diagnostic.wentToVercelOrigin ? "Vercel origin" : "other or not observed"}`,
    `CORS or network failure: ${diagnostic.corsOrNetworkFailure ? "yes" : "no"}`,
    `Network failure detail: ${diagnostic.failureText || "not observed"}`,
    `Page error message: ${pageErrorText || "not shown"}`,
  ];

  if (diagnostic.wentToVercelOrigin || diagnostic.origin === parsedUrl(baseUrl).origin || diagnostic.origin?.includes("localhost")) {
    details.push("Diagnostic: Check Vercel VITE_API_URL.");
  } else if (diagnostic.corsOrNetworkFailure) {
    details.push("Diagnostic: Check Railway CLIENT_ORIGIN or CLIENT_ORIGINS includes https://eventfilm.vercel.app.");
  } else if (diagnostic.status === 401) {
    details.push("Diagnostic: Browser is sending different credentials or payload than the direct API diagnostic.");
  } else if (diagnostic.status === 500) {
    details.push("Diagnostic: Check Railway logs.");
  }

  return details.join("\n");
}

function cleanupCreatedSmokeEvent(eventId: string) {
  const script = `
    const prisma = require("./server/src/prisma");
    const eventId = process.argv[1];
    (async () => {
      if (process.env.NODE_ENV === "production") throw new Error("Refusing to cleanup smoke event in production.");
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true } });
      if (event?.name?.startsWith("Browser Smoke")) {
        await prisma.event.delete({ where: { id: eventId } });
      }
    })()
      .finally(async () => prisma.$disconnect())
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  `;
  execFileSync(process.execPath, ["-e", script, eventId], { cwd: process.cwd(), stdio: "pipe" });
}

async function expectFirstEditorItemKeyboardReorders(page: Page, handleName: string, inputs: Locator) {
  await expect(inputs.nth(1)).toBeVisible();
  const firstValue = await inputs.nth(0).inputValue();
  const secondValue = await inputs.nth(1).inputValue();

  await page.getByRole("button", { name: handleName }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");

  await expect(inputs.nth(0)).toHaveValue(secondValue);
  await expect(inputs.nth(1)).toHaveValue(firstValue);
}

test.describe("EventFilm browser smoke", () => {
  test.beforeEach(async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    test.info().annotations.push({ type: "consoleProblems", description: consoleProblems.join("\n") });
  });

  test("public marketing and trust pages load without console errors", async ({ page, request }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
    });
    page.on("pageerror", (error) => consoleProblems.push(error.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Stop chasing photos after the event/i })).toBeVisible();
    await expectLandingCreateLinks(page, /\/signup$/);
    await expect(page.getByRole("link", { name: /^Dashboard$/i }).first()).toHaveAttribute("href", /\/dashboard$/);
    await expect(page.getByRole("link", { name: /Try a demo/i })).toHaveAttribute("href", /\/demo$/);

    let demoEventAvailable = false;
    try {
      const demoEventResponse = await request.get(`${apiUrl}/api/events/${encodeURIComponent(landingDemoSlug)}`);
      demoEventAvailable = demoEventResponse.ok();
    } catch {
      demoEventAvailable = false;
    }

    await page.goto("/demo");
    if (demoEventAvailable) {
      await expect(page).toHaveURL(new RegExp(`/e/${escapeRegExp(landingDemoSlug)}$`));
    } else {
      await expect(page.getByRole("heading", { name: /See how guests add photos/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Dashboard$/i }).first()).toHaveAttribute("href", /\/dashboard$/);
    }

    for (const path of ["/privacy", "/terms", "/support"]) {
      await page.goto(path);
      await expect(page.locator("body")).toContainText(/EventFilm|Privacy|Terms|Support/i);
    }

    expect(consoleProblems).toEqual([]);
  });

  test("main landing create CTA opens the create screen for signed-in hosts", async ({ browser }) => {
    const consoleProblems: string[] = [];
    const signedInContext = await browser.newContext({
      baseURL: baseUrl,
      storageState: {
        cookies: [],
        origins: [
          {
            origin: parsedUrl(baseUrl).origin,
            localStorage: [
              { name: "eventfilm_token", value: "browser-smoke-token" },
              { name: "eventfilm_user", value: JSON.stringify({ id: "browser-smoke-user", email: "host@example.com", isFounder: false }) },
            ],
          },
        ],
      },
    });

    try {
      const signedInPage = await signedInContext.newPage();
      signedInPage.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
      });
      signedInPage.on("pageerror", (error) => consoleProblems.push(error.message));

      await signedInPage.goto("/");
      await expect(signedInPage.getByRole("heading", { name: /Stop chasing photos after the event/i })).toBeVisible();
      await expectLandingCreateLinks(signedInPage, /\/dashboard\/events\/new$/);
      await signedInPage.getByRole("link", { name: /^Create your first event$/i }).first().click();
      await expect(signedInPage).toHaveURL(/\/dashboard\/events\/new$/);
      await expect(signedInPage.getByRole("heading", { name: /^Create an event$/i })).toBeVisible();
    } finally {
      await signedInContext.close();
    }

    expect(consoleProblems).toEqual([]);
  });

  test("demo preview fallback renders a mobile-safe MP4 video", async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
    });
    page.on("pageerror", (error) => consoleProblems.push(error.message));
    await page.route(`**/api/events/${encodeURIComponent(landingDemoSlug)}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "demo unavailable during smoke",
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: /See how guests add photos/i })).toBeVisible();

    const mediaFrame = page.getByLabel("EventFilm guest upload demo media");
    await expect(mediaFrame).toBeVisible();
    await expectLocatorFullyFitsViewport(page, mediaFrame);
    const demoVideo = page.getByLabel("EventFilm guest upload demo video");
    await expect(demoVideo).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const videoState = await demoVideo.evaluate((element) => {
      const video = element as HTMLVideoElement;
      const sources = Array.from(video.querySelectorAll("source")).map((source) => ({
        src: source.getAttribute("src"),
        type: source.getAttribute("type"),
      }));
      return {
        controls: video.controls,
        muted: video.muted,
        networkNoSource: HTMLMediaElement.NETWORK_NO_SOURCE,
        networkState: video.networkState,
        playsInline: video.playsInline,
        poster: video.getAttribute("poster"),
        preload: video.getAttribute("preload"),
        sources,
      };
    });

    expect(videoState.controls).toBe(true);
    expect(videoState.muted).toBe(true);
    expect(videoState.playsInline).toBe(true);
    expect(videoState.poster).toBe("/demo/guest-upload-poster.webp");
    expect(videoState.preload).toBe("metadata");
    expect(videoState.networkState).not.toBe(videoState.networkNoSource);
    expect(videoState.sources).toEqual([
      { src: "/demo/guest-upload-demo.mp4", type: 'video/mp4; codecs="avc1.640028"' },
      { src: "/demo/guest-upload-demo.webm", type: 'video/webm; codecs="vp9"' },
    ]);
    expect(consoleProblems).toEqual([]);
  });

  test("host auth routes handle unauthenticated dashboard access cleanly", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Host login/i })).toBeVisible();

    await page.goto("/dashboard/events/new");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Host login/i })).toBeVisible();

    await page.goto("/dashboard/founder");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Host login/i })).toBeVisible();
  });

  test("host can sign in and create an event with clear next steps", async ({ page, request }) => {
    const health = await request.get(`${apiUrl}/api/health`);
    test.skip(!health.ok(), `API health check failed at ${apiUrl}`);

    let createdEventId = "";

    try {
      if (isDeployedBrowserSmoke) {
        await assertDirectRailwayAuthWorks(request);
      }

      const browserLoginDiagnostic: BrowserLoginDiagnostic = {
        origin: null,
        status: null,
        wentToRailway: false,
        wentToVercelOrigin: false,
        corsOrNetworkFailure: false,
        failureText: null,
      };
      const apiOrigin = parsedUrl(apiUrl).origin;
      const webOrigin = parsedUrl(baseUrl).origin;

      page.on("request", (browserRequest) => {
        if (!browserRequest.url().includes("/api/auth/login")) return;
        const origin = parsedUrl(browserRequest.url()).origin;
        browserLoginDiagnostic.origin = origin;
        browserLoginDiagnostic.wentToRailway = origin === apiOrigin;
        browserLoginDiagnostic.wentToVercelOrigin = origin === webOrigin;
      });
      page.on("response", (browserResponse) => {
        if (!browserResponse.url().includes("/api/auth/login")) return;
        browserLoginDiagnostic.origin = parsedUrl(browserResponse.url()).origin;
        browserLoginDiagnostic.status = browserResponse.status();
      });
      page.on("requestfailed", (browserRequest) => {
        if (!browserRequest.url().includes("/api/auth/login")) return;
        browserLoginDiagnostic.origin = parsedUrl(browserRequest.url()).origin;
        browserLoginDiagnostic.corsOrNetworkFailure = true;
        browserLoginDiagnostic.failureText = browserRequest.failure()?.errorText || null;
      });

      await page.goto("/login");
      await page.locator("input[type='email']").fill(smokeHostEmail);
      await page.locator("input[type='password']").fill(smokeHostPassword);
      await page.getByRole("button", { name: "Log in" }).click();
      try {
        await expect(page).toHaveURL(/\/dashboard$/);
      } catch (error) {
        const pageErrorText = await page.locator("form .text-red-700").first().textContent().catch(() => null);
        throw new Error(`${(error as Error).message}\n${summarizeBrowserLoginFailure(browserLoginDiagnostic, pageErrorText)}`);
      }
      await expect(page.getByRole("heading", { name: "Event library" })).toBeVisible();
      await expect(page.getByLabel("Search events")).toBeVisible();

      await page.getByRole("link", { name: "Create event" }).first().click();
      await expect(page.getByRole("heading", { name: "Create an event" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText("Event type");
      await expect(page.getByRole("heading", { name: "Photo style" })).toBeVisible();
      await expect(page.locator("body")).toContainText(/Simple Album|Photo Prompts|Optional setup/);
      await expect(page.getByLabel(/Reveal time/)).toHaveCount(0);

      await page.getByRole("button", { name: /^Memory Capsule/ }).click();
      const revealTimeInput = page.getByLabel(/Reveal time/);
      await expect(revealTimeInput).toBeVisible();
      const createEventOrder = await page.evaluate(() => {
        const headingByText = (text: string) => Array.from(document.querySelectorAll("h2")).find((node) => node.textContent?.trim() === text);
        const labelByText = (text: string) => Array.from(document.querySelectorAll("label")).find((node) => node.textContent?.includes(text));
        const styleHeading = headingByText("Photo style");
        const revealLabel = labelByText("Reveal time");
        const optionalHeading = headingByText("Optional setup");
        return {
          styleBeforeReveal: Boolean(styleHeading && revealLabel && (styleHeading.compareDocumentPosition(revealLabel) & Node.DOCUMENT_POSITION_FOLLOWING)),
          revealBeforeOptional: Boolean(revealLabel && optionalHeading && (revealLabel.compareDocumentPosition(optionalHeading) & Node.DOCUMENT_POSITION_FOLLOWING)),
        };
      });
      expect(createEventOrder).toEqual({ styleBeforeReveal: true, revealBeforeOptional: true });
      const styleBox = await page.getByRole("heading", { name: "Photo style" }).boundingBox();
      const revealBox = await revealTimeInput.boundingBox();
      const optionalBox = await page.getByRole("heading", { name: "Optional setup" }).boundingBox();
      expect(styleBox).not.toBeNull();
      expect(revealBox).not.toBeNull();
      expect(optionalBox).not.toBeNull();
      if (styleBox && revealBox && optionalBox) {
        expect(styleBox.y).toBeLessThan(revealBox.y);
        expect(revealBox.y).toBeLessThan(optionalBox.y);
      }

      await page.getByRole("button", { name: /^Photo Prompts/ }).click();
      await expect(page.getByLabel(/Reveal time/)).toHaveCount(0);
      await page.getByRole("button", { name: "Customize" }).click();
      await page.getByRole("button", { name: /Edit prompts/ }).click();
      await expect(page.getByRole("button", { name: /^Up$/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Down$/ })).toHaveCount(0);
      await expectFirstEditorItemKeyboardReorders(page, "Drag to reorder prompt 1", page.getByPlaceholder("Photo prompt"));

      await page.getByRole("button", { name: /^Awards/ }).click();
      await page.getByRole("button", { name: "Customize" }).click();
      await page.getByRole("button", { name: /Edit award categories/ }).click();
      await expect(page.getByRole("button", { name: /^Up$/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Down$/ })).toHaveCount(0);
      await expectFirstEditorItemKeyboardReorders(page, "Drag to reorder award category 1", page.getByPlaceholder("Award category"));

      await page.getByRole("button", { name: /^Simple Album/ }).click();

      const eventName = `Browser Smoke ${Date.now()}`;
      await page.getByLabel("Event name").fill(eventName);
      await page.getByRole("button", { name: "Create event" }).click();

      await expect(page.getByRole("heading", { name: "Your event is ready." })).toBeVisible();
      const createdUrl = page.url();
      createdEventId = createdUrl.match(/\/dashboard\/events\/([^/?#]+)/)?.[1] || "";
      expect(createdEventId).toBeTruthy();

      const createdHandoff = page.locator("[aria-label='Event creation success']");
      await expect(createdHandoff).toContainText("Guests can add photos without an account.");
      await expect(createdHandoff.getByRole("button", { name: "Copy guest link" })).toBeVisible();
      await expect(createdHandoff.getByRole("link", { name: "Download QR poster" })).toBeVisible();
      await expect(createdHandoff.getByRole("link", { name: "Preview guest page" })).toBeVisible();
    } finally {
      if (createdEventId) cleanupCreatedSmokeEvent(createdEventId);
    }
  });

  test("seeded guest and Shared Recap routes render while Photo Wall is removed", async ({ page, request }) => {
    const health = await request.get(`${apiUrl}/api/health`);
    test.skip(!health.ok(), `API health check failed at ${apiUrl}`);

    const eventResponse = await request.get(`${apiUrl}/api/events/${seededSlug}`);
    test.skip(!eventResponse.ok(), `Seeded event ${seededSlug} not found. Run npm run demo:seed first.`);
    const eventPayload = await eventResponse.json();
    const eventName = eventPayload.event?.name || "EventFilm";

    await page.goto(`/e/${seededSlug}`);
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.locator("body")).toContainText("Add photos");
    await expect(page.locator("#event-album")).toContainText(/album unlocks|Album reveal is locked|No photos yet|recent moments/i);
    await page.getByRole("button", { name: "Add photos" }).first().click();
    await expect(page.locator("form#guest-upload-card")).toContainText(/Add photos/i);
    await expect(page.getByRole("dialog", { name: "Add photos" })).toContainText(/No account needed/i);

    const removedLiveWallResponse = await request.get(`${apiUrl}/api/events/${seededSlug}/live-wall`);
    expect(removedLiveWallResponse.status()).toBe(404);

    await page.goto(`/wall/${seededSlug}`);
    await expect(page.getByRole("heading", { name: "Photo Wall" })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Photo Wall");

    await page.goto(`/recap/${seededSlug}`);
    await expect(page.locator("body")).toContainText(new RegExp(`Shared Recap|${escapeRegExp(eventName)}|locked|Photos are saved for the reveal`, "i"));

    const revealedRecapResponse = await request.get(`${apiUrl}/api/events/${revealedSeededSlug}/recap`);
    if (revealedRecapResponse.ok()) {
      const revealedRecap = await revealedRecapResponse.json();
      await page.goto(`/recap/${revealedSeededSlug}`);
      await expect(page.getByRole("heading", { name: "Shared Recap" })).toBeVisible();
      await expect(page.locator("body")).toContainText(revealedRecap.event.name);
      await expect(page.locator("body")).toContainText(/Shared Recap|Photos from the event, all in one place|No photos yet/i);
      await expect(page.getByRole("link", { name: /Add photos/i }).first()).toBeVisible();
      if ((revealedRecap.photos || []).length > 0) {
        await expect(page.locator("#recap-photos img").first()).toBeVisible();
        const likeButton = page.getByRole("button", { name: /^Like photo, \d+ hearts?$/i }).first();
        await expect(likeButton).toBeVisible();
        const beforeCount = heartCountFromLabel(await likeButton.getAttribute("aria-label"));
        await likeButton.click();
        const unlikeButton = page.getByRole("button", { name: /^Unlike photo, \d+ hearts?$/i }).first();
        await expect(unlikeButton).toBeVisible();
        expect(heartCountFromLabel(await unlikeButton.getAttribute("aria-label"))).toBe(beforeCount + 1);
        await page.reload();
        const persistedUnlikeButton = page.getByRole("button", { name: /^Unlike photo, \d+ hearts?$/i }).first();
        await expect(persistedUnlikeButton).toBeVisible();
        await persistedUnlikeButton.click();
        await expect(page.getByRole("button", { name: /^Like photo, \d+ hearts?$/i }).first()).toBeVisible();
      }
      if ((revealedRecap.awardResults?.categories || []).length > 0) {
        await expect(page.getByRole("heading", { name: "Award leaders" }).first()).toBeVisible();
        await expect(page.locator("body")).toContainText(/Hearts decide winners|heart favorite photos/i);
      }
    }
  });

  test("seeded host event shows event library, share kit, and ordinary host help", async ({ page, request }) => {
    const health = await request.get(`${apiUrl}/api/health`);
    test.skip(!health.ok(), `API health check failed at ${apiUrl}`);

    const eventResponse = await request.get(`${apiUrl}/api/events/${seededSlug}`);
    test.skip(!eventResponse.ok(), `Seeded event ${seededSlug} not found. Run npm run demo:seed first.`);
    const eventPayload = await eventResponse.json();
    const eventId = eventPayload.event?.id;
    test.skip(!eventId, `Seeded event ${seededSlug} did not include an id.`);
    const originalSettings = {
      name: eventPayload.event.name,
      description: eventPayload.event.description || null,
      revealAt: eventPayload.event.revealAt,
    };

    const login = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email: smokeHostEmail, password: smokeHostPassword },
    });
    test.skip(!login.ok(), `Smoke host login failed. Run npm run demo:seed first for local smoke or confirm the deployed smoke host credentials.`);
    const auth = await login.json();

    await page.addInitScript(({ token, user }) => {
      window.localStorage.setItem("eventfilm_token", token);
      window.localStorage.setItem("eventfilm_user", JSON.stringify(user));
    }, { token: auth.token, user: auth.user });
    await page.context().grantPermissions(["clipboard-write"], { origin: parsedUrl(baseUrl).origin });

    await page.goto(`/dashboard/events/${eventId}?created=1`);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    const createdHandoff = page.getByLabel("Event creation success");
    await expect(page.getByRole("heading", { name: "Your event is ready." })).toBeVisible();
    await expect(createdHandoff).toContainText("Guests can add photos without an account.");
    const handoffCopyGuestLink = createdHandoff.getByRole("button", { name: "Copy guest link" });
    await expect(handoffCopyGuestLink).toBeVisible();
    await expect(createdHandoff.getByRole("link", { name: "Download QR poster" })).toHaveAttribute("href", new RegExp(`/dashboard/events/${eventId}/poster`));
    await expect(createdHandoff.getByRole("link", { name: "Preview guest page" })).toHaveAttribute("href", new RegExp(`/e/${seededSlug}`));
    await expect(createdHandoff).toContainText("Review photos");
    await expect(createdHandoff).toContainText("Share the recap");
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileEventSignOut = page.getByRole("button", { name: "Sign out" });
    await expect(mobileEventSignOut).toBeVisible();
    await expectLocatorFitsViewport(page, mobileEventSignOut);
    await handoffCopyGuestLink.scrollIntoViewIfNeeded();
    await handoffCopyGuestLink.click();
    const handoffCopyStatus = createdHandoff.getByRole("status");
    await expect(handoffCopyStatus).toContainText("Guest link copied");
    await expectLocatorFitsViewport(page, handoffCopyStatus);
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("heading", { name: "Your event is ready." })).toHaveCount(0);
    await expect(page).not.toHaveURL(/created=1/);

    await page.goto(`/dashboard/events/${eventId}?tab=share`);
    await expect(page.getByText(/Next step/i).first()).toBeVisible();
    await expect(page.getByText("Guest link").first()).toBeVisible();
    const qrPosterCard = page.getByRole("heading", { name: "QR code event poster" }).locator("..");
    await expect(qrPosterCard).toBeVisible();
    await expect(qrPosterCard.getByText("Scan, print, or share")).toBeVisible();
    await expect(qrPosterCard.getByRole("link", { name: "Share" })).toHaveAttribute("href", new RegExp(`/dashboard/events/${eventId}/poster`));
    await expect(page.getByText("Message to paste in group chat").first()).toBeVisible();
    await expect(page.getByText("Which link should I use?").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy message" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    for (const tab of ["Share", "Photos", "Recap", "Settings"]) {
      await expectLocatorFitsViewport(page, page.getByRole("button", { name: tab, exact: true }));
    }
    await expectLocatorFitsViewport(page, page.getByText("Message to paste in group chat").locator("..").getByText(/Add your photos here:/));
    await expectLocatorFitsViewport(page, page.getByRole("button", { name: "Copy message" }));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("button", { name: "Settings" }).click();
    try {
      const updatedName = `${originalSettings.name} Smoke`;
      await page.getByLabel("Event name").fill(updatedName);
      await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
      await page.getByRole("button", { name: /Save changes/i }).click();
      await expect(page.getByText(/Event settings saved/i)).toBeVisible();
      await expect(page.locator("h1", { hasText: updatedName })).toBeVisible();

      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect(page.locator("h1", { hasText: updatedName })).toBeVisible();
      await expect(page.getByText("Guest link").first()).toBeVisible();
      const refreshedQrPosterCard = page.getByRole("heading", { name: "QR code event poster" }).locator("..");
      await expect(refreshedQrPosterCard).toBeVisible();
      await expect(refreshedQrPosterCard.getByRole("link", { name: "Share" })).toHaveAttribute("href", new RegExp(`/dashboard/events/${eventId}/poster`));
      await expect(page.getByText("Message to paste in group chat").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy message" })).toBeVisible();
      await expect(page.locator("input[aria-label='Guest link']")).toHaveValue(new RegExp(`/e/${seededSlug}`));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`/dashboard/events/${eventId}/poster`);
      await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
      await expect(page.locator("body")).toContainText("Scan to add photos");
      await expect(page.locator("body")).toContainText(/No account needed\.?/);
      await expect(page.getByRole("button", { name: "Copy guest link" })).toBeVisible();
      await expect(page.getByAltText("Guest upload QR code")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectLocatorFullyFitsViewport(page, page.locator(".poster-sheet"));

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/dashboard/events/${eventId}/poster`);
      await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();
      await expect(page.getByAltText("Guest upload QR code")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectLocatorFullyFitsViewport(page, page.locator(".poster-sheet"));
      const mobileCopyGuestLink = page.getByRole("button", { name: "Copy guest link" });
      await mobileCopyGuestLink.scrollIntoViewIfNeeded();
      await expect(mobileCopyGuestLink).toBeVisible();
      await expectLocatorFitsViewport(page, mobileCopyGuestLink);
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.goto(`/dashboard/events/${eventId}?tab=live-wall`);
      await expect(page.getByRole("button", { name: "Photo Wall" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Photo Wall" })).toHaveCount(0);
      await expect(page.locator(`a[href$="/wall/${seededSlug}"]`)).toHaveCount(0);
      await expect(page.getByText("Guest link").first()).toBeVisible();

      await page.goto(`/dashboard/events/${eventId}?tab=uploads`);
      await expect(page.getByRole("heading", { name: "Review photos", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /All photos/i })).toBeVisible();

      await page.goto(`/e/${seededSlug}`);
      await page.getByRole("button", { name: "Add photos" }).first().click();
      await expect(page.locator("form#guest-upload-card")).toContainText(/Add photos/i);
      await expect(page.getByRole("dialog", { name: "Add photos" })).toContainText(/No account needed/i);

      await request.patch(`${apiUrl}/api/host/events/${eventId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        data: {
          ...originalSettings,
          name: updatedName,
          revealAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Event library" })).toBeVisible();
      await expect(page.getByLabel("Search events")).toBeVisible();
      const mobileDashboardSignOut = page.getByRole("button", { name: "Sign out" });
      await expect(mobileDashboardSignOut).toBeVisible();
      await expectLocatorFitsViewport(page, mobileDashboardSignOut);
      await expect(page.getByText(updatedName).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const mobileEventCard = page.getByRole("link", { name: new RegExp(`Open event: ${escapeRegExp(updatedName)}`) }).first();
      await expect(mobileEventCard).toBeVisible();
      await expect(mobileEventCard).toHaveAttribute("href", new RegExp(`/dashboard/events/${eventId}$`));
      await expectLocatorFitsViewport(page, mobileEventCard);
      await expect(mobileEventCard).not.toContainText("Open this event to manage");
      const mobileEventCardBox = await mobileEventCard.boundingBox();
      expect(mobileEventCardBox).not.toBeNull();
      if (mobileEventCardBox) {
        expect(Math.abs(mobileEventCardBox.height - mobileEventCardBox.width * 9 / 16)).toBeLessThanOrEqual(2);
      }
      await expect(page.getByRole("button", { name: "Share guest link" })).toHaveCount(0);
      await expect(page.getByText("Recap ready")).toHaveCount(0);
      await expect(page.getByText("More")).toHaveCount(0);
      await page.getByLabel("Search events").fill(updatedName);
      await expect(page.getByText(updatedName).first()).toBeVisible();
      await expect(mobileEventCard).toBeVisible();
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.goto(`/dashboard/events/${eventId}?tab=recap`);
      await expect(page.getByRole("heading", { name: "Shared Recap" })).toBeVisible();
      await expect(page.locator("body")).toContainText(/Send this whenever you want everyone to revisit the album|Send this after reveal/i);
      await expect(page.getByRole("link", { name: "Preview recap" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy recap link" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Download photos" })).toBeVisible();
      await expect(page.locator("body")).toContainText("Before you share it");
    } finally {
      await request.patch(`${apiUrl}/api/host/events/${eventId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        data: originalSettings,
      });
    }

    await page.goto(`/dashboard/events/${eventId}?tab=settings`);
    await page.getByText("Help and repeat event").click();
    await expect(page.getByRole("button", { name: "Create similar event" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Turn this event into the next one.");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /Host login/i })).toBeVisible();
    const signedOutStorage = await page.evaluate(() => ({
      token: window.localStorage.getItem("eventfilm_token"),
      user: window.localStorage.getItem("eventfilm_user"),
    }));
    expect(signedOutStorage).toEqual({ token: null, user: null });
  });

  test("guest can upload without signing in when local storage smoke is enabled", async ({ page, request }) => {
    test.skip(process.env.ENABLE_GUEST_UPLOAD_BROWSER_SMOKE !== "1", "Set ENABLE_GUEST_UPLOAD_BROWSER_SMOKE=1 for the real browser upload smoke.");

    const health = await request.get(`${apiUrl}/api/health`);
    test.skip(!health.ok(), `API health check failed at ${apiUrl}`);

    const eventResponse = await request.get(`${apiUrl}/api/events/${revealedSeededSlug}`);
    test.skip(!eventResponse.ok(), `Revealed smoke event ${revealedSeededSlug} not found. Run npm run demo:seed first.`);
    const eventPayload = await eventResponse.json();
    const eventId = eventPayload.event?.id;
    test.skip(!eventId, `Revealed smoke event ${revealedSeededSlug} did not include an id.`);

    const login = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email: smokeHostEmail, password: smokeHostPassword },
    });
    test.skip(!login.ok(), "Smoke host login failed, so the upload smoke cannot clean up after itself.");
    const auth = await login.json();

    await page.goto(`/e/${revealedSeededSlug}`);
    await page.getByRole("button", { name: "Add photos" }).first().click();
    await expect(page.getByRole("dialog", { name: "Add photos" })).toContainText(/No account needed/i);
    await expect(page.locator("#my-uploads")).toContainText("No uploads from this device yet.");

    await page.getByLabel("Choose from phone").setInputFiles({
      name: "guest-browser-smoke.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2w==", "base64"),
    });
    await page.locator("form#guest-upload-card").getByRole("button", { name: "Add photos" }).click();
    await expect(page.locator("form#guest-upload-card")).toContainText("Photo added.");
    await expect(page.getByRole("button", { name: "Add another photo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View my uploads" })).toBeVisible();
    await page.getByRole("link", { name: "View my uploads" }).click();
    await expect(page.locator("#my-uploads")).toContainText("Your uploads on this device");
    await expect(page.locator("#my-uploads img")).toHaveCount(1);

    const uploads = await request.get(`${apiUrl}/api/events/${revealedSeededSlug}/my-uploads`, {
      params: { clientId: await page.evaluate(() => JSON.parse(window.localStorage.getItem(`eventfilm_guest_${location.pathname.split("/").pop()}`) || "{}").clientId || "") },
    });
    if (uploads.ok()) {
      const data = await uploads.json();
      for (const photo of data.photos || []) {
        if (photo.originalFilename === "guest-browser-smoke.jpg") {
          await request.delete(`${apiUrl}/api/host/events/${eventId}/photos/${photo.id}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
        }
      }
    }
  });
});
