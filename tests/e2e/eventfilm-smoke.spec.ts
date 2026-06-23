import { expect, test } from "@playwright/test";

const apiUrl = (process.env.EVENTFILM_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const seededSlug = process.env.EVENTFILM_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-memory-capsule";
const revealedSeededSlug = process.env.EVENTFILM_REVEALED_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-storage-smoke";
const demoHostEmail = process.env.DEMO_HOST_EMAIL || "fernando+eventfilm-demo@example.com";
const demoHostPassword = process.env.DEMO_HOST_PASSWORD || "eventfilm-beta-demo";

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
    await expect(page.getByRole("link", { name: /Create your first event/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Try the demo/i })).toBeVisible();

    for (const path of ["/privacy", "/terms", "/support"]) {
      await page.goto(path);
      await expect(page.locator("body")).toContainText(/EventFilm|Privacy|Terms|Support/i);
    }

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

  test("seeded guest, Live Wall, and Recap routes render", async ({ page, request }) => {
    const health = await request.get(`${apiUrl}/api/health`);
    test.skip(!health.ok(), `API health check failed at ${apiUrl}`);

    const eventResponse = await request.get(`${apiUrl}/api/events/${seededSlug}`);
    test.skip(!eventResponse.ok(), `Seeded event ${seededSlug} not found. Run npm run demo:seed first.`);

    await page.goto(`/e/${seededSlug}`);
    await expect(page.getByRole("heading", { name: /EventFilm Beta Demo/i })).toBeVisible();
    await expect(page.locator("body")).toContainText("No account needed");
    await expect(page.locator("body")).toContainText("Add your photos to the private event album.");
    await expect(page.locator("#guest-upload-card")).toContainText(/Add photos/i);
    await expect(page.locator("#event-album")).toContainText(/Photos are being collected|album unlocks/i);

    await page.goto(`/wall/${seededSlug}`);
    await expect(page.locator("body")).toContainText(/Live Wall|EventFilm Beta Demo/i);

    for (const mode of ["grid", "slideshow", "join", "challenge"]) {
      await page.goto(`/wall/${seededSlug}?mode=${mode}`);
      await expect(page.locator("body")).toContainText(/Live Wall|EventFilm Beta Demo|Scan to upload|Challenge/i);
    }

    await page.goto(`/recap/${seededSlug}`);
    await expect(page.locator("body")).toContainText(/Recap|EventFilm Beta Demo|locked/i);

    const revealedRecapResponse = await request.get(`${apiUrl}/api/events/${revealedSeededSlug}/recap`);
    if (revealedRecapResponse.ok()) {
      const revealedRecap = await revealedRecapResponse.json();
      await page.goto(`/recap/${revealedSeededSlug}`);
      await expect(page.getByRole("heading", { name: revealedRecap.event.name })).toBeVisible();
      await expect(page.locator("body")).toContainText(/Recap ready|Photos still coming in|Photos/i);
      await expect(page.getByRole("link", { name: /Add photos/i }).first()).toBeVisible();
      if ((revealedRecap.photos || []).length > 0) {
        await expect(page.locator("#recap-photos img").first()).toBeVisible();
      }
    }
  });

  test("seeded host event shows beta handoff and issue-report entry", async ({ page, request }) => {
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
      eventDate: eventPayload.event.eventDate,
      revealAt: eventPayload.event.revealAt,
      photoLimitPerGuest: eventPayload.event.photoLimitPerGuest,
    };

    const login = await request.post(`${apiUrl}/api/auth/login`, {
      data: { email: demoHostEmail, password: demoHostPassword },
    });
    test.skip(!login.ok(), `Demo host login failed. Run npm run demo:seed first.`);
    const auth = await login.json();

    await page.addInitScript(({ token, user }) => {
      window.localStorage.setItem("eventfilm_token", token);
      window.localStorage.setItem("eventfilm_user", JSON.stringify(user));
    }, { token: auth.token, user: auth.user });

    await page.goto(`/dashboard/events/${eventId}`);
    await expect(page.getByText(/First beta host handoff/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Run this first event without guessing/i })).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();
    try {
      const updatedName = `${originalSettings.name} Smoke`;
      await page.getByLabel("Event name").fill(updatedName);
      await expect(page.getByText(/Unsaved changes/i)).toBeVisible();
      await page.getByRole("button", { name: /Save changes/i }).click();
      await expect(page.getByText(/Event settings saved/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

      await page.getByRole("button", { name: "Share", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Share the guest upload link/i })).toBeVisible();
      await expect(page.locator("input[readonly]").first()).toHaveValue(new RegExp(`/e/${seededSlug}`));

      await page.goto(`/e/${seededSlug}`);
      await expect(page.locator("body")).toContainText("No account needed");
      await expect(page.locator("#guest-upload-card")).toContainText(/Add photos/i);

      await page.goto(`/dashboard/events/${eventId}?tab=recap`);
      await expect(page.getByRole("heading", { name: /send-to-everyone page/i })).toBeVisible();
      await expect(page.getByRole("link", { name: "Preview recap" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Share recap" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Copy recap link" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Download photos" })).toBeVisible();
      await expect(page.locator("body")).toContainText("Before you send it");
    } finally {
      await request.patch(`${apiUrl}/api/host/events/${eventId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        data: originalSettings,
      });
    }

    await page.goto(`/dashboard/events/${eventId}?tab=settings`);
    await expect(page.getByRole("heading", { name: /Something off during the event/i })).toBeVisible();
    await page.getByRole("button", { name: /Report issue/i }).click();
    await expect(page.getByPlaceholder(/What happened/i)).toBeVisible();
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
      data: { email: demoHostEmail, password: demoHostPassword },
    });
    test.skip(!login.ok(), "Demo host login failed, so the upload smoke cannot clean up after itself.");
    const auth = await login.json();

    await page.goto(`/e/${revealedSeededSlug}`);
    await expect(page.locator("body")).toContainText("No account needed");
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
