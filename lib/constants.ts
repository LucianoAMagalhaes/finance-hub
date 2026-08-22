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
