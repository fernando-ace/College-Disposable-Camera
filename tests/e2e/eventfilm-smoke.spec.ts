import { expect, test } from "@playwright/test";
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const apiUrl = (process.env.BROWSER_SMOKE_API_URL || process.env.EVENTFILM_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const baseUrl = (process.env.BROWSER_SMOKE_BASE_URL || process.env.EVENTFILM_WEB_URL || "http://localhost:5173").replace(/\/+$/, "");
const seededSlug = process.env.EVENTFILM_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-memory-capsule";
const revealedSeededSlug = process.env.EVENTFILM_REVEALED_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-storage-smoke";
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

  test("public marketing and trust pages load without console errors", async ({ page }) => {
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

    await page.goto("/demo");
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole("heading", { name: "Demo Event" })).toBeVisible();
    await expect(page.locator("#demo-event-album img[alt^='Demo Event sample photo']")).toHaveCount(4);
    await expect(page.getByRole("link", { name: /^Add photos$/i }).first()).toHaveAttribute("href", /\/signup$/);

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

  test("demo guest view renders sample photos and routes add photos to signup on mobile", async ({ page }) => {
    const consoleProblems: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
    });
    page.on("pageerror", (error) => consoleProblems.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Demo Event" })).toBeVisible();
    await expect(page.locator("#demo-event-album img[alt^='Demo Event sample photo']")).toHaveCount(4);
    await expectNoHorizontalOverflow(page);

    const addPhotos = page.getByRole("link", { name: /^Add photos$/i }).first();
    await expect(addPhotos).toHaveAttribute("href", /\/signup$/);
    await addPhotos.click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: /Create host account/i })).toBeVisible();
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
    const photoCount = Number(eventPayload.event?.photoCount || 0);
    const guestSubtitle = eventPayload.event?.challenge?.type === "MEMORY_CAPSULE" && !eventPayload.event?.isRevealed
      ? "Photos locked"
      : `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`;

    await page.setViewportSize({ width: 390, height: 520 });
    await page.goto(`/e/${seededSlug}`);
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();
    await expect(page.getByTestId("guest-album-header")).toBeVisible();
    await expect(page.locator("body")).toContainText("Add photos");
    await expect(page.locator("#event-album")).toContainText(/album unlocks|Album reveal is locked|No photos yet|recent moments/i);
    await page.locator("#event-album").evaluate((element) => {
      element.setAttribute("style", `${element.getAttribute("style") || ""}; min-height: 1600px;`);
    });
    await page.evaluate(() => window.scrollTo(0, 260));
    const pageScrollBeforeSheet = await page.evaluate(() => window.scrollY);
    expect(pageScrollBeforeSheet).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Add photos" }).first().click();
    await expect(page.locator("#guest-upload-card")).toContainText(/Take photo|Library/i);
    const uploadDialog = page.getByRole("dialog", { name: "Add photos" });
    await expect(uploadDialog).toContainText(/No account needed/i);
    const headerSnapshot = page.getByTestId("guest-album-header-snapshot");
    await expect(headerSnapshot).toBeVisible();
    await expect(headerSnapshot.locator("h1")).toHaveText(eventName);
    await expect(headerSnapshot.locator("p")).toHaveText(guestSubtitle);
    await expect(headerSnapshot.locator("nav")).toContainText("Photos");
    await expect(headerSnapshot.locator("nav")).toContainText("People");
    await expect(headerSnapshot.locator("nav")).toContainText("Highlights");
    const sheetPanel = page.getByTestId("upload-sheet-panel");
    const sheetLayout = await page.evaluate(() => {
      function rectFor(selector: string) {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height };
      }
      return {
        header: rectFor("[data-testid='guest-album-header-snapshot']"),
        dialog: rectFor("[role='dialog'][aria-label='Add photos']"),
        sheet: rectFor("[data-testid='upload-sheet-panel']"),
      };
    });
    if (!sheetLayout.header || !sheetLayout.dialog || !sheetLayout.sheet) throw new Error("Guest upload sheet layout was missing expected elements.");
    expect(Math.floor(sheetLayout.header.top)).toBeGreaterThanOrEqual(0);
    expect(sheetLayout.header.height).toBeGreaterThan(0);
    expect(sheetLayout.dialog.top).toBeGreaterThanOrEqual(sheetLayout.header.bottom - 1);
    expect(sheetLayout.sheet.top).toBeGreaterThanOrEqual(sheetLayout.header.bottom - 1);
    const uploadSheetHeading = sheetPanel.getByRole("heading", { name: "Add photos" });
    await expect(uploadSheetHeading).toBeVisible();
    const uploadSheetHeadingTopBeforeScroll = await uploadSheetHeading.evaluate((element) => element.getBoundingClientRect().top);

    const lockedPageState = await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      htmlOverflow: document.documentElement.style.overflow,
    }));
    expect(lockedPageState).toMatchObject({
      bodyOverflow: "hidden",
      bodyPosition: "fixed",
      htmlOverflow: "hidden",
    });
    expect(Math.abs(Number.parseFloat(lockedPageState.bodyTop) + pageScrollBeforeSheet)).toBeLessThanOrEqual(1);

    await page.mouse.move(20, 20);
    await page.mouse.wheel(0, 700);
    await page.waitForFunction((expectedScroll) => Math.abs(Number.parseFloat(document.body.style.top) + expectedScroll) <= 1, pageScrollBeforeSheet);
    const lockedScrollDelta = await page.evaluate((expectedScroll) => Math.abs(Number.parseFloat(document.body.style.top) + expectedScroll), pageScrollBeforeSheet);
    expect(lockedScrollDelta).toBeLessThanOrEqual(1);

    const sheetScrollBefore = await sheetPanel.evaluate((element) => (element as HTMLElement).scrollTop);
    const sheetCanScroll = await sheetPanel.evaluate((element) => {
      const panel = element as HTMLElement;
      return panel.scrollHeight > panel.clientHeight;
    });
    if (sheetCanScroll) {
      await page.locator("#my-uploads").scrollIntoViewIfNeeded();
      const sheetScrollAfter = await sheetPanel.evaluate((element) => (element as HTMLElement).scrollTop);
      expect(sheetScrollAfter).toBeGreaterThan(sheetScrollBefore);
      const sheetScrollDelta = sheetScrollAfter - sheetScrollBefore;
      const scrolledSheetLayout = await page.evaluate(() => {
        const sheet = document.querySelector("[data-testid='upload-sheet-panel']");
        const heading = sheet?.querySelector("h2");
        const uploads = document.querySelector("#my-uploads");
        if (!sheet || !heading || !uploads) return null;
        const sheetRect = sheet.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const uploadsRect = uploads.getBoundingClientRect();
        return {
          headingTop: headingRect.top,
          headingBottom: headingRect.bottom,
          sheetTop: sheetRect.top,
          sheetBottom: sheetRect.bottom,
          uploadsTop: uploadsRect.top,
        };
      });
      if (!scrolledSheetLayout) throw new Error("Guest upload sheet layout was missing after sheet scroll.");
      expect(scrolledSheetLayout.headingTop).toBeLessThan(uploadSheetHeadingTopBeforeScroll);
      expect(Math.abs(uploadSheetHeadingTopBeforeScroll - scrolledSheetLayout.headingTop - sheetScrollDelta)).toBeLessThanOrEqual(2);
      await expect(page.locator("#my-uploads")).toBeVisible();
    } else {
      await expect(page.locator("#my-uploads")).toBeVisible();
    }

    await uploadDialog.getByRole("button", { name: "Close upload sheet" }).last().click();
    await expect(uploadDialog).toHaveCount(0);
    await expect(page.getByTestId("guest-album-header-snapshot")).toHaveCount(0);
    await expect(page.getByTestId("guest-album-header")).toBeVisible();
    await page.waitForFunction((expectedScroll) => Math.abs(window.scrollY - expectedScroll) <= 1, pageScrollBeforeSheet);
    const restoredScrollDelta = await page.evaluate((expectedScroll) => Math.abs(window.scrollY - expectedScroll), pageScrollBeforeSheet);
    expect(restoredScrollDelta).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 720 });

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
        if ((revealedRecap.photos || []).length > 1) {
          await page.locator("#recap-photos img").first().click();
          const viewer = page.getByRole("dialog", { name: "Photo viewer" });
          await expect(viewer).toBeVisible();
          const viewerCounter = viewer.getByText(new RegExp(`\\d+ of ${revealedRecap.photos.length}`));
          const beforeCounter = await viewerCounter.textContent();
          await page.keyboard.press("ArrowRight");
          await expect.poll(async () => viewerCounter.textContent()).not.toBe(beforeCounter);
          await viewer.getByRole("button", { name: "Close photo viewer" }).click();
          await expect(viewer).toBeHidden();
        }
        const likeButton = page.getByRole("button", { name: /^Like photo, \d+ hearts?$/i }).first();
        await expect(likeButton).toBeVisible();
        const beforeCount = heartCountFromLabel(await likeButton.getAttribute("aria-label"));
        const likeSaved = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/likes") && response.ok());
        await likeButton.click();
        const likeResponse = await likeSaved;
        const likePayload = await likeResponse.json();
        expect(likePayload.liked).toBe(true);
        const unlikeButton = page.getByRole("button", { name: /^Unlike photo, \d+ hearts?$/i }).first();
        await expect(unlikeButton).toBeVisible();
        expect(heartCountFromLabel(await unlikeButton.getAttribute("aria-label"))).toBe(beforeCount + 1);
        const unlikeSaved = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/likes") && response.ok());
        await unlikeButton.click();
        const unlikeResponse = await unlikeSaved;
        const unlikePayload = await unlikeResponse.json();
        expect(unlikePayload.liked).toBe(false);
        await expect(page.getByRole("button", { name: /^Like photo, \d+ hearts?$/i }).first()).toBeVisible();
      }
      if ((revealedRecap.awardResults?.categories || []).length > 0) {
        await expect(page.getByRole("heading", { name: "Award leaders" }).first()).toBeVisible();
        await expect(page.locator("body")).toContainText(/Hearts decide winners|heart favorite photos/i);
      }
    }
  });

  test("guest stale upload metadata is pruned when host-deleted photos disappear", async ({ page }) => {
    const slug = "deleted-upload-local-state";
    const origin = parsedUrl(baseUrl).origin;
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    };
    const event = {
      id: "deleted-upload-event",
      name: "Deleted Upload Party",
      description: null,
      slug,
      eventDate: "2026-06-14T20:00:00.000Z",
      revealAt: "2026-06-14T20:00:00.000Z",
      photoLimitPerGuest: 0,
      eventTemplateSlug: null,
      promptPackSlug: null,
      isRevealed: true,
      photoCount: 0,
      challenge: null,
    };
    const json = (body: unknown) => ({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    await page.addInitScript((eventSlug: string) => {
      window.localStorage.setItem(`eventfilm_guest_${eventSlug}`, JSON.stringify({ clientId: "deleted-upload-client", nickname: "" }));
      window.localStorage.setItem(`eventfilm_guest_uploads_${eventSlug}`, JSON.stringify([
        {
          photoId: "host-deleted-photo",
          uploadedAt: "2026-06-14T20:01:00.000Z",
          guestDisplayName: "Jordan",
          challengeLabel: "Best candid",
        },
      ]));
    }, slug);
    await page.route(`**/api/events/${slug}`, (route) => route.fulfill(json({ event })));
    await page.route(`**/api/events/${slug}/guest-status**`, (route) => route.fulfill(json({ uploadedCount: 0, remainingUploads: null, nickname: null })));
    await page.route(`**/api/events/${slug}/my-uploads**`, (route) => route.fulfill(json({ uploadedCount: 0, remainingUploads: null, photos: [] })));
    await page.route(`**/api/events/${slug}/photos**`, (route) => route.fulfill(json({ photos: [] })));
    await page.route("**/api/analytics**", (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill(json({ ok: true }));
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${slug}`);
    await expect(page.getByRole("heading", { name: "Deleted Upload Party" })).toBeVisible();
    await page.getByRole("button", { name: "Add photos" }).first().click();
    const uploadDialog = page.getByRole("dialog", { name: "Add photos" });
    await expect(uploadDialog).toContainText("No uploads from this device yet.");
    await expect(uploadDialog).not.toContainText("Best candid");

    const storedUploads = await page.evaluate((eventSlug) => window.localStorage.getItem(`eventfilm_guest_uploads_${eventSlug}`), slug);
    expect(JSON.parse(storedUploads || "[]")).toEqual([]);
  });

  test("guest upload sheet header scrolls with panel content", async ({ page }) => {
    const slug = "upload-sheet-scroll-smoke";
    const origin = parsedUrl(baseUrl).origin;
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    };
    const event = {
      id: "upload-sheet-scroll-event",
      name: "Upload Sheet Scroll Party",
      description: null,
      slug,
      eventDate: "2026-06-14T20:00:00.000Z",
      revealAt: "2026-06-14T20:00:00.000Z",
      photoLimitPerGuest: 0,
      eventTemplateSlug: null,
      promptPackSlug: null,
      isRevealed: true,
      photoCount: 18,
      challenge: null,
    };
    const json = (body: unknown) => ({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    await page.route(`**/api/events/${slug}`, (route) => route.fulfill(json({ event })));
    await page.route(`**/api/events/${slug}/guest-status**`, (route) => route.fulfill(json({ uploadedCount: 0, remainingUploads: null, nickname: null })));
    await page.route(`**/api/events/${slug}/my-uploads**`, (route) => route.fulfill(json({ uploadedCount: 0, remainingUploads: null, photos: [] })));
    await page.route(`**/api/events/${slug}/photos**`, (route) => route.fulfill(json({ photos: [] })));
    await page.route("**/api/analytics**", (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill(json({ ok: true }));
    });

    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto(`/e/${slug}`);
    await expect(page.getByRole("heading", { name: "Upload Sheet Scroll Party" })).toBeVisible();
    await page.getByRole("button", { name: "Add photos" }).first().click();

    const sheetPanel = page.getByTestId("upload-sheet-panel");
    const sheetHeader = page.getByTestId("upload-sheet-header");
    await expect(sheetPanel).toContainText("No uploads from this device yet.");
    await expect(sheetHeader).toBeVisible();

    const beforeScroll = await page.evaluate(() => {
      const sheet = document.querySelector("[data-testid='upload-sheet-panel']");
      const header = document.querySelector("[data-testid='upload-sheet-header']");
      if (!sheet || !header) return null;
      const sheetElement = sheet as HTMLElement;
      const headerRect = header.getBoundingClientRect();
      return {
        headerTop: headerRect.top,
        maxScroll: sheetElement.scrollHeight - sheetElement.clientHeight,
        scrollTop: sheetElement.scrollTop,
      };
    });
    if (!beforeScroll) throw new Error("Guest upload sheet was missing before scroll.");
    expect(beforeScroll.maxScroll).toBeGreaterThan(0);

    await sheetPanel.evaluate((element) => {
      const panel = element as HTMLElement;
      panel.scrollTop = Math.min(80, panel.scrollHeight - panel.clientHeight);
    });

    const afterScroll = await page.evaluate(() => {
      const sheet = document.querySelector("[data-testid='upload-sheet-panel']");
      const header = document.querySelector("[data-testid='upload-sheet-header']");
      if (!sheet || !header) return null;
      const sheetElement = sheet as HTMLElement;
      const headerRect = header.getBoundingClientRect();
      return {
        headerTop: headerRect.top,
        scrollTop: sheetElement.scrollTop,
      };
    });
    if (!afterScroll) throw new Error("Guest upload sheet was missing after scroll.");
    const scrollDelta = afterScroll.scrollTop - beforeScroll.scrollTop;
    expect(scrollDelta).toBeGreaterThan(0);
    expect(afterScroll.headerTop).toBeLessThan(beforeScroll.headerTop);
    expect(Math.abs(beforeScroll.headerTop - afterScroll.headerTop - scrollDelta)).toBeLessThanOrEqual(2);
  });

  test("guest can select multiple album photos and open save options", async ({ page }) => {
    const slug = "multi-save-smoke";
    const origin = parsedUrl(baseUrl).origin;
    const corsHeaders = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    };
    const event = {
      id: "multi-save-event",
      name: "Multi Save Party",
      description: null,
      slug,
      eventDate: "2026-06-14T20:00:00.000Z",
      revealAt: "2026-06-14T20:00:00.000Z",
      photoLimitPerGuest: 0,
      eventTemplateSlug: null,
      promptPackSlug: null,
      isRevealed: true,
      photoCount: 2,
      challenge: null,
    };
    const photos = [
      {
        id: "multi-save-photo-1",
        url: `${apiUrl}/api/photos/multi-save-photo-1/file`,
        previewUrl: `${apiUrl}/api/photos/multi-save-photo-1/preview`,
        originalFilename: "multi-save-one.png",
        mimeType: "image/png",
        sizeBytes: 68,
        createdAt: "2026-06-14T20:01:00.000Z",
        guestNickname: "Ava",
        likeCount: 0,
        likedByMe: false,
      },
      {
        id: "multi-save-photo-2",
        url: `${apiUrl}/api/photos/multi-save-photo-2/file`,
        previewUrl: `${apiUrl}/api/photos/multi-save-photo-2/preview`,
        originalFilename: "multi-save-two.png",
        mimeType: "image/png",
        sizeBytes: 68,
        createdAt: "2026-06-14T20:02:00.000Z",
        guestNickname: "Mia",
        likeCount: 0,
        likedByMe: false,
      },
    ];
    const imageBody = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
    const json = (body: unknown) => ({
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: (data: { files?: File[] }) => Boolean(data.files?.length),
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: { files?: File[] }) => {
          const shareWindow = window as Window & { __eventfilmSharedFileCount?: number; __eventfilmSharedFileNames?: string[] };
          shareWindow.__eventfilmSharedFileCount = data.files?.length || 0;
          shareWindow.__eventfilmSharedFileNames = (data.files || []).map((file) => file.name);
        },
      });
    });
    await page.route(`**/api/events/${slug}`, (route) => route.fulfill(json({ event })));
    await page.route(`**/api/events/${slug}/guest-status**`, (route) => route.fulfill(json({ nickname: null })));
    await page.route(`**/api/events/${slug}/my-uploads**`, (route) => route.fulfill(json({ uploadedCount: 0, remainingUploads: null, photos: [] })));
    await page.route(`**/api/events/${slug}/photos**`, (route) => route.fulfill(json({ photos })));
    await page.route("**/api/photos/multi-save-photo-*/file", (route) => route.fulfill({ status: 200, headers: { ...corsHeaders, "content-type": "image/png" }, body: imageBody }));
    await page.route("**/api/photos/multi-save-photo-*/preview", (route) => route.fulfill({ status: 200, headers: { ...corsHeaders, "content-type": "image/png" }, body: imageBody }));
    await page.route("**/api/analytics**", (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsHeaders });
      return route.fulfill(json({ ok: true }));
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/e/${slug}`);
    await expect(page.getByRole("heading", { name: "Multi Save Party" })).toBeVisible();
    await expect(page.locator("#event-album img")).toHaveCount(2);

    await page.locator("#event-album img[alt='multi-save-one.png']").click();
    const viewer = page.getByRole("dialog", { name: "Photo viewer" });
    await expect(viewer).toBeVisible();
    const viewerStrip = viewer.getByTestId("photo-viewer-strip");
    await expect(viewer.getByTestId("photo-viewer-slide")).toHaveCount(2);
    await expect(viewer.getByText("1 of 2")).toBeVisible();
    await expect(viewer.getByRole("heading", { name: "Ava" })).toBeVisible();
    await expect(viewer.getByRole("button", { name: /^Like photo, 0 hearts?$/i })).toBeVisible();

    await viewerStrip.evaluate((element) => {
      element.scrollLeft = element.clientWidth;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(viewer.getByText("2 of 2")).toBeVisible();
    await expect(viewer.getByRole("heading", { name: "Mia" })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(viewer.getByText("1 of 2")).toBeVisible();
    await expect(viewer.getByRole("heading", { name: "Ava" })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByText("2 of 2")).toBeVisible();
    await viewer.getByRole("button", { name: "Close photo viewer" }).click();
    await expect(viewer).toBeHidden();

    await page.locator("#event-album").evaluate((element) => {
      element.setAttribute("style", `${element.getAttribute("style") || ""}; min-height: 1400px;`);
    });
    await page.evaluate(() => window.scrollTo(0, 80));
    const pageScrollBeforeSelection = await page.evaluate(() => window.scrollY);
    expect(pageScrollBeforeSelection).toBeGreaterThan(0);
    const expectSelectionScrollPreserved = async () => {
      await expect.poll(
        () => page.evaluate((expectedScroll) => Math.abs(window.scrollY - expectedScroll), pageScrollBeforeSelection),
        { timeout: 1000 },
      ).toBeLessThanOrEqual(1);
    };

    await page.getByRole("button", { name: "Open event options" }).click();
    await expect(page.getByRole("button", { name: "Select Photos" })).toBeVisible();

    await page.getByRole("button", { name: "Select Photos" }).click();
    await expectSelectionScrollPreserved();
    await expect(page.getByText("0 selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save selected" })).toBeDisabled();
    await page.getByRole("button", { name: "Select multi-save-one.png" }).click();
    await expectSelectionScrollPreserved();
    await expect(page.getByText("1 selected")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("1 selected")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add photos" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Open event options" }).click();
    await page.getByRole("button", { name: "Select Photos" }).click();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("button", { name: "Save selected" }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __eventfilmSharedFileCount?: number }).__eventfilmSharedFileCount || 0)).toBe(2);
    await expect(page.getByRole("status")).toContainText("Opened save options for 2 photos.");
    await expect(page.getByRole("button", { name: "Add photos" }).first()).toBeVisible();
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
      await expect(page.locator("#guest-upload-card")).toContainText(/Take photo|Library/i);
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

    const smokeUploadFiles = [
      {
        name: "guest-browser-smoke-1.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2w==", "base64"),
      },
      {
        name: "guest-browser-smoke-2.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2w==", "base64"),
      },
    ];

    await page.getByLabel("Choose from phone").setInputFiles(smokeUploadFiles);
    await expect(page.locator("#guest-upload-card")).toContainText("2 photos added.");
    await expect(page.getByRole("link", { name: "View my uploads" })).toBeVisible();
    await page.getByRole("link", { name: "View my uploads" }).click();
    await expect(page.locator("#my-uploads")).toContainText("Your uploads");
    await expect(page.locator("#my-uploads img")).toHaveCount(2);

    const uploads = await request.get(`${apiUrl}/api/events/${revealedSeededSlug}/my-uploads`, {
      params: { clientId: await page.evaluate(() => JSON.parse(window.localStorage.getItem(`eventfilm_guest_${location.pathname.split("/").pop()}`) || "{}").clientId || "") },
    });
    if (uploads.ok()) {
      const data = await uploads.json();
      for (const photo of data.photos || []) {
        if (["guest-browser-smoke-1.jpg", "guest-browser-smoke-2.jpg"].includes(photo.originalFilename)) {
          await request.delete(`${apiUrl}/api/host/events/${eventId}/photos/${photo.id}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
        }
      }
    }
  });
});
