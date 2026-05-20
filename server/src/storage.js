const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { uploadDir } = require("./config");

async function ensureUploadDir() {
  await fs.promises.mkdir(uploadDir, { recursive: true });
}

function createStoredFilename(originalFilename) {
  const ext = path.extname(originalFilename || "").toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
}

function getPhotoUrl(photoId) {
  return `/api/photos/${photoId}/file`;
}

async function removeFileIfExists(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

module.exports = {
  ensureUploadDir,
  createStoredFilename,
  getPhotoUrl,
  removeFileIfExists,
  uploadDir,
};
