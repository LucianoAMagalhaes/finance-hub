// Transaction filtering logic.
//
// Role in the architecture: pure functions that translate the URL's query
// string into (1) a typed filter object and (2) a Prisma `where` clause. Keeping
// this out of the page component makes the rules unit-testable without a DB.

import type { Prisma } from '@prisma/client'
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type PaymentMethod,
  type TransactionType,
} from '@/lib/constants'

export type TransactionFilters = {
  type?: TransactionType
  categoryId?: string
  paymentMethod?: PaymentMethod
  from?: string // YYYY-MM-DD (inclusive)
  to?: string // YYYY-MM-DD (inclusive)
  q?: string // free-text search on description
}

// searchParams values can be string | string[] | undefined. Normalize to the
// first non-empty string, or undefined.
function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  const trimmed = v?.trim()
  return trimmed ? trimmed : undefined
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Builds a validated TransactionFilters from raw searchParams. Invalid values
 * (e.g. an unknown payment method, a malformed date) are dropped rather than
 * trusted, so a tampered URL can never inject bad query input.
 */
export function parseTransactionFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TransactionFilters {
  const filters: TransactionFilters = {}

  const type = first(searchParams.type)
  if (type && (TRANSACTION_TYPES as readonly string[]).includes(type)) {
    filters.type = type as TransactionType
  }

  const paymentMethod = first(searchParams.paymentMethod)
  if (paymentMethod && (PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
    filters.paymentMethod = paymentMethod as PaymentMethod
  }

  const categoryId = first(searchParams.categoryId)
  if (categoryId) filters.categoryId = categoryId

  const from = first(searchParams.from)
  if (from && DATE_RE.test(from)) filters.from = from

  const to = first(searchParams.to)
  if (to && DATE_RE.test(to)) filters.to = to

  const q = first(searchParams.q)
  if (q) filters.q = q

  return filters
}

/**
 * Translates filters into a Prisma `where` clause, always scoped to the owner.
 */
export function buildTransactionWhere(
  userId: string,
  filters: TransactionFilters,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId }

  if (filters.type) where.type = filters.type
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod
  if (filters.categoryId) where.categoryId = filters.categoryId

  // Date range: from = start of that day, to = end of that day, in UTC to match
  // how transaction dates are stored (UTC midnight).
  if (filters.from || filters.to) {
    where.date = {}
    if (filters.from) where.date.gte = new Date(`${filters.from}T00:00:00.000Z`)
    if (filters.to) where.date.lte = new Date(`${filters.to}T23:59:59.999Z`)
  }

  // Case-insensitive substring match on the description.
  if (filters.q) {
    where.description = { contains: filters.q, mode: 'insensitive' }
  }

  return where
}

/** True when any filter is active (used to show a "clear" button / empty copy). */
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return Object.keys(filters).length > 0
}
