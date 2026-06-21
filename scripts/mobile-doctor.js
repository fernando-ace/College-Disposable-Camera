const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const mobileEnvPath = path.join(repoRoot, "apps", "mobile", ".env");
const mobileEnvLocalPath = path.join(repoRoot, "apps", "mobile", ".env.local");
const fallbackApiUrl = "http://localhost:4000";

function isPrivateIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return parts[0] === 192 && parts[1] === 168;
}

function isVirtualInterface(name) {
  return /wsl|hyper-v|vethernet|virtual|vmware|virtualbox|docker|loopback|bluetooth/i.test(name);
}

function scoreCandidate(candidate) {
  let score = 0;
  if (isPrivateIpv4(candidate.address)) score += 50;
  if (/wi-?fi|wireless/i.test(candidate.name)) score += 35;
  if (/ethernet|local area/i.test(candidate.name)) score += 20;
  if (candidate.address.startsWith("192.168.")) score += 12;
  if (candidate.address.startsWith("10.")) score += 8;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(candidate.address)) score += 4;
  if (isVirtualInterface(candidate.name)) score -= 100;
  return score;
}

function detectLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (entry.address.startsWith("127.") || entry.address.startsWith("169.254.")) continue;
      if (!isPrivateIpv4(entry.address)) continue;
      candidates.push({
        address: entry.address,
        name,
        score: scoreCandidate({ address: entry.address, name }),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
}

function readPublicEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    if (!match[1].startsWith("EXPO_PUBLIC_")) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

async function checkHealth(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${normalized}/api/health`, { signal: controller.signal });
    const ok = response.ok;
    return {
      ok,
      message: ok ? `ok (${Date.now() - startedAt}ms)` : `HTTP ${response.status}`,
    };
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "timed out" : "unreachable";
    return { ok: false, message: reason };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const candidates = detectLanIpv4Addresses();
  const env = readPublicEnv(mobileEnvPath);
  const envLocal = readPublicEnv(mobileEnvLocalPath);
  const detectedUrl = candidates[0] ? `http://${candidates[0].address}:4000` : "";
  const selectedUrl = envLocal.EXPO_PUBLIC_API_URL || env.EXPO_PUBLIC_API_URL || detectedUrl || fallbackApiUrl;
  const localhostUrl = "http://localhost:4000";

  console.log("EventFilm mobile doctor");
  console.log("");
  console.log("Detected private LAN IPv4 addresses:");
  if (candidates.length === 0) {
    console.log("- none");
  } else {
    for (const candidate of candidates) {
      const selected = candidate.address === candidates[0].address ? " selected" : "";
      console.log(`- ${candidate.address} (${candidate.name})${selected}`);
    }
  }

  console.log("");
  console.log("Mobile env:");
  console.log(`- apps/mobile/.env.local API URL: ${envLocal.EXPO_PUBLIC_API_URL || "missing"}`);
  console.log(`- apps/mobile/.env API URL: ${env.EXPO_PUBLIC_API_URL || "missing"}`);
  console.log(`- Expo will likely use: ${selectedUrl}`);
  console.log("  Note: shell env can override files; restart with --clear after changing Expo public env.");

  console.log("");
  console.log("API health:");
  const localhostHealth = await checkHealth(localhostUrl);
  console.log(`- localhost (${localhostUrl}): ${localhostHealth.message}`);
  const selectedHealth = await checkHealth(selectedUrl);
  console.log(`- selected LAN (${selectedUrl}): ${selectedHealth.message}`);

  if (!localhostHealth.ok || !selectedHealth.ok) {
    console.log("");
    console.log("If the API is not running, start it with npm run dev:api.");
    console.log("If localhost works but LAN fails, confirm the phone and laptop are on the same Wi-Fi and Windows Firewall allows Node.js on port 4000.");
  }

  console.log("");
  console.log("Next:");
  console.log("1. npm run mobile:env:lan");
  console.log("2. npm run mobile:start:clear");
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
