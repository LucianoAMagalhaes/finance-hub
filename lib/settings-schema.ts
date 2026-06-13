// Validation schemas for the Settings screen.
//
// Role in the architecture: ONE Zod schema per editable entity, shared by the
// client forms (instant feedback) and the Server Actions (never trust the
// browser) — same pattern as transaction-schema.ts / budget-schema.ts /
// goal-schema.ts. Settings edits the user profile plus the three customizable
// catalogs: categories, subcategories and tags.

import { z } from 'zod'
import { TRANSACTION_TYPES } from '@/lib/constants'

// Colors come from an <input type="color">, which always yields a 6-digit hex
// like "#1a2b3c". We accept either case so a hand-typed value still passes.
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use um hexadecimal como #1a2b3c)')

// An emoji icon. We only guard against empty/abusive input — emojis can span
// several UTF-16 code units (e.g. 🛋️ with a variation selector), so the upper
// bound is generous on purpose.
const icon = z
  .string()
  .trim()
  .min(1, 'Informe um ícone')
  .max(16, 'Ícone muito longo')

// The income/expense union, validated against the same source of truth the rest
// of the app uses (keeps it in sync with the Prisma enum).
const transactionType = z.enum(
  TRANSACTION_TYPES,
  // z.enum needs a custom message via the error map for a friendly fallback.
  { error: 'Tipo inválido' },
)

// --- Profile --------------------------------------------------------------

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(80, 'Nome muito longo'),
  // Trim + lowercase so the unique email is stored consistently.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('E-mail inválido')),
})

export type ProfileInput = z.input<typeof profileSchema>
export type ProfileParsed = z.output<typeof profileSchema>

// --- Category / Subcategory ----------------------------------------------
// Categories (the 6 "jars") and subcategories (free spending areas) have the
// exact same editable shape, so they share one schema.

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(40, 'Nome muito longo'),
  icon,
  color: hexColor,
  type: transactionType,
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryParsed = z.output<typeof categorySchema>

// Subcategories are validated with the very same rules; the alias keeps call
// sites readable and leaves room to diverge later without a rename.
export const subcategorySchema = categorySchema
export type SubcategoryParsed = CategoryParsed

// --- Tag ------------------------------------------------------------------
// A reusable marker: just a name (unique per user) and an optional color.

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome').max(40, 'Nome muito longo'),
  color: hexColor,
})

export type TagInput = z.input<typeof tagSchema>
export type TagParsed = z.output<typeof tagSchema>
