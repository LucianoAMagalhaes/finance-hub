// Generic horizontal-bar list — a presentational Server Component.
//
// Shared by the dashboard's "expenses by tag" and "expenses by payment method"
// sections. Mirrors the reference layout: a label on the left, a horizontal bar
// (width relative to the largest value) and the amount on the right. Styled in
// the "cofre" palette. Callers pass the already-aggregated, already-sorted items.

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
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-cofre-faint">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((b) => {
            const width = Math.max(2, Math.round((b.value / max) * 100))
            return (
              <li key={b.key} className="flex items-center gap-3">
                <span
                  className="w-28 shrink-0 truncate text-xs text-cofre-text"
                  title={b.label}
                >
                  {b.label}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cofre-panel">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${width}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs font-medium text-cofre-muted">
                  <Money cents={b.value} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
