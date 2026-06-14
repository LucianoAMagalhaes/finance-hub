// Dashboard "total em conta" card — the current balance across all accounts.
//
// Presentational Server Component (no "use client"): it receives the already-
// computed total and per-account balances from the dashboard page. This is a
// running total (initial balance + all income − all expenses), so it is NOT
// scoped to the dashboard's selected month.

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
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-200">Total em conta</h2>

      {/* Big headline figure — colored by sign (negative = red). */}
      <p className="mt-1 text-3xl font-bold">
        <Money cents={total} colored />
      </p>

      {accounts.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">
          Nenhuma conta cadastrada. Crie uma em Configurações.
        </p>
      ) : (
        // Per-account breakdown (only worth showing when there's more than one).
        accounts.length > 1 && (
          <ul className="mt-3 space-y-1.5 border-t border-gray-800 pt-3">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-gray-300">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                    aria-hidden
                  />
                  {a.name}
                </span>
                <span className="text-gray-400">
                  <Money cents={a.balance} colored />
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  )
}
