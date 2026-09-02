-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('READER', 'AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('COMPLETED', 'PENDING', 'REFUNDED', 'FAILED');

-- AlterTable users
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'READER';

-- AlterTable bazaar_purchases
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" TYPE "PurchaseStatus" USING ("status"::text::"PurchaseStatus");
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
