-- CreateEnum
CREATE TYPE "TreasuryKind" AS ENUM ('selic', 'prefixado', 'prefixado_semiannual', 'ipca', 'ipca_semiannual', 'igpm_semiannual', 'renda_mais', 'educa_mais');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "maturity_date" TIMESTAMP(3),
ADD COLUMN     "treasury_kind" "TreasuryKind";
