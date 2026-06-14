// Dashboard summary cards — receitas, despesas and saldo for the month.
//
// Presentational Server Component (no "use client"). It receives the already-
// summed totals (integer cents) from the dashboard page and renders three cards
// styled in the "cofre" palette, with lucide arrows and the period label.

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Money } from '@/components/money'

export function SummaryCards({
  income,
  expense,
  periodLabel,
}: {
  income: number // cents
  expense: number // cents
  periodLabel: string
}) {
  const balance = income - expense

  return (
    <>
      <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cofre-jade">
          <ArrowUpRight size={14} /> Receitas
        </div>
        <p className="text-2xl font-extrabold tracking-tight">
          <Money cents={income} />
        </p>
        <p className="mt-1.5 text-xs text-cofre-faint">{periodLabel}</p>
      </div>

      <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cofre-red">
          <ArrowDownRight size={14} /> Despesas
        </div>
        <p className="text-2xl font-extrabold tracking-tight">
          <Money cents={expense} />
        </p>
        <p className="mt-1.5 text-xs text-cofre-faint">{periodLabel}</p>
      </div>

      <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-cofre-muted">
          Saldo do mês
        </p>
        <p
          className={`text-2xl font-extrabold tracking-tight ${
            balance >= 0 ? 'text-cofre-jade' : 'text-cofre-red'
          }`}
        >
          <Money cents={balance} />
        </p>
        <p className="mt-1.5 text-xs text-cofre-faint">Receitas − Despesas</p>
      </div>
    </>
  )
}
