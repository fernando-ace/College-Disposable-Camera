import { createEventFilmApiClient } from "@eventfilm/api-client";

const fallbackLocalApiUrl = "http://localhost:4000";
const releaseChannels = new Set(["preview", "production"]);

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

export function getMobileApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL || fallbackLocalApiUrl;
  const normalizedUrl = normalizeMobileApiUrl(configuredUrl);
  const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL || "development";

  if (releaseChannels.has(releaseChannel) && isLocalhostUrl(normalizedUrl)) {
    throw new Error("Set EXPO_PUBLIC_API_URL to the deployed API URL before making a beta or production mobile build.");
  }

  return normalizedUrl;
}

export function createMobileApi(tokenProvider?: () => string | null | Promise<string | null>) {
  return createEventFilmApiClient({
    baseUrl: getMobileApiBaseUrl(),
    tokenProvider,
  });
}
