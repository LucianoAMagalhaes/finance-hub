-- CreateTable
CREATE TABLE "allocation_targets" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "target_percent" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "allocation_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allocation_targets_user_id_type_key" ON "allocation_targets"("user_id", "type");

-- AddForeignKey
ALTER TABLE "allocation_targets" ADD CONSTRAINT "allocation_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
