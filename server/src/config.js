require("dotenv").config();

const DEV_JWT_SECRET = "dev-change-me";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isProductionEnv(env) {
  return env.NODE_ENV === "production";
}

function normalizeBaseUrl(value, name, { production = false, allowLocalhostInProduction = false } = {}) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${name} is required`);
  const trimmed = raw.replace(/\/+$/, "");
  const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (production && !allowLocalhostInProduction && LOCAL_HOSTNAMES.has(parsed.hostname)) {
    throw new Error(`${name} must not point at localhost in production`);
  }
  if (production && !allowLocalhostInProduction && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }

  return normalized;
}

function readFirstEnv(env, names) {
  for (const name of names) {
    const value = env[name];
    if (value && value.trim()) return { name, value: value.trim() };
  }
  return { name: names[0], value: undefined };
}

function requireEnv(env, names, fallback) {
  const nameList = Array.isArray(names) ? names : [names];
  const { name, value } = readFirstEnv(env, nameList);
  if (value && value.trim()) return value.trim();
  if (!isProductionEnv(env) && fallback !== undefined) return fallback;
  throw new Error(`${name} is required${isProductionEnv(env) ? " in production" : ""}`);
}

function requireSecret(env, name, fallback) {
  const value = requireEnv(env, name, fallback);
  if (isProductionEnv(env) && value === fallback) {
    throw new Error(`${name} must be changed before production`);
  }
  if (isProductionEnv(env) && value.length < 24) {
    throw new Error(`${name} must be at least 24 characters in production`);
  }
  return value;
}

function optionalEnv(env, name) {
  const value = env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function parseClientOrigins(env, primaryClientUrl, production) {
  const values = [
    primaryClientUrl,
    optionalEnv(env, "CLIENT_ORIGIN"),
    ...(optionalEnv(env, "CLIENT_ORIGINS") || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ].filter(Boolean);

  const origins = values.map((origin, index) => {
    if (origin === "*") throw new Error("CLIENT_ORIGINS must not include wildcard origins");
    return normalizeBaseUrl(origin, index === 0 ? "WEB_PUBLIC_URL" : "CLIENT_ORIGINS", { production });
  });

  return [...new Set(origins)];
}

function createConfig(env = process.env) {
  const isProduction = isProductionEnv(env);
  const maxFileSizeMb = Number(env.MAX_FILE_SIZE_MB || 10);
  if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb <= 0) {
    throw new Error("MAX_FILE_SIZE_MB must be a positive number");
  }

  if (isProduction) requireEnv(env, "DATABASE_URL");
  const jwtSecret = requireSecret(env, "JWT_SECRET", DEV_JWT_SECRET);
  const analyticsSalt = isProduction
    ? requireSecret(env, "ANALYTICS_SALT")
    : optionalEnv(env, "ANALYTICS_SALT") || jwtSecret;
  const clientUrl = normalizeBaseUrl(requireEnv(env, ["CLIENT_URL", "WEB_PUBLIC_URL"], "http://localhost:5173"), "WEB_PUBLIC_URL", { production: isProduction });
  const serverUrl = normalizeBaseUrl(requireEnv(env, ["SERVER_URL", "API_PUBLIC_URL"], "http://localhost:4000"), "API_PUBLIC_URL", { production: isProduction });
  const clientOrigins = parseClientOrigins(env, clientUrl, isProduction);

  return {
    port: Number(env.PORT || 4000),
    nodeEnv: env.NODE_ENV || "development",
    isProduction,
    jwtSecret,
    analyticsSalt,
    clientUrl,
    webPublicUrl: clientUrl,
    serverUrl,
    apiPublicUrl: serverUrl,
    clientOrigins,
    maxFileSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    supabaseUrl: requireEnv(env, "SUPABASE_URL", ""),
    supabaseServiceRoleKey: requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY", ""),
    supabaseStorageBucket: requireEnv(env, "SUPABASE_STORAGE_BUCKET", "event-photos"),
  };
}

module.exports = {
  ...createConfig(),
  createConfig,
};
