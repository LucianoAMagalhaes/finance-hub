// Server Actions for the "Metas" screen (category target percentages).
//
// "use server": these always run on the server. The editor sends the full list
// of {id, percent} rows and we persist them in one transaction, each update
// scoped to the local user (a forged id matches zero rows — same ownership
// pattern as every other feature).

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { categoryPercentsSchema } from '@/lib/category-percent'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Saves the target percentage of each (expense) category in one go.
 *
 * @param input - Raw array of { id, percent } from the editor (re-validated).
 */
export async function setCategoryPercents(input: unknown): Promise<ActionResult> {
  const parsed = categoryPercentsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    // One transaction so all percentages move together (no half-saved plan).
    // Each updateMany filters by userId, so only the owner's rows can change.
    await prisma.$transaction(
      parsed.data.map((row) =>
        prisma.category.updateMany({
          where: { id: row.id, userId: user.id },
          data: { targetPercent: row.percent },
        }),
      ),
    )

    revalidatePath('/metas')
    return { ok: true }
  } catch (error) {
    console.error('setCategoryPercents failed:', error)
    return { ok: false, error: 'Não foi possível salvar as metas.' }
  }
}
