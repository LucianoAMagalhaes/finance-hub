// Generic horizontal-bar list — a presentational Server Component.
//
// Shared by the dashboard's "expenses by tag" and "expenses by payment method"
// sections, which render identically: a titled card with one colored horizontal
// bar per item, each bar's width relative to the largest value. Callers pass the
// already-aggregated, already-sorted items.

import { Money } from '@/components/money'

// One bar: a stable key, a label, a color and a value in integer cents.
export type Bar = {
  key: string
  label: string
  color: string
  value: number // cents
}

export function BarList({
  title,
  items,
  emptyText,
}: {
  title: string
  items: Bar[]
  emptyText: string
}) {
  // Width is relative to the largest value; guard against an all-zero/empty set.
  const max = Math.max(1, ...items.map((b) => b.value))

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-200">{title}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((b) => {
            const width = Math.max(2, Math.round((b.value / max) * 100))
            return (
              <li key={b.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-gray-200">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: b.color }}
                      aria-hidden
                    />
                    {b.label}
                  </span>
                  <span className="text-gray-400">
                    <Money cents={b.value} />
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, backgroundColor: b.color }}
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
