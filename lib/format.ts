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
