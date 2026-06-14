// Budget list — a presentational Server Component.
//
// It receives already-computed rows (one per expense jar: target percent,
// derived limit and amount spent this month) and renders a read-only overview:
// an income/totals header, a per-status count band, and a progress bar per jar
// with the 80% / 100% visual alerts. No "use client": pure presentation,
// rendered to HTML on the server.

import { Money } from '@/components/money'
import { budgetStatus, type BudgetLevel } from '@/lib/budget'

// The shape the page builds for each jar.
export type BudgetRow = {
  categoryId: string
  name: string
  icon: string
  color: string
  percent: number // target share of income, 0-100
  limit: number // derived limit in cents (percent × income)
  spent: number // cents spent this month
}

// Tailwind classes per alert level: bar fill, text and badge.
const LEVEL_STYLES: Record<
  BudgetLevel,
  { bar: string; text: string; badge: string; label: string }
> = {
  ok: {
    bar: 'bg-green-500',
    text: 'text-gray-400',
    badge: 'bg-green-950 text-green-300',
    label: 'No limite',
  },
  warning: {
    bar: 'bg-amber-500',
    text: 'text-amber-300',
    badge: 'bg-amber-950 text-amber-300',
    label: 'Atenção: 80%+',
  },
  over: {
    bar: 'bg-red-500',
    text: 'text-red-300',
    badge: 'bg-red-950 text-red-300',
    label: 'Estourou',
  },
}

export function BudgetList({
  items,
  income,
  totalLimit,
  totalSpent,
  counts,
}: {
  items: BudgetRow[]
  income: number
  totalLimit: number
  totalSpent: number
  counts: { ok: number; warning: number; over: number }
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
        Nenhum pote de despesa cadastrado. Crie categorias em Configurações e
        defina as metas em <span className="font-medium">Metas</span>.
      </div>
    )
  }

  const totals = budgetStatus(totalSpent, totalLimit)
  const hasIncome = income > 0

  return (
    <div className="space-y-4">
      {/* Month summary: income base + spent vs derived total. */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-gray-200">Receita do mês</span>
          <span className="font-semibold text-green-400">
            <Money cents={income} />
          </span>
        </div>

        {hasIncome ? (
          <>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-400">Gasto total</span>
              <span className={LEVEL_STYLES[totals.level].text}>
                <Money cents={totalSpent} /> de <Money cents={totalLimit} /> (
                {totals.percent}%)
              </span>
            </div>
            <ProgressBar percent={totals.percent} level={totals.level} />

            {/* Per-status counts. */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={counts.ok} label="No limite" className="text-green-400" />
              <Stat value={counts.warning} label="Atenção" className="text-amber-400" />
              <Stat value={counts.over} label="Estourados" className="text-red-400" />
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-md border border-amber-900/60 bg-amber-950/40 p-3 text-sm text-amber-200">
            Sem receita lançada neste mês. Os limites de cada pote são derivados
            da renda, então lance suas receitas para vê-los aqui.
          </p>
        )}
      </div>

      {/* One card per jar. */}
      <ul className="space-y-3">
        {items.map((b) => (
          <BudgetCard key={b.categoryId} row={b} hasIncome={hasIncome} />
        ))}
      </ul>
    </div>
  )
}

// A single jar card. Three visual states:
//  - no income or 0% target → neutral, no bar/alert (just the spent amount);
//  - otherwise → progress bar with 80%/100% alerts and remaining/exceeded note.
function BudgetCard({ row, hasIncome }: { row: BudgetRow; hasIncome: boolean }) {
  const hasLimit = hasIncome && row.percent > 0
  const status = budgetStatus(row.spent, row.limit)
  const style = LEVEL_STYLES[status.level]

  return (
    <li className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `${row.color}1a`, color: row.color }}
        >
          {row.icon} {row.name}
        </span>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-300">
          {row.percent}%
        </span>
      </div>

      {hasLimit ? (
        <>
          <ProgressBar percent={status.percent} level={status.level} />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className={style.text}>
              <Money cents={row.spent} /> de <Money cents={row.limit} /> (
              {status.percent}%)
            </span>
            <span className="text-xs text-gray-400">
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
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Gasto: <Money cents={row.spent} />
          </span>
          <span className="text-xs text-gray-500">
            {row.percent === 0 ? 'Defina a meta em Metas' : 'Sem receita no mês'}
          </span>
        </div>
      )}
    </li>
  )
}

// One status count in the summary band.
function Stat({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className: string
}) {
  const muted = value === 0
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xl font-bold ${muted ? 'text-gray-600' : className}`}>
        {value}
      </span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

// A thin progress bar. We cap the visual width at 100% even when spending blew
// past the limit, while the percentage label (rendered separately) still shows
// the true number.
function ProgressBar({ percent, level }: { percent: number; level: BudgetLevel }) {
  const width = Math.min(percent, 100)
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className={`h-full rounded-full transition-all ${LEVEL_STYLES[level].bar}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
