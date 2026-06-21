require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/prisma");

const DEV_HOST_EMAIL = process.env.DEV_HOST_EMAIL || "neoskizzy@gmail.com";
const DEV_HOST_PASSWORD = process.env.DEV_HOST_PASSWORD || "EventFilm123!";
const VERIFY_API_URL = process.env.AUTH_SMOKE_API_URL || process.env.DEV_HOST_API_URL || "";

function assertDevOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a dev host in production.");
  }
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

async function requestJson(baseUrl, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(`${options.method || "GET"} ${path} returned ${response.status}: ${data?.error || response.statusText}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyLogin(apiUrl) {
  const login = await requestJson(apiUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEV_HOST_EMAIL, password: DEV_HOST_PASSWORD }),
  });
  if (!login?.token || login?.user?.email !== DEV_HOST_EMAIL) {
    throw new Error("Dev host login verification did not return the expected user.");
  }
}

async function main() {
  assertDevOnly();

  const passwordHash = await bcrypt.hash(DEV_HOST_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: DEV_HOST_EMAIL },
    update: { passwordHash },
    create: { email: DEV_HOST_EMAIL, passwordHash },
  });

  const apiUrl = normalizeBaseUrl(VERIFY_API_URL);
  if (apiUrl) await verifyLogin(apiUrl);

  console.log(JSON.stringify({
    email: DEV_HOST_EMAIL,
    password: DEV_HOST_PASSWORD,
    verifiedThroughApi: Boolean(apiUrl),
    note: "Development-only host account reset. Do not use this as a production credential.",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
