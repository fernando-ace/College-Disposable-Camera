require("dotenv").config();

const isProduction = process.env.NODE_ENV === "production";

function normalizeBaseUrl(value, name) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error(`${name} is required`);
  const trimmed = raw.replace(/\/+$/, "");
  const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;

  try {
    new URL(normalized);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  return normalized;
}

function requireEnv(name, fallback) {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  if (!isProduction && fallback !== undefined) return fallback;
  throw new Error(`${name} is required${isProduction ? " in production" : ""}`);
}

function requireSecret(name, fallback) {
  const value = requireEnv(name, fallback);
  if (isProduction && value === fallback) {
    throw new Error(`${name} must be changed before production`);
  }
  if (isProduction && value.length < 24) {
    throw new Error(`${name} must be at least 24 characters in production`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 10);
if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb <= 0) {
  throw new Error("MAX_FILE_SIZE_MB must be a positive number");
}

if (isProduction) requireEnv("DATABASE_URL");
const jwtSecret = requireSecret("JWT_SECRET", "dev-change-me");

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  jwtSecret,
  analyticsSalt: optionalEnv("ANALYTICS_SALT") || jwtSecret,
  clientUrl: normalizeBaseUrl(requireEnv("CLIENT_URL", "http://localhost:5173"), "CLIENT_URL"),
  serverUrl: normalizeBaseUrl(requireEnv("SERVER_URL", "http://localhost:4000"), "SERVER_URL"),
  maxFileSizeMb,
  maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
  supabaseUrl: requireEnv("SUPABASE_URL", ""),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
  supabaseStorageBucket: requireEnv("SUPABASE_STORAGE_BUCKET", "event-photos"),
};
