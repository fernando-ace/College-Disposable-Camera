import { createEventFilmApiClient } from "@eventfilm/api-client";

const fallbackLocalApiUrl = "http://localhost:4000";

export function createMobileApi(tokenProvider?: () => string | null | Promise<string | null>) {
  return createEventFilmApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || fallbackLocalApiUrl,
    tokenProvider,
  });
}
