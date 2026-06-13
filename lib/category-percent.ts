// Category target-percent helpers — pure functions + the shared Zod schema.
//
// Role in the architecture: the "Metas" screen edits the target share (a whole
// percentage 0-100) of each expense category — the 6-jars budgeting plan. The
// schema is validated by both the client editor (instant feedback) and the
// Server Action (never trust the browser); the sum helper drives the "total
// must reach 100%" indicator. No I/O here, so it is unit-tested directly.

import { z } from 'zod'

// One row of the editor: which category and its new percentage.
export const categoryPercentSchema = z.object({
  id: z.string().min(1),
  percent: z
    .number({ error: 'Percentual inválido' })
    .int('Use um número inteiro')
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%'),
})

// The whole submission: a non-empty list of {id, percent}.
export const categoryPercentsSchema = z
  .array(categoryPercentSchema)
  .min(1, 'Nada para salvar')

export type CategoryPercent = z.infer<typeof categoryPercentSchema>

/**
 * Sums the percentages. The plan is "balanced" when this is exactly 100 — the
 * editor shows green at 100 and warns otherwise.
 *
 * @param items - The {id, percent} rows currently in the editor.
 */
export function sumPercents(items: { percent: number }[]): number {
  return items.reduce((total, item) => total + item.percent, 0)
}
