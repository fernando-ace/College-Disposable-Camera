import { expect, test } from "@playwright/test";

const apiUrl = (process.env.EVENTFILM_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const seededSlug = process.env.EVENTFILM_SMOKE_EVENT_SLUG || "eventfilm-beta-demo-memory-capsule";

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
    await expect(page.getByRole("heading", { name: /Collect every moment/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create your first event/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /View demo/i })).toBeVisible();

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
    await expect(page.getByRole("button", { name: /Upload photo/i })).toBeVisible();

    await page.goto(`/wall/${seededSlug}`);
    await expect(page.locator("body")).toContainText(/Live Wall|EventFilm Beta Demo/i);

    await page.goto(`/recap/${seededSlug}`);
    await expect(page.locator("body")).toContainText(/Recap|EventFilm Beta Demo|locked/i);
  });
});
