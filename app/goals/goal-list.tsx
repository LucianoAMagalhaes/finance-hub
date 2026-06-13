// Goal list — a presentational Server Component.
//
// It receives already-fetched goals and renders a progress bar per goal plus
// the live suggested monthly contribution (recomputed here from the current
// state, not read from the stored snapshot). No "use client": pure presentation,
// rendered to HTML on the server.

import { Money } from '@/components/money'
import { formatDate } from '@/lib/format'
import { goalProgress, suggestedMonthlyContribution } from '@/lib/goal'
import { GoalCardActions } from './goal-card-actions'

// The shape the page builds for each goal.
export type GoalRow = {
  id: string
  name: string
  targetAmount: number // cents
  currentAmount: number // cents
  deadline: Date
}

export function GoalList({ items }: { items: GoalRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
        Nenhuma meta ainda. Crie a primeira no formulário ao lado.
      </div>
    )
  }

  // "Now" is computed once for the whole list so every suggestion uses the same
  // reference point.
  const now = new Date()

  return (
    <ul className="space-y-3">
      {items.map((g) => {
        const progress = goalProgress(g.currentAmount, g.targetAmount)
        const suggestion = suggestedMonthlyContribution(
          g.targetAmount,
          g.currentAmount,
          g.deadline,
          now,
        )

        return (
          <li
            key={g.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-gray-800">{g.name}</span>
              {progress.complete ? (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Concluída 🎉
                </span>
              ) : (
                <span className="text-xs text-gray-500">
                  Prazo: {formatDate(g.deadline)}
                </span>
              )}
            </div>

            {/* Progress bar — green throughout; the goal is about saving, not
                overspending, so there are no warning/over states. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                <Money cents={g.currentAmount} /> de{' '}
                <Money cents={g.targetAmount} /> ({progress.percent}%)
              </span>
              {!progress.complete && (
                <span className="text-xs text-gray-500">
                  Falta <Money cents={progress.remaining} />
                </span>
              )}
            </div>

            {/* Suggested monthly contribution to reach the target by the deadline. */}
            {!progress.complete && (
              <p className="mt-2 text-xs text-gray-500">
                Aporte mensal sugerido:{' '}
                <span className="font-medium text-gray-700">
                  <Money cents={suggestion} />
                </span>
              </p>
            )}

            <GoalCardActions id={g.id} name={g.name} complete={progress.complete} />
          </li>
        )
      })}
    </ul>
  )
}
