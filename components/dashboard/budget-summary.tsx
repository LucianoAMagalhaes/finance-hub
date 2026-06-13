// Dashboard budget summary — a compact "how are this month's budgets doing?"
// band. Presentational Server Component: it receives counts already computed by
// the dashboard page (reusing the same budgetStatus thresholds as the budgets
// screen) and links through to /budgets.

import Link from 'next/link'

export function BudgetSummary({
  total,
  ok,
  warning,
  over,
}: {
  total: number
  ok: number
  warning: number
  over: number
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Orçamentos do mês</h2>
        <Link href="/budgets" className="text-xs text-gray-500 hover:text-gray-900">
          Ver todos →
        </Link>
      </div>

      {total === 0 ? (
        <p className="text-sm text-gray-500">Nenhum orçamento neste mês.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={ok} label="No limite" className="text-green-600" />
          <Stat value={warning} label="Atenção" className="text-amber-600" />
          <Stat value={over} label="Estourados" className="text-red-600" />
        </div>
      )}
    </div>
  )
}

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
      <span className={`text-xl font-bold ${muted ? 'text-gray-300' : className}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
