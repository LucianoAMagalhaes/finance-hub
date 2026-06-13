/*
  Warnings:

  - You are about to drop the `goals` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "goals" DROP CONSTRAINT "goals_user_id_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "target_percent" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "goals";
