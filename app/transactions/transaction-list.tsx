// Transaction list — a presentational Server Component.
//
// It receives already-fetched rows as props (the page does the Prisma query)
// and just renders them. No "use client": this renders to HTML on the server.

import { Money } from '@/components/money'
import { formatDate } from '@/lib/format'
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type TransactionType,
} from '@/lib/constants'
import { TransactionRowActions } from './transaction-row-actions'

// The exact shape the page selects for each transaction.
export type TransactionRow = {
  id: string
  description: string
  amount: number
  date: Date
  type: TransactionType
  paymentMethod: PaymentMethod
  notes: string | null
  category: { name: string; icon: string; color: string } | null
  tag: { name: string } | null
  account: { name: string } | null
}

export function TransactionList({
  items,
  filtered = false,
}: {
  items: TransactionRow[]
  // When true, the empty state reflects "no match" instead of "no data yet".
  filtered?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cofre-border p-8 text-center text-sm text-cofre-muted">
        {filtered
          ? 'Nenhuma transação corresponde aos filtros.'
          : 'Nenhuma transação ainda. Clique em “+ Nova transação” para criar a primeira.'}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-cofre-border bg-cofre-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-cofre-panel text-left text-xs uppercase tracking-wide text-cofre-muted">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Conta</th>
            <th className="px-4 py-3">Pagamento</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cofre-border">
          {items.map((t) => {
            // Expenses display as negative so the sign + color read correctly.
            const signed = t.type === 'expense' ? -t.amount : t.amount
            return (
              <tr key={t.id} className="hover:bg-cofre-panel">
                <td className="whitespace-nowrap px-4 py-3 text-cofre-muted">
                  {formatDate(t.date)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-cofre-text">{t.description}</div>
                  {t.tag && (
                    <div className="flex gap-2 text-xs text-cofre-muted">
                      <span className="rounded-full bg-cofre-panel px-2 py-0.5">
                        #{t.tag.name}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.category ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        // The category color drives a subtle tinted badge.
                        backgroundColor: `${t.category.color}1a`,
                        color: t.category.color,
                      }}
                    >
                      {t.category.icon} {t.category.name}
                    </span>
                  ) : (
                    <span className="text-cofre-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-cofre-muted">
                  {t.account ? t.account.name : <span className="text-cofre-faint">—</span>}
                </td>
                <td className="px-4 py-3 text-cofre-muted">
                  {PAYMENT_METHOD_LABELS[t.paymentMethod]}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  <Money cents={signed} colored />
                </td>
                <td className="px-4 py-3 text-right">
                  <TransactionRowActions id={t.id} description={t.description} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
