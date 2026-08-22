// Money formatting helpers.
//
// Role in the architecture: a single shared place for converting between the
// integer-cents representation stored in the database (see CLAUDE.md "valores
// monetários em centavos") and the BRL strings shown to the user. Keeping this
// logic here means every screen formats money exactly the same way.

/**
 * Converts a value in cents to a formatted BRL string.
 * @param cents - Integer value in cents (e.g. 150000 = R$ 1.500,00)
 */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Parses a user-typed BRL string into integer cents.
 *
 * Accepts the messy input people actually type: with or without the "R$"
 * prefix, with "." as thousands separator and "," as the decimal separator
 * (Brazilian convention), e.g. "R$ 1.500,00" -> 150000. Returns null when the
 * input has no parseable number, so callers can show a validation error.
 *
 * @param input - Raw string from a money input field.
 */
export function parseBRLToCents(input: string): number | null {
  // Keep only digits, comma and minus; drop "R$", spaces and thousands dots.
  const cleaned = input
    .replace(/[^\d,-]/g, '') // strip everything that is not digit, comma or minus
    .replace(',', '.') // switch to a JS-parseable decimal separator

  if (cleaned === '' || cleaned === '-') return null

  const value = Number(cleaned)
  if (Number.isNaN(value)) return null

  // Round to avoid floating-point drift (e.g. 19.99 * 100 = 1998.9999...).
  return Math.round(value * 100)
}

/**
 * Formats a date as the Brazilian dd/mm/aaaa.
 *
 * We force the UTC time zone because transaction dates are stored as a date at
 * UTC midnight (see the transactions Server Action). Formatting in UTC ensures
 * the displayed day always equals the day the user picked, regardless of the
 * server's local time zone.
 *
 * @param date - A Date object or an ISO string.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// --- Phase 2 — quantities and unit prices ----------------------------------
// Money that moved is always integer cents, and formatBRL/parseBRLToCents above
// keep serving it. Investments add two numbers that are NOT integer cents: the
// QUANTITY of an asset (0.00123456 BTC) and a unit QUOTE, which can be worth
// less than one cent. These helpers are their entry and exit doors.

/**
 * Parses a user-typed quantity into a number.
 *
 * Accepts both Brazilian ("0,00123456") and plain ("0.00123456") notation, and
 * tolerates thousands dots when a comma is present ("1.000,5" -> 1000.5).
 * Returns null when there is no parseable number, so callers can show an error.
 *
 * @param input - Raw string from a quantity field.
 */
export function parseQuantity(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  // When a comma is present it is the decimal separator (pt-BR), so dots are
  // thousands separators and can be dropped. Without a comma, the dot IS the
  // decimal separator and must be kept.
  const cleaned = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed

  // Drop anything that is not part of a number ("10 un." -> "10"). If nothing
  // numeric is left, the input was junk.
  const stripped = cleaned.replace(/[^\d.-]/g, '')
  if (stripped === '' || stripped === '-' || stripped === '.') return null

  const value = Number(stripped)
  if (!Number.isFinite(value)) return null

  // 8 decimals is what the database column stores (see prisma/schema.prisma).
  return Math.round(value * 1e8) / 1e8
}

/**
 * Formats a quantity for display: pt-BR separators, up to 8 decimals, and no
 * trailing zeros (10 stays "10", not "10,00000000").
 *
 * @param quantity - Number of units held or traded.
 */
export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })
}

/**
 * Parses a user-typed unit price into cents, KEEPING fractions of a cent.
 *
 * parseBRLToCents rounds to whole cents, which is right for money that moved
 * but wrong for a quote: a coin worth R$ 0,000071 would collapse to 0.
 *
 * @param input - Raw string from a price field (e.g. "R$ 38,50", "0,000071").
 */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '')
  if (cleaned === '' || cleaned === '-') return null

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null

  // 6 decimals of a cent — the precision of the DECIMAL(20,6) column.
  return Math.round(value * 100 * 1e6) / 1e6
}

/**
 * Formats a unit price (in cents, possibly fractional) as BRL.
 *
 * Uses the usual two decimals, but falls back to six when the price is worth
 * less than one cent — otherwise a crypto quote would read "R$ 0,00".
 *
 * @param cents - Price per unit in cents (may be fractional).
 */
export function formatPriceBRL(cents: number): string {
  const value = cents / 100
  const decimals = value !== 0 && Math.abs(value) < 0.01 ? 6 : 2

  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Says how long ago something happened, in short Portuguese ("hoje", "ontem",
 * "há 3 dias"). Used by the portfolio table to show how fresh a hand-typed
 * quote is — the whole reason the app stamps `priceUpdatedAt`.
 *
 * Falls back to the plain date after a month, when "há 47 dias" stops being
 * easier to read than "06/07/2026".
 *
 * Takes `now` as a parameter (instead of calling new Date() inside) so it is
 * directly unit-testable — same convention as lib/portfolio's isPriceStale.
 *
 * @param date - The moment in the past.
 * @param now - The current moment.
 */
export function formatRelativeDay(date: Date, now: Date): string {
  // Compare calendar days, not raw milliseconds: something recorded last night
  // is "ontem", even if only a few hours have passed.
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000)

  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days <= 30) return `há ${days} dias`
  return formatDate(date)
}
