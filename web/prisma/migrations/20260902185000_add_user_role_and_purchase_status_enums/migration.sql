-- CreateEnum UserRole
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('READER', 'AUTHOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum PurchaseStatus
DO $$ BEGIN
    CREATE TYPE "PurchaseStatus" AS ENUM ('COMPLETED', 'PENDING', 'REFUNDED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable users
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'READER';

-- AlterTable bazaar_purchases
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" TYPE "PurchaseStatus" USING ("status"::text::"PurchaseStatus");
ALTER TABLE "bazaar_purchases" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
