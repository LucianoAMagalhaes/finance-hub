-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('stock', 'fii', 'etf', 'bdr', 'fixed_income', 'crypto');

-- CreateEnum
CREATE TYPE "AssetOperationType" AS ENUM ('buy', 'sell');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "current_price_cents" DECIMAL(20,6),
    "price_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_operations" (
    "id" TEXT NOT NULL,
    "type" "AssetOperationType" NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,

    CONSTRAINT "asset_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_user_id_ticker_key" ON "assets"("user_id", "ticker");

-- CreateIndex
CREATE INDEX "asset_operations_user_id_asset_id_idx" ON "asset_operations"("user_id", "asset_id");

-- CreateIndex
CREATE INDEX "asset_operations_asset_id_date_idx" ON "asset_operations"("asset_id", "date");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_operations" ADD CONSTRAINT "asset_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_operations" ADD CONSTRAINT "asset_operations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
