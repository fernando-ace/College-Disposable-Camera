const { removePhotoObject } = require("./storage");

function isMissingStorageObjectError(error) {
  const statusCode = Number(error?.statusCode || error?.status);
  if (statusCode === 404) return true;
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "not_found" || code === "no_such_key" || /not found|does not exist|no such file|resource missing/.test(message);
}

async function deletePhotoWithStorage(prisma, photo) {
  if (!photo?.id) throw new Error("Photo id is required");
  if (photo.filePath) {
    try {
      await removePhotoObject(photo.filePath);
    } catch (error) {
      if (!isMissingStorageObjectError(error)) throw error;
    }
  }

  await prisma.photo.delete({
    where: { id: photo.id },
  });
}

module.exports = {
  deletePhotoWithStorage,
  isMissingStorageObjectError,
};
