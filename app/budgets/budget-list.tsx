// Budget list — a presentational Server Component.
//
// It receives already-computed rows (limit + spent per category) and renders a
// progress bar per budget plus the 80% / 100% visual alerts. No "use client":
// this is pure presentation, rendered to HTML on the server.

import { Money } from '@/components/money'
import { budgetStatus, type BudgetLevel } from '@/lib/budget'
import { BudgetRowActions } from './budget-row-actions'

// The shape the page builds for each budget.
export type BudgetRow = {
  id: string
  amountLimit: number // cents
  spent: number // cents
  category: { id: string; name: string; icon: string; color: string }
}

// Tailwind classes per alert level: bar fill, text and badge.
const LEVEL_STYLES: Record<
  BudgetLevel,
  { bar: string; text: string; badge: string; label: string }
> = {
  ok: {
    bar: 'bg-green-500',
    text: 'text-gray-500',
    badge: 'bg-green-50 text-green-700',
    label: 'No limite',
  },
  warning: {
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700',
    label: 'Atenção: 80%+',
  },
  over: {
    bar: 'bg-red-500',
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-700',
    label: 'Estourou',
  },
}

export function BudgetList({
  items,
  totalLimit,
  totalSpent,
}: {
  items: BudgetRow[]
  totalLimit: number
  totalSpent: number
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        Nenhum orçamento neste mês. Crie o primeiro no formulário ao lado.
      </div>
    )
  }

  const totals = budgetStatus(totalSpent, totalLimit)

  return (
    <div className="space-y-4">
      {/* Period summary across all budgets. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Total do mês</span>
          <span className={LEVEL_STYLES[totals.level].text}>
            <Money cents={totalSpent} /> de <Money cents={totalLimit} /> (
            {totals.percent}%)
          </span>
        </div>
        <ProgressBar percent={totals.percent} level={totals.level} />
      </div>

      {/* One card per budget. */}
      <ul className="space-y-3">
        {items.map((b) => {
          const status = budgetStatus(b.spent, b.amountLimit)
          const style = LEVEL_STYLES[status.level]
          return (
            <li
              key={b.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${b.category.color}1a`,
                    color: b.category.color,
                  }}
                >
                  {b.category.icon} {b.category.name}
                </span>
                {/* The alert badge only shows when there's something to flag. */}
                {status.level !== 'ok' && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
                  >
                    {style.label}
                  </span>
                )}
              </div>

              <ProgressBar percent={status.percent} level={status.level} />

              <div className="mt-2 flex items-center justify-between text-sm">
                <span className={style.text}>
                  <Money cents={b.spent} /> de <Money cents={b.amountLimit} /> (
                  {status.percent}%)
                </span>
                <span className="text-xs text-gray-500">
                  {status.remaining >= 0 ? (
                    <>
                      Resta <Money cents={status.remaining} />
                    </>
                  ) : (
                    <>
                      Excedeu <Money cents={-status.remaining} />
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
                <BudgetRowActions id={b.id} categoryName={b.category.name} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// A thin progress bar. We cap the visual width at 100% even when spending blew
// past the limit, while the percentage label (rendered separately) still shows
// the true number.
function ProgressBar({ percent, level }: { percent: number; level: BudgetLevel }) {
  const width = Math.min(percent, 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all ${LEVEL_STYLES[level].bar}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
