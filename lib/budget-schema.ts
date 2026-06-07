// Validation schema for a budget's input.
//
// Role in the architecture: ONE Zod schema shared by the client form (instant
// feedback) and the Server Action (never trust the browser) — the same pattern
// as transaction-schema.ts. Defining it once keeps both sides in sync.

import { z } from 'zod'

export const budgetInputSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria'),

  // Limit is already converted to integer cents by the form before it gets
  // here. Money is always stored in cents — see CLAUDE.md.
  amountLimit: z
    .number({ error: 'Limite inválido' })
    .int('Limite inválido')
    .positive('O limite deve ser maior que zero'),

  // Period the budget applies to.
  month: z
    .number({ error: 'Mês inválido' })
    .int()
    .min(1, 'Mês inválido')
    .max(12, 'Mês inválido'),

  year: z
    .number({ error: 'Ano inválido' })
    .int()
    .min(2000, 'Ano inválido')
    .max(2100, 'Ano inválido'),
})

export type BudgetInput = z.input<typeof budgetInputSchema>
export type BudgetParsed = z.output<typeof budgetInputSchema>
