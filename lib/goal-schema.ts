// Validation schema for a goal's input.
//
// Role in the architecture: ONE Zod schema shared by the client form (instant
// feedback) and the Server Action (never trust the browser) — same pattern as
// budget-schema.ts / transaction-schema.ts.

import { z } from 'zod'

export const goalInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe um nome').max(80, 'Nome muito longo'),

    // Amounts are converted to integer cents by the form before validation.
    // Money is always stored in cents — see CLAUDE.md.
    targetAmount: z
      .number({ error: 'Valor alvo inválido' })
      .int('Valor alvo inválido')
      .positive('O valor alvo deve ser maior que zero'),

    // Already-saved amount; may be zero but never negative.
    currentAmount: z
      .number({ error: 'Valor atual inválido' })
      .int('Valor atual inválido')
      .nonnegative('O valor atual não pode ser negativo'),

    // Comes from an <input type="date">, which always yields YYYY-MM-DD.
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Prazo inválido'),
  })
  // Saving more than the target makes no sense for a goal.
  .refine((d) => d.currentAmount <= d.targetAmount, {
    error: 'O valor atual não pode ser maior que o alvo',
    path: ['currentAmount'],
  })

export type GoalInput = z.input<typeof goalInputSchema>
export type GoalParsed = z.output<typeof goalInputSchema>
