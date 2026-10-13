-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bazaarAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_bazaarAccountId_key" ON "users"("bazaarAccountId");
