// Zod schemas for the investments module.
//
// Role in the architecture: the single definition of what a valid asset and a
// valid operation look like. The Client Component form imports it to validate
// before submitting, and the Server Action imports the SAME schema to validate
// again — the browser check is a convenience, the server check is the rule.
//
// Amount conventions (see lib/portfolio.ts and ADR-007): `totalCents` is an
// INTEGER of cents, `quantity` has up to 8 decimals, and `currentPriceCents` is
// cents per unit and MAY be fractional.

import { z } from 'zod'
import { ASSET_TYPES, ASSET_OPERATION_TYPES } from '@/lib/constants'

// Quantities are stored as DECIMAL(24,8); anything finer would be silently
// truncated by the database, so we reject it up front instead.
const quantity = z
  .number({ error: 'Quantidade inválida' })
  .positive('Quantidade deve ser maior que zero')
  .refine((value) => Number.isFinite(value), 'Quantidade inválida')
  .refine(
    (value) => Math.abs(value * 1e8 - Math.round(value * 1e8)) < 1e-3,
    'Quantidade aceita no máximo 8 casas decimais',
  )

// The hand-typed quote on its own: the portfolio table lets the user edit just
// this cell, so it needs a schema of its own instead of the whole asset.
// Null means "never priced" — the UI shows "sem cotação" instead of R$ 0,00.
const currentPriceCents = z
  .number({ error: 'Cotação inválida' })
  .positive('Cotação deve ser maior que zero')
  .nullable()
  .optional()
  .transform((value) => value ?? null)

export const quoteSchema = z.object({ currentPriceCents })

// The ticker: the identity of a portfolio line. Uppercased here so "petr4" and
// "PETR4" are the same asset for the unique index.
const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Ticker é obrigatório')
  .max(12, 'Ticker muito longo')

// The identity of a portfolio line, plus the optional hand-typed quote.
export const assetSchema = z.object({
  ticker,
  type: z.enum(ASSET_TYPES, { error: 'Selecione o tipo do ativo' }),
  currentPriceCents,
})

// One buy or sell, with the money that actually moved. Kept for the operations
// screen (sells, editing a past operation); the purchase form below uses its
// own, friendlier shape.
export const assetOperationInputSchema = z.object({
  type: z.enum(ASSET_OPERATION_TYPES, { error: 'Selecione o tipo da operação' }),
  quantity,
  totalCents: z
    .number({ error: 'Valor inválido' })
    .int('Valor inválido')
    .positive('Valor deve ser maior que zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  notes: z
    .string()
    .trim()
    .max(200, 'Observação muito longa')
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
})

// An operation on an asset that already exists (used from the next slice on).
export const assetOperationSchema = assetOperationInputSchema.extend({
  assetId: z.string().min(1, 'Ativo é obrigatório'),
})

// What the "Nova compra" form sends. There is no separate "create asset" step:
// the user always registers a PURCHASE, and the Server Action reuses the asset
// when that ticker already exists (so a second buy of PETR4 is just another
// operation, not a duplicate line).
//
// Note what is NOT here: `totalCents`. The form gives quantity and unit price,
// and the server derives the total — one number derived in one place can never
// disagree with what the browser computed.
// The three numbers a purchase is made of. Shared by the "nova compra" form
// (which also picks the ticker and the type) and by the form that edits one
// purchase inside a ticker's drill-down (where ticker and type are fixed).
const purchaseFields = {
  quantity,
  // Cents per unit, and it MAY be fractional (ADR-007): a coin worth
  // R$ 0,000071 is 0.0071 cents.
  unitPriceCents: z
    .number({ error: 'Preço de compra inválido' })
    .positive('Preço de compra deve ser maior que zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
}

export const purchaseSchema = z.object({
  ticker,
  type: z.enum(ASSET_TYPES, { error: 'Selecione o tipo do ativo' }),
  ...purchaseFields,
})

// Editing one purchase: the ticker and the type belong to the asset, not to
// this operation, so they are not editable here.
export const purchaseEditSchema = z.object(purchaseFields)

export type AssetInput = z.input<typeof assetSchema>
export type AssetParsed = z.output<typeof assetSchema>
export type AssetOperationInput = z.input<typeof assetOperationInputSchema>
export type AssetOperationParsed = z.output<typeof assetOperationInputSchema>
export type QuoteInput = z.input<typeof quoteSchema>
export type PurchaseInput = z.input<typeof purchaseSchema>
export type PurchaseParsed = z.output<typeof purchaseSchema>
export type PurchaseEditInput = z.input<typeof purchaseEditSchema>
