/*
  Warnings:

  - You are about to drop the column `subcategory_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `subcategories` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "subcategories" DROP CONSTRAINT "subcategories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_subcategory_id_fkey";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "subcategory_id";

-- DropTable
DROP TABLE "subcategories";
