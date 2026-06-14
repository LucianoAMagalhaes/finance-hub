-- Add bank accounts and make every transaction belong to one.
--
-- The account_id column is required, but the table already has rows, so we use
-- an expand → backfill → contract sequence:
--   1) create bank_accounts;
--   2) add account_id as NULLABLE;
--   3) give each user a default "Conta principal" and point its transactions at
--      it (deterministic id 'acct_' || user_id so it's reproducible);
--   4) enforce NOT NULL and add the foreign key.

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initial_balance" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (accounts → users)
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add account_id as nullable first so the backfill can run.
ALTER TABLE "transactions" ADD COLUMN "account_id" TEXT;

-- Backfill: one default account per user, then assign every existing transaction.
INSERT INTO "bank_accounts" ("id", "name", "initial_balance", "user_id", "created_at")
SELECT 'acct_' || "id", 'Conta principal', 0, "id", CURRENT_TIMESTAMP FROM "users";

UPDATE "transactions" SET "account_id" = 'acct_' || "user_id" WHERE "account_id" IS NULL;

-- Contract: now that every row has a value, enforce NOT NULL + the foreign key.
ALTER TABLE "transactions" ALTER COLUMN "account_id" SET NOT NULL;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
