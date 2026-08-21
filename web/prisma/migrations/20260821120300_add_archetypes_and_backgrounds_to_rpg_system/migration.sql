-- AlterTable
ALTER TABLE "rpg_systems" ADD COLUMN "archetypes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "backgrounds" JSONB NOT NULL DEFAULT '[]';
