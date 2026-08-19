-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "genres" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'fa',
    "coverImageUrl" TEXT,
    "author" TEXT NOT NULL DEFAULT 'StoryForge',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_bibles" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "worldName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "themeNotes" TEXT NOT NULL,
    "laws" JSONB NOT NULL DEFAULT '[]',
    "factions" JSONB NOT NULL DEFAULT '[]',
    "locations" JSONB NOT NULL DEFAULT '[]',
    "npcs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_bibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpg_systems" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "hasCombat" BOOLEAN NOT NULL DEFAULT true,
    "diceType" TEXT NOT NULL DEFAULT 'd20',
    "inventoryCapacity" INTEGER NOT NULL DEFAULT 10,
    "stats" JSONB NOT NULL DEFAULT '[]',
    "resources" JSONB NOT NULL DEFAULT '[]',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "startingInventory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rpg_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playthrough_sessions" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'guest_user',
    "storyId" TEXT NOT NULL,
    "currentSceneId" TEXT NOT NULL,
    "turnCount" INTEGER NOT NULL DEFAULT 1,
    "playerState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playthrough_sessions_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "turn_history" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "sceneId" TEXT NOT NULL,
    "playerActionText" TEXT NOT NULL,
    "actionStyle" TEXT NOT NULL DEFAULT 'free_text',
    "narrativeProse" TEXT NOT NULL,
    "presentedChoices" JSONB NOT NULL DEFAULT '[]',
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'player',
    "importance" INTEGER NOT NULL DEFAULT 5,
    "summary" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "world_bibles_storyId_key" ON "world_bibles"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "rpg_systems_storyId_key" ON "rpg_systems"("storyId");

-- CreateIndex
CREATE INDEX "turn_history_sessionId_turnNumber_idx" ON "turn_history"("sessionId", "turnNumber");

-- CreateIndex
CREATE INDEX "memory_logs_sessionId_importance_idx" ON "memory_logs"("sessionId", "importance");

-- AddForeignKey
ALTER TABLE "world_bibles" ADD CONSTRAINT "world_bibles_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpg_systems" ADD CONSTRAINT "rpg_systems_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playthrough_sessions" ADD CONSTRAINT "playthrough_sessions_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_history" ADD CONSTRAINT "turn_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "playthrough_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_logs" ADD CONSTRAINT "memory_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "playthrough_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;
