const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { createClient } = require("@supabase/supabase-js");
const { supabaseUrl, supabaseServiceRoleKey, supabaseStorageBucket } = require("./config");

let supabaseClient;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase Storage is not configured");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseClient;
}

function bucket() {
  return getSupabaseClient().storage.from(supabaseStorageBucket);
}

function createStoredFilename(originalFilename) {
  const ext = path.extname(originalFilename || "").toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${ext}`;
}

function createPhotoObjectKey(eventId, originalFilename) {
  return `${eventId}/${createStoredFilename(originalFilename)}`;
}

function getPhotoUrl(photoId) {
  return `/api/photos/${photoId}/file`;
}

async function uploadPhotoObject({ objectKey, buffer, mimeType }) {
  const { error } = await bucket().upload(objectKey, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Could not upload photo: ${error.message}`);
  }
}

async function removePhotoObject(objectKey) {
  const { error } = await bucket().remove([objectKey]);
  if (error) {
    throw new Error(`Could not remove photo: ${error.message}`);
  }
}

async function downloadPhotoObject(objectKey) {
  const { data, error } = await bucket().download(objectKey);
  if (error) {
    throw new Error(`Could not download photo: ${error.message}`);
  }

  return data;
}

async function createPhotoReadStream(objectKey) {
  const file = await downloadPhotoObject(objectKey);
  return Readable.fromWeb(file.stream());
}

module.exports = {
  createStoredFilename,
  createPhotoObjectKey,
  getPhotoUrl,
  uploadPhotoObject,
  removePhotoObject,
  downloadPhotoObject,
  createPhotoReadStream,
};
