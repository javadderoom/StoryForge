-- CreateTable
CREATE TABLE "narrator_model_tiers" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fallbackModel" TEXT,
    "endpoint" TEXT,
    "temperature" DOUBLE PRECISION,
    "reasoningEffort" TEXT,
    "thinkingBudgetTokens" INTEGER,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "narrator_model_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "narrator_model_tiers_tier_key" ON "narrator_model_tiers"("tier");
