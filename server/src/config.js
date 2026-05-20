require("dotenv").config();

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

function normalizeBaseUrl(value) {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-change-me",
  clientUrl: normalizeBaseUrl(process.env.CLIENT_URL || "http://localhost:5173"),
  serverUrl: normalizeBaseUrl(process.env.SERVER_URL || "http://localhost:4000"),
  maxFileSizeMb,
  maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || "event-photos",
};
