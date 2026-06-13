// Budget overview — a compact summary band above the list.
//
// No "use client": pure presentation, rendered to HTML on the server. It turns
// the per-budget statuses the page already computed into a quick "how is the
// month going?" headline: how many budgets are healthy, near the limit, over
// it, and how many expense categories still have no budget.

type Props = {
  ok: number
  warning: number
  over: number
  // Expense categories with no budget this month.
  unbudgeted: number
}

// One stat cell. `muted` greys out a zero count so the eye lands on what matters.
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
      <span className={`text-2xl font-bold ${muted ? 'text-gray-300' : className}`}>
        {value}
      </span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}

export function BudgetOverview({ ok, warning, over, unbudgeted }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <Stat value={ok} label="No limite" className="text-green-600" />
      <Stat value={warning} label="Atenção" className="text-amber-600" />
      <Stat value={over} label="Estourados" className="text-red-600" />
      <Stat value={unbudgeted} label="Sem orçamento" className="text-gray-600" />
    </div>
  )
}
