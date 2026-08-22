// Allocation targets — the shared Zod schema plus small pure helpers.
//
// Role in the architecture: the user says how much of the portfolio they want
// in each asset type (Ação Nacional, FII, Cripto…), ideally summing to 100%.
// That plan is what the contribution planner splits an aporte by, before the
// score decides which asset inside the type gets the money (ADR-009).
//
// This is the investments counterpart of lib/category-percent.ts (the 6-jars
// plan) and follows the same shape on purpose: the same schema validates in the
// browser (instant feedback) and in the Server Action (the actual rule), and the
// sum helper drives the live "total must reach 100%" indicator — in fact this
// module REUSES sumPercents from there instead of writing a second one.
//
// No I/O here, so it is unit-tested directly. Tests live in lib/allocation.test.ts.

import { z } from 'zod'
import { ASSET_TYPES, type AssetType } from '@/lib/constants'

// One row of the editor: which type and its new percentage. Keyed by TYPE, not
// by a row id — unlike categories, the types are a fixed enum, so the type
// itself is the identity and a target row may not exist yet.
export const allocationTargetSchema = z.object({
  type: z.enum(ASSET_TYPES, { error: 'Tipo de ativo inválido' }),
  percent: z
    .number({ error: 'Percentual inválido' })
    .int('Use um número inteiro')
    .min(0, 'Mínimo 0%')
    .max(100, 'Máximo 100%'),
})

// The whole submission: a non-empty list of { type, percent }.
export const allocationTargetsSchema = z
  .array(allocationTargetSchema)
  .min(1, 'Nada para salvar')

export type AllocationTarget = z.infer<typeof allocationTargetSchema>

/**
 * Turns the saved rows into a complete map with every type present.
 *
 * A type with no row yet means 0%, and the planner needs to see that zero
 * rather than an undefined — otherwise a type the user has not planned for
 * would silently drop out of the split instead of being deliberately excluded.
 *
 * @param targets - The rows as stored (may cover only some types).
 */
export function toTargetMap(
  targets: { type: AssetType; targetPercent: number }[],
): Record<AssetType, number> {
  const map = Object.fromEntries(ASSET_TYPES.map((type) => [type, 0])) as Record<
    AssetType,
    number
  >
  for (const target of targets) {
    map[target.type] = target.targetPercent
  }
  return map
}
