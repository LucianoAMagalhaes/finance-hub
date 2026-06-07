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
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// User-facing labels (the DB stores the English value; the UI shows these).
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit: 'Crédito',
  pix: 'Pix',
  transfer: 'Transferência',
  boleto: 'Boleto',
}
