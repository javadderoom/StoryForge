-- Shared World 1:N Stories: extract World as first-class entity.
-- Backfills one World per existing Story (zero data loss).

-- CreateTable worlds
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "themeNotes" TEXT NOT NULL DEFAULT '',
    "worldBibleVersion" INTEGER NOT NULL DEFAULT 1,
    "worldBibleHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- AlterTable stories: add worldId
ALTER TABLE "stories" ADD COLUMN "worldId" TEXT;
CREATE INDEX "stories_worldId_idx" ON "stories"("worldId");
ALTER TABLE "stories" ADD CONSTRAINT "stories_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable world_bibles: relax storyId, add worldId
ALTER TABLE "world_bibles" ALTER COLUMN "storyId" DROP NOT NULL;
ALTER TABLE "world_bibles" ADD COLUMN "worldId" TEXT;
CREATE UNIQUE INDEX "world_bibles_worldId_key" ON "world_bibles"("worldId");
ALTER TABLE "world_bibles" ADD CONSTRAINT "world_bibles_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable rpg_systems: relax storyId, add worldId
ALTER TABLE "rpg_systems" ALTER COLUMN "storyId" DROP NOT NULL;
ALTER TABLE "rpg_systems" ADD COLUMN "worldId" TEXT;
CREATE UNIQUE INDEX "rpg_systems_worldId_key" ON "rpg_systems"("worldId");
ALTER TABLE "rpg_systems" ADD CONSTRAINT "rpg_systems_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one World per Story that already has a WorldBible.
-- Worlds inherit name/summary/theme + version from the story manifest when present.
INSERT INTO "worlds" ("id", "name", "summary", "themeNotes", "worldBibleVersion", "worldBibleHistory", "createdAt", "updatedAt")
SELECT
    ('world_' || REPLACE(gen_random_uuid()::text, '-', '')) AS "id",
    COALESCE(wb."worldName", s."title") AS "name",
    COALESCE(wb."summary", '') AS "summary",
    COALESCE(wb."themeNotes", '') AS "themeNotes",
    COALESCE(CAST(s."manifest"->>'worldBibleVersion' AS INTEGER), 1) AS "worldBibleVersion",
    COALESCE(s."manifest"->'worldBibleHistory', '[]'::jsonb) AS "worldBibleHistory",
    s."createdAt" AS "createdAt",
    NOW() AS "updatedAt"
FROM "stories" s
JOIN "world_bibles" wb ON wb."storyId" = s."id"
WHERE NOT EXISTS (SELECT 1 FROM "worlds" w WHERE w."name" = COALESCE(wb."worldName", s."title"));

-- Link world_bibles -> worlds by matching worldName to the world just created.
UPDATE "world_bibles" AS wb
SET "worldId" = w."id"
FROM "worlds" AS w, "stories" AS s
WHERE wb."worldId" IS NULL
  AND s."id" = wb."storyId"
  AND w."name" = COALESCE(wb."worldName", s."title");

-- Link rpg_systems -> same world via their legacy storyId.
UPDATE "rpg_systems" AS r
SET "worldId" = wb."worldId"
FROM "world_bibles" AS wb
WHERE r."storyId" = wb."storyId"
  AND r."worldId" IS NULL
  AND wb."worldId" IS NOT NULL;

-- Link stories -> worlds via their bible.
UPDATE "stories" AS s
SET "worldId" = wb."worldId"
FROM "world_bibles" AS wb
WHERE wb."storyId" = s."id"
  AND s."worldId" IS NULL
  AND wb."worldId" IS NOT NULL;

-- Stories without any bible yet (fresh/empty): create an empty world each.
INSERT INTO "worlds" ("id", "name", "summary", "themeNotes", "worldBibleVersion", "worldBibleHistory", "createdAt", "updatedAt")
SELECT
    ('world_' || REPLACE(gen_random_uuid()::text, '-', '')),
    s."title",
    '',
    '',
    1,
    '[]'::jsonb,
    s."createdAt",
    NOW()
FROM "stories" s
WHERE s."worldId" IS NULL;

UPDATE "stories" s
SET "worldId" = w."id"
FROM "worlds" w
WHERE s."worldId" IS NULL AND w."name" = s."title";
