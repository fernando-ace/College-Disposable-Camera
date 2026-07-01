const { PrismaClient } = require("@prisma/client");
const { deletePhotoWithStorage } = require("../src/photo-delete");

const prisma = new PrismaClient();

async function hasVisibilityColumn() {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'Photo'
        AND column_name = 'visibilityStatus'
    ) AS "exists"
  `;
  return Boolean(rows?.[0]?.exists);
}

async function main() {
  if (!(await hasVisibilityColumn())) {
    console.log("Photo visibility columns are already removed. No hidden-photo cleanup needed.");
    return;
  }

  const hiddenPhotos = await prisma.$queryRaw`
    SELECT "id", "filePath"
    FROM "Photo"
    WHERE "deletedAt" IS NULL
      AND "visibilityStatus" = 'HIDDEN'
    ORDER BY "createdAt" ASC
  `;

  if (!hiddenPhotos.length) {
    console.log("No active hidden photos found.");
    return;
  }

  let deleted = 0;
  for (const photo of hiddenPhotos) {
    await deletePhotoWithStorage(prisma, photo);
    deleted += 1;
  }

  console.log(`Deleted ${deleted} hidden ${deleted === 1 ? "photo" : "photos"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
