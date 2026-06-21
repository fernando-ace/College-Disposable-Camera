const API_URL = process.env.AUTH_SMOKE_API_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";
const UNREACHABLE_API_URL = process.env.AUTH_SMOKE_UNREACHABLE_API_URL || "http://127.0.0.1:9";
const HOST_EMAIL = process.env.DEV_HOST_EMAIL || "neoskizzy@gmail.com";
const HOST_PASSWORD = process.env.DEV_HOST_PASSWORD || "EventFilm123!";

function normalizeBaseUrl(value, name) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error(`${name} is required.`);
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function classifyFetchError(error) {
  if (error?.name === "AbortError") return "Request timed out";
  return "Could not reach API";
}

async function requestJson(baseUrl, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    return { response, data };
  } catch (error) {
    throw new Error(classifyFetchError(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function expectOk(baseUrl, path, options = {}) {
  const result = await requestJson(baseUrl, path, options);
  if (!result.response.ok) {
    throw new Error(`${options.method || "GET"} ${path} returned ${result.response.status}: ${result.data?.error || result.response.statusText}`);
  }
  return result.data;
}

async function expectStatus(baseUrl, path, expectedStatus, options = {}) {
  const result = await requestJson(baseUrl, path, options);
  if (result.response.status !== expectedStatus) {
    throw new Error(`${options.method || "GET"} ${path} returned ${result.response.status}; expected ${expectedStatus}.`);
  }
  return result.data;
}

async function main() {
  const apiUrl = normalizeBaseUrl(API_URL, "AUTH_SMOKE_API_URL");
  const unreachableApiUrl = normalizeBaseUrl(UNREACHABLE_API_URL, "AUTH_SMOKE_UNREACHABLE_API_URL");

  console.log(`Running auth smoke against ${apiUrl}`);

  console.log("\n== API health ==");
  const health = await expectOk(apiUrl, "/api/health");
  console.log(`ok=${health?.ok === true} databaseTarget=${health?.environment?.databaseTarget || "unknown"}`);

  console.log("\n== Valid login ==");
  const login = await expectOk(apiUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: HOST_EMAIL, password: HOST_PASSWORD }),
  });
  if (!login?.token || login?.user?.email !== HOST_EMAIL) throw new Error("Login response did not include the expected dev host.");
  console.log(`signedIn=${login.user.email}`);

  console.log("\n== Invalid password ==");
  const invalid = await expectStatus(apiUrl, "/api/auth/login", 401, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: HOST_EMAIL, password: `${HOST_PASSWORD}-wrong` }),
  });
  console.log(`error=${invalid?.error || "Invalid email or password"}`);

  console.log("\n== Unreachable API classification ==");
  try {
    await requestJson(unreachableApiUrl, "/api/health", { timeoutMs: 1200 });
    throw new Error(`Unexpectedly reached ${unreachableApiUrl}`);
  } catch (error) {
    if (!["Could not reach API", "Request timed out"].includes(error.message)) throw error;
    console.log(error.message);
  }

  console.log("\nAuth smoke passed.");
}

main().catch((error) => {
  console.error("\nAuth smoke failed.");
  console.error(error.message);
  console.error("Run the API first, then set AUTH_SMOKE_API_URL to the API base URL if it is not http://localhost:4000.");
  process.exitCode = 1;
});
