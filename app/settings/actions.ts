// Server Actions for the Settings screen.
//
// "use server" marks every export here as a function that always runs on the
// server, even when called from a Client Component. They cover the profile plus
// the three editable catalogs (categories, subcategories, tags). Every mutation
// is scoped to the local user (Phase 1 is single-user — see lib/user.ts), and
// updates/deletes use updateMany/deleteMany filtered by userId so a forged id
// can never touch another user's row (same security pattern as the other
// features).

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import {
  profileSchema,
  categorySchema,
  subcategorySchema,
  tagSchema,
} from '@/lib/settings-schema'

// Shared result shape used by all the actions (same as the other features).
export type ActionResult = { ok: true } | { ok: false; error: string }

// Pulls the first Zod message out of a failed parse for the UI.
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos'
}

// True when `error` is a Prisma known error with the given code (e.g. 'P2002'
// for a unique-constraint violation). We duck-type on `.code` instead of using
// `instanceof PrismaClientKnownRequestError`, which can fail when more than one
// copy of @prisma/client is loaded (module-boundary fragility).
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}

// --- Profile --------------------------------------------------------------

/**
 * Updates the local user's name and email.
 *
 * @param input - Raw object from the profile form (re-validated here).
 */
export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) }
  }

  try {
    const user = await getLocalUser()
    await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    })

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    // The email column is unique; a collision surfaces as P2002.
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, error: 'Já existe um usuário com esse e-mail.' }
    }
    console.error('updateProfile failed:', error)
    return { ok: false, error: 'Não foi possível salvar o perfil.' }
  }
}

// --- Categories -----------------------------------------------------------

/** Creates a category (a "jar") for the local user. */
export async function createCategory(input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    await prisma.category.create({ data: { userId: user.id, ...parsed.data } })
    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('createCategory failed:', error)
    return { ok: false, error: 'Não foi possível criar a categoria.' }
  }
}

/** Updates a category owned by the local user. */
export async function updateCategory(id: string, input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    const result = await prisma.category.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    })
    if (result.count === 0) return { ok: false, error: 'Categoria não encontrada.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('updateCategory failed:', error)
    return { ok: false, error: 'Não foi possível atualizar a categoria.' }
  }
}

/**
 * Deletes a category owned by the local user. A category is referenced by
 * transactions and budgets with ON DELETE RESTRICT, so deleting one still in use
 * would throw a foreign-key error. We check first and refuse with a clear
 * message instead of letting the constraint blow up.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    // Count usages (scoped to the owner) before attempting the delete.
    const [txCount, budgetCount] = await Promise.all([
      prisma.transaction.count({ where: { userId: user.id, categoryId: id } }),
      prisma.budget.count({ where: { userId: user.id, categoryId: id } }),
    ])

    if (txCount + budgetCount > 0) {
      const parts = []
      if (txCount > 0) parts.push(`${txCount} transação(ões)`)
      if (budgetCount > 0) parts.push(`${budgetCount} orçamento(s)`)
      return {
        ok: false,
        error: `Categoria em uso por ${parts.join(' e ')}. Remova-os antes de excluir.`,
      }
    }

    const result = await prisma.category.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return { ok: false, error: 'Categoria não encontrada.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('deleteCategory failed:', error)
    return { ok: false, error: 'Não foi possível excluir a categoria.' }
  }
}

// --- Subcategories --------------------------------------------------------

/** Creates a subcategory (a free spending/earning area) for the local user. */
export async function createSubcategory(input: unknown): Promise<ActionResult> {
  const parsed = subcategorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    await prisma.subcategory.create({ data: { userId: user.id, ...parsed.data } })
    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('createSubcategory failed:', error)
    return { ok: false, error: 'Não foi possível criar a subcategoria.' }
  }
}

/** Updates a subcategory owned by the local user. */
export async function updateSubcategory(id: string, input: unknown): Promise<ActionResult> {
  const parsed = subcategorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    const result = await prisma.subcategory.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    })
    if (result.count === 0) return { ok: false, error: 'Subcategoria não encontrada.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('updateSubcategory failed:', error)
    return { ok: false, error: 'Não foi possível atualizar a subcategoria.' }
  }
}

/**
 * Deletes a subcategory owned by the local user. Unlike categories, the
 * transaction → subcategory relation is ON DELETE SET NULL, so deleting one is
 * always safe: any transaction using it simply loses its (optional) subcategory.
 */
export async function deleteSubcategory(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()
    const result = await prisma.subcategory.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return { ok: false, error: 'Subcategoria não encontrada.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('deleteSubcategory failed:', error)
    return { ok: false, error: 'Não foi possível excluir a subcategoria.' }
  }
}

// --- Tags -----------------------------------------------------------------

/** Creates a tag (reusable marker) for the local user. */
export async function createTag(input: unknown): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    await prisma.tag.create({ data: { userId: user.id, ...parsed.data } })
    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    // Tag names are unique per user (@@unique([userId, name])).
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, error: 'Já existe um marcador com esse nome.' }
    }
    console.error('createTag failed:', error)
    return { ok: false, error: 'Não foi possível criar o marcador.' }
  }
}

/** Updates a tag owned by the local user. */
export async function updateTag(id: string, input: unknown): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()
    const result = await prisma.tag.updateMany({
      where: { id, userId: user.id },
      data: parsed.data,
    })
    if (result.count === 0) return { ok: false, error: 'Marcador não encontrado.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, error: 'Já existe um marcador com esse nome.' }
    }
    console.error('updateTag failed:', error)
    return { ok: false, error: 'Não foi possível atualizar o marcador.' }
  }
}

/**
 * Deletes a tag owned by the local user. The transaction → tag relation is
 * ON DELETE SET NULL, so deleting is always safe (transactions just lose the
 * optional marker).
 */
export async function deleteTag(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()
    const result = await prisma.tag.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return { ok: false, error: 'Marcador não encontrado.' }

    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    console.error('deleteTag failed:', error)
    return { ok: false, error: 'Não foi possível excluir o marcador.' }
  }
}
