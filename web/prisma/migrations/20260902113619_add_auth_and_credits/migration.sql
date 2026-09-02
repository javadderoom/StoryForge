-- AlterTable
ALTER TABLE "playthrough_sessions" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'READER',
    "creditBalance" INTEGER NOT NULL DEFAULT 15,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credit_ledgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_credit_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bazaar_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "amountPaidRial" INTEGER NOT NULL DEFAULT 0,
    "creditsAwarded" INTEGER NOT NULL,
    "rawResponse" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bazaar_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE INDEX "user_credit_ledgers_userId_createdAt_idx" ON "user_credit_ledgers"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bazaar_purchases_token_key" ON "bazaar_purchases"("token");

-- CreateIndex
CREATE INDEX "bazaar_purchases_userId_sku_idx" ON "bazaar_purchases"("userId", "sku");

-- CreateIndex
CREATE INDEX "playthrough_sessions_userId_idx" ON "playthrough_sessions"("userId");

-- AddForeignKey
ALTER TABLE "user_credit_ledgers" ADD CONSTRAINT "user_credit_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bazaar_purchases" ADD CONSTRAINT "bazaar_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Clean legacy non-foreign-key userIds from playthrough_sessions
UPDATE "playthrough_sessions" SET "userId" = NULL WHERE "userId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "playthrough_sessions" ADD CONSTRAINT "playthrough_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
