import * as SecureStore from "expo-secure-store";

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getGuestClientId(slug: string) {
  const key = `eventfilm_guest_client_${slug}`;
  const saved = await SecureStore.getItemAsync(key);
  if (saved) return saved;

  const clientId = createClientId();
  await SecureStore.setItemAsync(key, clientId);
  return clientId;
}

export async function getGuestDisplayName(slug: string) {
  return (await SecureStore.getItemAsync(`eventfilm_guest_name_${slug}`)) || "";
}

export async function setGuestDisplayName(slug: string, displayName: string) {
  await SecureStore.setItemAsync(`eventfilm_guest_name_${slug}`, displayName);
}

export function slugFromInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const eventIndex = parts.indexOf("e");
    return eventIndex >= 0 ? parts[eventIndex + 1] || "" : parts[parts.length - 1] || "";
  } catch {
    return trimmed.replace(/^\/?e\//, "");
  }
}
