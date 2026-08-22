-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "manifest" JSONB NOT NULL DEFAULT '{}';
