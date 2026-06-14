// Dashboard tag bars — this month's expenses broken down by marker (tag).
//
// Presentational Server Component (no "use client"): it receives already-
// aggregated rows from the dashboard page and renders horizontal bars, ordered
// by amount spent. Each bar's width is relative to the largest one, so the top
// tag fills the track and the rest scale against it. Expenses without a marker
// are grouped into a neutral "Sem tag" row.

import { Money } from '@/components/money'

// One aggregated tag row: its label, color and total spent this month (cents).
export type TagBar = {
  name: string
  color: string
  total: number // cents
}

export function TagBars({ items }: { items: TagBar[] }) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-200">
        Despesas por marcador
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma despesa neste mês.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => {
            // Width relative to the largest tag (items[0], since the page sorts
            // them descending). Guard against a zero max.
            const max = items[0].total || 1
            const width = Math.max(2, Math.round((t.total / max) * 100))
            return (
              <li key={t.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-gray-200">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: t.color }}
                      aria-hidden
                    />
                    {t.name}
                  </span>
                  <span className="text-gray-400">
                    <Money cents={t.total} />
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, backgroundColor: t.color }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
