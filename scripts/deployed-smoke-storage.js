const { spawnSync } = require("child_process");

function requiredUrl(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    console.error("STORAGE_SMOKE_API_URL or DEPLOYED_API_URL is required for deployed storage smoke.");
    console.error("Set DEPLOYED_API_URL after seeding a safe target-environment smoke event, then rerun npm run smoke:deployed:storage.");
    process.exit(1);
  }
  const normalized = value.replace(/\/+$/, "");
  const parsed = new URL(normalized.startsWith("http://") || normalized.startsWith("https://") ? normalized : `https://${normalized}`);
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    console.error(`${name} must point at deployed infrastructure, not localhost.`);
    process.exit(1);
  }
  return parsed.toString().replace(/\/+$/, "");
}

const apiUrl = process.env.STORAGE_SMOKE_API_URL
  ? requiredUrl("STORAGE_SMOKE_API_URL")
  : requiredUrl("DEPLOYED_API_URL");

const env = {
  ...process.env,
  STORAGE_SMOKE_API_URL: apiUrl,
};

if (process.env.DEPLOYED_SMOKE_EVENT_SLUG && !process.env.STORAGE_SMOKE_EVENT_SLUG) {
  env.STORAGE_SMOKE_EVENT_SLUG = process.env.DEPLOYED_SMOKE_EVENT_SLUG;
}
if (process.env.DEPLOYED_SMOKE_HOST_EMAIL && !process.env.DEMO_HOST_EMAIL) {
  env.DEMO_HOST_EMAIL = process.env.DEPLOYED_SMOKE_HOST_EMAIL;
}
if (process.env.DEPLOYED_SMOKE_HOST_PASSWORD && !process.env.DEMO_HOST_PASSWORD) {
  env.DEMO_HOST_PASSWORD = process.env.DEPLOYED_SMOKE_HOST_PASSWORD;
}

console.log(`Running deployed storage smoke against ${apiUrl}`);
console.log("This uses the real guest upload path and cleanup. Confirm the target event is safe for smoke data.");
const result = spawnSync("npm", ["run", "smoke:storage"], { stdio: "inherit", shell: true, env });
process.exit(result.status || 0);
