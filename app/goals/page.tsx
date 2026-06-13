// Goals page — route "/goals".
//
// A Server Component: it runs on the server, queries the database with Prisma,
// and passes plain data to the form (Client) and the list (Server). Progress and
// the suggested monthly contribution are derived in the list from this data.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { GoalForm } from './goal-form'
import { GoalList, type GoalRow } from './goal-list'

// Always render fresh data: goals and their saved amounts change over time.
export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const user = await getLocalUser()

  // Closest deadlines first, so the most urgent goals are at the top.
  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      targetAmount: true,
      currentAmount: true,
      deadline: true,
    },
    orderBy: { deadline: 'asc' },
  })

  const rows: GoalRow[] = goals

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Metas</h1>
        <p className="text-sm text-gray-500">
          Acompanhe o progresso e o aporte mensal sugerido de cada meta.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="order-2 lg:order-1">
          <GoalList items={rows} />
        </section>
        <aside className="order-1 lg:order-2">
          <GoalForm />
        </aside>
      </div>
    </main>
  )
}
