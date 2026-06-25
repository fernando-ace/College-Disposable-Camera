const REQUIRED_API_ENV = "DEPLOYED_API_URL";
const OPTIONAL_WEB_ENV = "DEPLOYED_WEB_URL";
const OPTIONAL_SLUG_ENV = "DEPLOYED_SMOKE_EVENT_SLUG";
const HOST_EMAIL_ENV = "DEPLOYED_SMOKE_HOST_EMAIL";
const HOST_PASSWORD_ENV = "DEPLOYED_SMOKE_HOST_PASSWORD";

function normalizeBaseUrl(value, name) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error(`${name} is required for deployed smoke.`);
  const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  const parsed = new URL(normalized);
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    throw new Error(`${name} must point at deployed infrastructure, not localhost.`);
  }
  return normalized;
}

async function requestJson(baseUrl, path, options = {}) {
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
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (response.status !== status) {
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status}; expected ${status}. ${data?.error || ""}`.trim());
  }
  return data;
}

async function main() {
  const apiUrl = normalizeBaseUrl(process.env[REQUIRED_API_ENV], REQUIRED_API_ENV);
  const webUrl = process.env[OPTIONAL_WEB_ENV] ? normalizeBaseUrl(process.env[OPTIONAL_WEB_ENV], OPTIONAL_WEB_ENV) : null;
  const slug = String(process.env[OPTIONAL_SLUG_ENV] || "").trim();
  const hostEmail = String(process.env[HOST_EMAIL_ENV] || "").trim();
  const hostPassword = String(process.env[HOST_PASSWORD_ENV] || "").trim();

  console.log(`Running deployed API smoke against ${apiUrl}`);
  if (webUrl) console.log(`Deployed web URL: ${webUrl}`);
  console.log(`Seeded event slug: ${slug || "missing; public route checks will be skipped"}`);

  console.log("\n== API health ==");
  await requestJson(apiUrl, "/api/health");

  console.log("\n== Analytics write ==");
  const analytics = await requestJson(apiUrl, "/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "guest_joined_event",
      source: "api",
      path: "/deployed-smoke",
      eventSlug: slug || null,
      anonymousId: `deployed-smoke-${Date.now()}`,
      metadata: { route: "deployed-smoke" },
    }),
  });
  if (analytics.data?.ok !== true) throw new Error("Analytics write did not return ok: true.");

  if (hostEmail && hostPassword) {
    console.log("\n== Host-auth database route ==");
    const login = await requestJson(apiUrl, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: hostEmail, password: hostPassword }),
    });
    await requestJson(apiUrl, "/api/host/events", {
      headers: { Authorization: `Bearer ${login.data.token}` },
    });
  } else {
    console.log("\n== Host-auth database route ==");
    console.log(`Skipped: set ${HOST_EMAIL_ENV} and ${HOST_PASSWORD_ENV} for target-environment host route verification.`);
  }

  if (slug) {
    console.log("\n== Guest event route ==");
    await requestJson(apiUrl, `/api/events/${encodeURIComponent(slug)}`);

    console.log("\n== Guest upload route shell ==");
    await expectStatus(apiUrl, `/api/events/${encodeURIComponent(slug)}/photos`, 400, {
      method: "POST",
      body: new FormData(),
    });

    console.log("\n== Recap route ==");
    await requestJson(apiUrl, `/api/events/${encodeURIComponent(slug)}/recap`);
  } else {
    console.log("\n== Public event routes ==");
    console.log(`Skipped: set ${OPTIONAL_SLUG_ENV} to a seeded event slug in the deployed environment.`);
  }

  if (!hostEmail || !hostPassword || !slug) {
    console.log("\nDeployed API smoke completed with documented skips.");
    console.log("For a full deployed smoke, seed a safe target-environment event and set DEPLOYED_SMOKE_EVENT_SLUG plus DEPLOYED_SMOKE_HOST_EMAIL/PASSWORD.");
    return;
  }

  console.log("\nDeployed API smoke passed.");
}

main().catch((error) => {
  console.error("\nDeployed API smoke failed.");
  console.error(error.message);
  console.error("Required: DEPLOYED_API_URL. Optional for full coverage: DEPLOYED_WEB_URL, DEPLOYED_SMOKE_EVENT_SLUG, DEPLOYED_SMOKE_HOST_EMAIL, DEPLOYED_SMOKE_HOST_PASSWORD.");
  process.exitCode = 1;
});
