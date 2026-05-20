const path = require("path");
require("dotenv").config();

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "dev-change-me",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  serverUrl: process.env.SERVER_URL || "http://localhost:4000",
  uploadDir,
  maxFileSizeMb,
  maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
};
