// Dashboard "total em conta" card — the current balance across all accounts.
//
// Presentational Server Component. Receives the already-computed total and
// per-account balances from the dashboard page. This is a running total (initial
// balance + all income − all expenses), so it is NOT scoped to the selected
// month. Styled in the "cofre" palette with a jade-tinted gradient to stand out
// as the headline figure.

import { Money } from '@/components/money'
import type { AccountBalance } from '@/lib/account'

export function AccountsBalanceCard({
  total,
  accounts,
}: {
  total: number
  accounts: AccountBalance[]
}) {
  return (
    <section
      className="rounded-lg border border-cofre-jadedim bg-cofre-card p-5"
      style={{
        backgroundImage:
          'linear-gradient(135deg, #20262B 0%, #1A2B22 100%)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-cofre-muted">
        Total em conta
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-cofre-jade">
        <Money cents={total} />
      </p>

      {accounts.length === 0 ? (
        <p className="mt-3 text-sm text-cofre-faint">
          Nenhuma conta cadastrada. Crie uma em Configurações.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {accounts.map((a) => (
            <div key={a.id}>
              <div className="text-[11px] text-cofre-faint">{a.name}</div>
              <div className="text-[13px] font-bold">
                <Money cents={a.balance} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2.5 text-[11px] text-cofre-faint">
        Saldo histórico — não filtrado pelo período
      </p>
    </section>
  )
}
