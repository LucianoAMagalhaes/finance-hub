// Shared domain constants and their Brazilian-Portuguese UI labels.
//
// Role in the architecture: a single source of truth for the enum-like values
// that must match the Prisma schema (TransactionType, PaymentMethod). We define
// them here as plain string unions instead of importing the Prisma enums so the
// values can be used safely in Client Components without bundling Prisma.

// Keep these arrays in sync with the enums in prisma/schema.prisma.
export const TRANSACTION_TYPES = ['income', 'expense'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const PAYMENT_METHODS = [
  'cash',
  'debit',
  'credit',
  'pix',
  'transfer',
  'boleto',
  'direct_debit',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// User-facing labels (the DB stores the English value; the UI shows these).
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit: 'Cartão de Débito',
  credit: 'Cartão de Crédito',
  pix: 'Pix',
  transfer: 'Transferência',
  boleto: 'Boleto',
  direct_debit: 'Débito Automático',
}

// A fixed color per payment method, used by the dashboard "expenses by payment
// method" bars (payment methods have no user-set color, unlike tags).
export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: '#22c55e',
  debit: '#3b82f6',
  credit: '#ef4444',
  pix: '#14b8a6',
  transfer: '#a855f7',
  boleto: '#f59e0b',
  direct_debit: '#eab308',
}

// --- Phase 2 — Investments -------------------------------------------------
// Same idea as above: these mirror the Prisma enums AssetType and
// AssetOperationType, redeclared here so Client Components can use them
// without bundling Prisma. Keep them in sync with prisma/schema.prisma.

// The asset types the user actually tracks. Order matters: it is the order of
// the dropdown, of the pie chart legend and of any list that groups by type.
export const ASSET_TYPES = [
  'stock_br',
  'stock_intl',
  'fii',
  'crypto',
  'fixed_income',
] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const ASSET_OPERATION_TYPES = ['buy', 'sell'] as const
export type AssetOperationType = (typeof ASSET_OPERATION_TYPES)[number]

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock_br: 'Ação Nacional',
  stock_intl: 'Ação Internacional',
  fii: 'FII',
  crypto: 'Cripto',
  fixed_income: 'Renda Fixa',
}

export const ASSET_OPERATION_TYPE_LABELS: Record<AssetOperationType, string> = {
  buy: 'Compra',
  sell: 'Venda',
}

// A fixed color per asset class, used by the class chips and (later) by the
// allocation donut. Recharts needs a hex, not a Tailwind class, so these live
// here — same precedent as PAYMENT_METHOD_COLORS.
//
// Deliberately NO jade and NO red: in this app those two already mean profit
// and loss, so using them as a category color would make the donut ambiguous.
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  stock_br: '#5BA3F5', // cofre blue
  stock_intl: '#A78BFA',
  fii: '#2DD4BF',
  crypto: '#F472B6',
  fixed_income: '#94A3B8',
}

// --- Phase 2 — Asset scoring ------------------------------------------------
// Mirrors the ScoreScope enum in prisma/schema.prisma. A checklist belongs to a
// scope, and an asset's TYPE decides which scope grades it (see scoreScopeFor
// in lib/scoring.ts): stocks cover both stock_br and stock_intl, fiis covers
// fii, and crypto/fixed_income are graded by hand instead.
export const SCORE_SCOPES = ['stocks', 'fiis'] as const
export type ScoreScope = (typeof SCORE_SCOPES)[number]

export const SCORE_SCOPE_LABELS: Record<ScoreScope, string> = {
  stocks: 'Ações',
  fiis: 'FIIs',
}

// The hand-typed score (crypto, fixed income) uses the SAME range the checklist
// produces, so the "Nota" column means one thing across the whole table.
export const MANUAL_SCORE_MIN = -10
export const MANUAL_SCORE_MAX = 10

// --- Phase 2 — Tesouro Direto -----------------------------------------------
// Mirrors the TreasuryKind enum in prisma/schema.prisma. Only `fixed_income`
// assets carry one; every other type leaves the column null.
//
// Order matters: it is the order of the dropdown in the purchase form.
export const TREASURY_KINDS = [
  'selic',
  'prefixado',
  'prefixado_semiannual',
  'ipca',
  'ipca_semiannual',
  'igpm_semiannual',
  'renda_mais',
  'educa_mais',
] as const
export type TreasuryKind = (typeof TREASURY_KINDS)[number]

// The OFFICIAL name of each bond, spelled exactly as the Tesouro spells it.
//
// One map, not two, on purpose: this same string is both what the user reads
// (in the dropdown and in the generated asset name) and the key that finds the
// bond's daily price in the Tesouro Transparente file. A second "display" map
// would be free to drift away from the one the file is matched against, and a
// silent mismatch there means a bond that never gets a quote.
//
// Note the pairs that differ only by the suffix — "Tesouro IPCA+ 2035" and
// "Tesouro IPCA+ com Juros Semestrais 2035" are different bonds with different
// prices — which is why the suffix is part of the name and not a footnote.
export const TREASURY_KIND_NAMES: Record<TreasuryKind, string> = {
  selic: 'Tesouro Selic',
  prefixado: 'Tesouro Prefixado',
  prefixado_semiannual: 'Tesouro Prefixado com Juros Semestrais',
  ipca: 'Tesouro IPCA+',
  ipca_semiannual: 'Tesouro IPCA+ com Juros Semestrais',
  igpm_semiannual: 'Tesouro IGPM+ com Juros Semestrais',
  renda_mais: 'Tesouro Renda+ Aposentadoria Extra',
  educa_mais: 'Tesouro Educa+',
}

// The bonds that pay a coupon before maturity. The app does NOT track coupons
// received (same gap as dividends on stocks), so a position in one of these
// reads LOW: the cash already paid out is missing from it. The portfolio warns
// on these rows instead of quietly showing a wrong number.
export const TREASURY_KINDS_WITH_COUPONS: readonly TreasuryKind[] = [
  'prefixado_semiannual',
  'ipca_semiannual',
  'igpm_semiannual',
  'renda_mais',
]

// --- Moeda -------------------------------------------------------------------
// The currencies a purchase can be entered in.
//
// The database stays entirely in cents of BRL (ADR-005): a purchase made in
// dollars is converted ON THE WAY IN, at the exchange rate of the day it
// happened, and nothing downstream ever sees a foreign amount. See ADR-013.
//
// The list is deliberately short. Every currency added here is one the app
// promises it can convert correctly, and getting that wrong is a factor-of-100
// class of bug (see SUPPORTED_FX in lib/quotes.ts for the GBp trap).
export const PURCHASE_CURRENCIES = ['BRL', 'USD'] as const
export type PurchaseCurrency = (typeof PURCHASE_CURRENCIES)[number]

export const PURCHASE_CURRENCY_SYMBOLS: Record<PurchaseCurrency, string> = {
  BRL: 'R$',
  USD: 'US$',
}

/** The Yahoo symbol that prices one unit of a currency in reais. */
export const FX_SYMBOLS: Record<Exclude<PurchaseCurrency, 'BRL'>, string> = {
  USD: 'USDBRL=X',
}
