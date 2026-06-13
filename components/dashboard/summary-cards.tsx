// Dashboard summary cards — receitas, despesas and saldo for the month.
//
// Role in the architecture: a presentational Server Component. It receives the
// already-summed totals (in integer cents) from the dashboard page and renders
// three cards. No "use client": pure presentation, rendered to HTML server-side.

import { Money } from '@/components/money'

export function SummaryCards({
  income,
  expense,
}: {
  income: number // cents
  expense: number // cents
}) {
  const balance = income - expense

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card label="Receitas do mês">
        <span className="text-green-500">
          <Money cents={income} />
        </span>
      </Card>
      <Card label="Despesas do mês">
        <span className="text-red-500">
          <Money cents={expense} />
        </span>
      </Card>
      <Card label="Saldo do mês">
        {/* Colored by sign: a negative balance shows red, positive green. */}
        <Money cents={balance} colored />
      </Card>
    </div>
  )
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{children}</p>
    </div>
  )
}
