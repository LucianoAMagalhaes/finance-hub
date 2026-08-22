-- CreateEnum
CREATE TYPE "ScoreScope" AS ENUM ('stocks', 'fiis');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "manual_score" INTEGER;

-- CreateTable
CREATE TABLE "score_questions" (
    "id" TEXT NOT NULL,
    "scope" "ScoreScope" NOT NULL,
    "text" TEXT NOT NULL,
    "hint" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "score_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_answers" (
    "id" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,

    CONSTRAINT "score_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_questions_user_id_scope_position_idx" ON "score_questions"("user_id", "scope", "position");

-- CreateIndex
CREATE INDEX "score_answers_user_id_asset_id_idx" ON "score_answers"("user_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_answers_asset_id_question_id_key" ON "score_answers"("asset_id", "question_id");

-- AddForeignKey
ALTER TABLE "score_questions" ADD CONSTRAINT "score_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_answers" ADD CONSTRAINT "score_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_answers" ADD CONSTRAINT "score_answers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_answers" ADD CONSTRAINT "score_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "score_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
