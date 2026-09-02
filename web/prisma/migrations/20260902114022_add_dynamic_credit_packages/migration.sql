-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "credits" INTEGER NOT NULL,
    "priceToman" INTEGER NOT NULL,
    "priceRial" INTEGER NOT NULL DEFAULT 0,
    "originalPriceToman" INTEGER,
    "discountPercent" INTEGER DEFAULT 0,
    "badge" TEXT,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_packages_sku_key" ON "credit_packages"("sku");
