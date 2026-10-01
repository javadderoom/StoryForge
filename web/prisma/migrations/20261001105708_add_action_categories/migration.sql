-- CreateTable
CREATE TABLE "action_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "worldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "action_categories_code_key" ON "action_categories"("code");

-- CreateIndex
CREATE INDEX "action_categories_domain_idx" ON "action_categories"("domain");

-- CreateIndex
CREATE INDEX "action_categories_worldId_idx" ON "action_categories"("worldId");

-- AddForeignKey
ALTER TABLE "action_categories" ADD CONSTRAINT "action_categories_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
