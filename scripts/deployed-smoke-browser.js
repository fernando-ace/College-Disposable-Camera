const { spawnSync } = require("child_process");

function requiredUrl(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    console.error(`${name} is required for deployed browser smoke.`);
    console.error("Set DEPLOYED_WEB_URL and DEPLOYED_API_URL, or BROWSER_SMOKE_BASE_URL and BROWSER_SMOKE_API_URL, then rerun npm run smoke:deployed:browser.");
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

const webUrl = process.env.BROWSER_SMOKE_BASE_URL
  ? requiredUrl("BROWSER_SMOKE_BASE_URL")
  : requiredUrl("DEPLOYED_WEB_URL");
const apiUrl = process.env.BROWSER_SMOKE_API_URL
  ? requiredUrl("BROWSER_SMOKE_API_URL")
  : requiredUrl("DEPLOYED_API_URL");

const env = {
  ...process.env,
  EVENTFILM_WEB_URL: webUrl,
  EVENTFILM_API_URL: apiUrl,
};

if (process.env.DEPLOYED_SMOKE_EVENT_SLUG && !process.env.EVENTFILM_SMOKE_EVENT_SLUG) {
  env.EVENTFILM_SMOKE_EVENT_SLUG = process.env.DEPLOYED_SMOKE_EVENT_SLUG;
}

console.log(`Running deployed browser smoke against ${webUrl} with API ${apiUrl}`);
const result = spawnSync("npm", ["run", "smoke:browser"], { stdio: "inherit", shell: true, env });
process.exit(result.status || 0);
