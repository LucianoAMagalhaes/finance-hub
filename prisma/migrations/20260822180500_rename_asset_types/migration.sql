-- Phase 2 (Investments): the asset TYPE list the user actually wants.
--
-- Was: stock | fii | etf | bdr | fixed_income | crypto.
-- Now: stock_br | stock_intl | fii | crypto | fixed_income — shown as
-- "Ação Nacional", "Ação Internacional", "FII", "Cripto" e "Renda Fixa".
--
-- Written by hand instead of letting Prisma generate it, because Prisma's
-- version of an enum change assumes no row uses the values being removed. This
-- one MIGRATES the existing rows instead of failing on them:
--   * stock -> stock_br   (a Brazilian broker's "ação" is a national one)
--   * bdr   -> stock_intl (a BDR is a foreign company traded here)
--   * etf   -> stock_intl (the only ETFs in this portfolio were foreign)
-- Nothing is deleted: every asset keeps its row, its history and its quote.

-- Postgres cannot remove values from an enum in place, so the type is rebuilt:
-- rename the old one out of the way, create the new one, convert the column
-- with the mapping above, then drop the leftover type (a type, not data).
ALTER TYPE "AssetType" RENAME TO "AssetType_old";

CREATE TYPE "AssetType" AS ENUM ('stock_br', 'stock_intl', 'fii', 'crypto', 'fixed_income');

ALTER TABLE "assets"
  ALTER COLUMN "type" TYPE "AssetType"
  USING (
    CASE "type"::text
      WHEN 'stock' THEN 'stock_br'
      WHEN 'bdr' THEN 'stock_intl'
      WHEN 'etf' THEN 'stock_intl'
      ELSE "type"::text
    END::"AssetType"
  );

DROP TYPE "AssetType_old";
