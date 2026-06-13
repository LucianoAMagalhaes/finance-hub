// Metas page — route "/metas".
//
// A Server Component: it reads the expense categories (the 6 "jars") with their
// current target percentages and hands them to the client editor. The 6-jars
// method splits monthly income across these jars; this screen is where the user
// sets each jar's share. Income categories are excluded — a "share of income"
// only makes sense for spending.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { CategoryPercentEditor, type PercentRow } from './category-percent-editor'

// Always render fresh data: percentages change as the user edits them here.
export const dynamic = 'force-dynamic'

export default async function MetasPage() {
  const user = await getLocalUser()

  // Only expense categories carry a target share; show them in display order.
  const categories = await prisma.category.findMany({
    where: { userId: user.id, type: 'expense' },
    select: { id: true, name: true, icon: true, color: true, targetPercent: true },
    orderBy: [{ targetPercent: 'desc' }, { name: 'asc' }],
  })

  const rows: PercentRow[] = categories

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
        <p className="text-sm text-gray-400">
          Defina quanto da sua renda mensal vai para cada pote. O ideal é somar
          100%.
        </p>
      </header>

      <CategoryPercentEditor items={rows} />
    </main>
  )
}
