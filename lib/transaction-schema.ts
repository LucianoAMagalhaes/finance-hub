// Validation schema for a transaction's input.
//
// Role in the architecture: ONE schema, used in two places (CLAUDE.md requires
// both client and server validation):
//   - the Client Component form validates before sending (instant feedback);
//   - the Server Action re-validates before touching the database (never trust
//     the client).
// Defining it once means the rules can never drift apart.

import { z } from 'zod'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '@/lib/constants'

export const transactionInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(120, 'Descrição muito longa'),

  // Amount is already converted to integer cents by the time it gets here
  // (the form parses the BRL string with parseBRLToCents). Money is always
  // stored in cents — see CLAUDE.md.
  amount: z
    .number({ error: 'Valor inválido' })
    .int('Valor inválido')
    .positive('Valor deve ser maior que zero'),

  // Comes from an <input type="date">, which always yields YYYY-MM-DD.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),

  type: z.enum(TRANSACTION_TYPES, { error: 'Selecione o tipo' }),

  paymentMethod: z.enum(PAYMENT_METHODS, {
    error: 'Selecione a forma de pagamento',
  }),

  categoryId: z.string().min(1, 'Selecione uma categoria'),

  // Optional relations. Empty string from a <select> is normalized to null.
  subcategoryId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),

  tagId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),

  notes: z
    .string()
    .trim()
    .max(500, 'Observação muito longa')
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
})

// The inferred TypeScript type of a valid transaction input. `input` is what
// callers pass in; `output` is the parsed result (with the transforms applied).
export type TransactionInput = z.input<typeof transactionInputSchema>
export type TransactionParsed = z.output<typeof transactionInputSchema>
