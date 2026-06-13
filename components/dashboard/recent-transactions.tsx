// Dashboard recent-transactions list — the latest 5 entries.
//
// Presentational Server Component: it receives already-fetched rows from the
// dashboard page and renders a compact list with a link to the full screen.
// Amounts are signed by type (income positive/green, expense negative/red).

import Link from 'next/link'
import { Money } from '@/components/money'
import { formatDate } from '@/lib/format'

export type RecentRow = {
  id: string
  description: string
  amount: number // cents (stored positive)
  date: Date
  type: 'income' | 'expense'
  category: { name: string; icon: string; color: string }
}

export function RecentTransactions({ items }: { items: RecentRow[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Últimas transações</h2>
        <Link
          href="/transactions"
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Ver todas →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma transação ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((t) => {
            // Income counts positive, expense negative, so the colored Money
            // shows the right sign and color.
            const signed = t.type === 'income' ? t.amount : -t.amount
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {t.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    <span style={{ color: t.category.color }}>
                      {t.category.icon} {t.category.name}
                    </span>{' '}
                    · {formatDate(t.date)}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-medium">
                  <Money cents={signed} colored />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
