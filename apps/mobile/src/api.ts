import { createEventFilmApiClient } from "@eventfilm/api-client";

const fallbackLocalApiUrl = "http://localhost:4000";
const releaseChannels = new Set(["preview", "production"]);
const developmentReleaseChannel = "development";

function normalizeMobileApiUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("EXPO_PUBLIC_API_URL is required for EventFilm mobile.");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isPrivateLanApiUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    return parts[0] === 192 && parts[1] === 168;
  } catch {
    return false;
  }
}

export function getMobileApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL || fallbackLocalApiUrl;
  const normalizedUrl = normalizeMobileApiUrl(configuredUrl);
  const releaseChannel = getMobileReleaseChannel();

  if (releaseChannels.has(releaseChannel) && isLocalhostUrl(normalizedUrl)) {
    throw new Error("Set EXPO_PUBLIC_API_URL to the deployed API URL before making a beta or production mobile build.");
  }

  return normalizedUrl;
}

export function getMobileReleaseChannel() {
  return process.env.EXPO_PUBLIC_RELEASE_CHANNEL || developmentReleaseChannel;
}

export function shouldShowMobileApiDiagnostics() {
  return getMobileReleaseChannel() === developmentReleaseChannel;
}

export function getMobileApiDiagnosticHints() {
  const baseUrl = getMobileApiBaseUrl();
  const hints = [`Active API URL: ${baseUrl}`];

  if (isPrivateLanApiUrl(baseUrl)) {
    hints.push("Private LAN URL detected. Your phone and laptop must be on the same Wi-Fi.");
  } else if (isLocalhostUrl(baseUrl)) {
    hints.push("Localhost only works from the computer, not a physical phone running Expo Go.");
  }

  hints.push("If connection fails, run npm run mobile:env:lan.");
  hints.push("After changing env, restart with npm run mobile:start:clear.");

  return {
    baseUrl,
    isPrivateLan: isPrivateLanApiUrl(baseUrl),
    hints,
  };
}

export function createMobileApi(tokenProvider?: () => string | null | Promise<string | null>) {
  return createEventFilmApiClient({
    baseUrl: getMobileApiBaseUrl(),
    tokenProvider,
  });
}

export async function checkMobileApiConnection() {
  const client = createMobileApi();
  const startedAt = Date.now();
  const health = await client.checkHealth(5000);
  return {
    baseUrl: client.baseUrl,
    ok: health.ok === true,
    latencyMs: Date.now() - startedAt,
  };
}
