-- AlterTable
ALTER TABLE "world_bibles" ADD COLUMN     "artifacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "bestiary" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "dramaBonds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ontology" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "religions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "timeline" JSONB NOT NULL DEFAULT '[]';
