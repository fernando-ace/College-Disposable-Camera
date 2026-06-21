const assert = require("node:assert/strict");
const test = require("node:test");
const { createConfig } = require("./config");

const productionBaseEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@example.com:5432/eventfilm",
  JWT_SECRET: "a-production-jwt-secret-that-is-long",
  ANALYTICS_SALT: "a-production-analytics-salt-long",
  WEB_PUBLIC_URL: "https://eventfilm.example.com",
  API_PUBLIC_URL: "https://api.eventfilm.example.com",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-placeholder",
  SUPABASE_STORAGE_BUCKET: "event-photos",
};

function expectProductionError(overrides, pattern) {
  assert.throws(() => createConfig({ ...productionBaseEnv, ...overrides }), pattern);
}

test("accepts production config with public URL aliases and CORS origins", () => {
  const config = createConfig({
    ...productionBaseEnv,
    CLIENT_ORIGINS: "https://preview.eventfilm.example.com,https://hosts.eventfilm.example.com",
  });

  assert.equal(config.clientUrl, "https://eventfilm.example.com");
  assert.equal(config.serverUrl, "https://api.eventfilm.example.com");
  assert.deepEqual(config.clientOrigins, [
    "https://eventfilm.example.com",
    "https://preview.eventfilm.example.com",
    "https://hosts.eventfilm.example.com",
  ]);
});

test("keeps legacy CLIENT_URL and SERVER_URL names working", () => {
  const config = createConfig({
    ...productionBaseEnv,
    WEB_PUBLIC_URL: "",
    API_PUBLIC_URL: "",
    CLIENT_URL: "https://legacy-web.eventfilm.example.com",
    SERVER_URL: "https://legacy-api.eventfilm.example.com",
  });

  assert.equal(config.clientUrl, "https://legacy-web.eventfilm.example.com");
  assert.equal(config.serverUrl, "https://legacy-api.eventfilm.example.com");
});

test("fails production config without database, storage, or strong secrets", () => {
  expectProductionError({ DATABASE_URL: "" }, /DATABASE_URL is required in production/);
  expectProductionError({ SUPABASE_URL: "" }, /SUPABASE_URL is required in production/);
  expectProductionError({ SUPABASE_SERVICE_ROLE_KEY: "" }, /SUPABASE_SERVICE_ROLE_KEY is required in production/);
  expectProductionError({ JWT_SECRET: "dev-change-me" }, /JWT_SECRET must be changed before production/);
  expectProductionError({ JWT_SECRET: "too-short" }, /JWT_SECRET must be at least 24 characters in production/);
  expectProductionError({ ANALYTICS_SALT: "" }, /ANALYTICS_SALT is required in production/);
});

test("fails production config for localhost, http, wildcard, and invalid URLs", () => {
  expectProductionError({ WEB_PUBLIC_URL: "http://localhost:5173" }, /WEB_PUBLIC_URL must not point at localhost in production/);
  expectProductionError({ API_PUBLIC_URL: "http://api.eventfilm.example.com" }, /API_PUBLIC_URL must use HTTPS in production/);
  expectProductionError({ CLIENT_ORIGINS: "*" }, /CLIENT_ORIGINS must not include wildcard origins/);
  expectProductionError({ WEB_PUBLIC_URL: "https://exa mple.com" }, /WEB_PUBLIC_URL must be a valid URL/);
});
