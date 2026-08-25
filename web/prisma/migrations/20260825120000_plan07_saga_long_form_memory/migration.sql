-- Plan 07: Massive Universe Long-Form Saga & Episodic Campaign Engine
-- Chapter tracking + Living World State Ledger on sessions,
-- chapter linkage on turns, and hierarchical memory fields on memory logs.

-- AlterTable
ALTER TABLE "playthrough_sessions" ADD COLUMN     "currentChapterId" TEXT,
ADD COLUMN     "sagaLedger" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "turn_history" ADD COLUMN     "chapterNumber" INTEGER;

-- AlterTable
ALTER TABLE "memory_logs" ADD COLUMN     "chapterNumber" INTEGER,
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "entityIds" TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN     "sceneId" TEXT,
ADD COLUMN     "tags" TEXT[] NOT NULL DEFAULT '{}';
