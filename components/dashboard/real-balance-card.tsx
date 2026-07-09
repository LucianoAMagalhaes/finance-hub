// Dashboard "saldo real" card — how much is actually in the bank this month.
//
// Presentational Server Component. Companion to AccountsBalanceCard: that card
// shows the all-time accounting balance (every expense subtracted, including
// credit-card purchases). This one is scoped to the SELECTED month and leaves
// credit-card purchases OUT, because that money only leaves the account when the
// invoice is paid. Since the previous month's leftover is carried in as income
// (the "Saldo transportado" pair — see CLAUDE.md), the month's
// (receitas − despesas sem crédito) matches the real bank balance.
// `creditThisMonth` is the invoice building up this month, shown as the caption
// that explains what was left out.

import { Money } from '@/components/money'

export function RealBalanceCard({
  realBalance,
  creditThisMonth,
  periodLabel,
}: {
  realBalance: number // cents — income − non-credit expenses, this month
  creditThisMonth: number // cents — credit-card expenses this month
  periodLabel: string
}) {
  return (
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-cofre-muted">
        Saldo real (sem crédito)
      </div>
      <p
        className={`mt-2 text-3xl font-extrabold tracking-tight ${
          realBalance >= 0 ? 'text-cofre-jade' : 'text-cofre-red'
        }`}
      >
        <Money cents={realBalance} />
      </p>
      <p className="mt-1.5 text-xs text-cofre-faint">
        Receitas − despesas sem crédito · {periodLabel}
      </p>

      <p className="mt-2.5 text-[11px] text-cofre-faint">
        Fatura de crédito do mês: <Money cents={creditThisMonth} />
      </p>
    </section>
  )
}
