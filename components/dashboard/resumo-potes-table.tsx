// Dashboard "Resumo por pote" table — a compact per-jar summary that replaces
// the old "últimas transações" card (mirrors the reference design).
//
// Presentational Server Component. For each expense jar it shows what was spent,
// what's still available (derived limit − spent), how much of the limit was used
// and the jar's share of total expenses. The "% Utilizado" is colored by the
// same 80% / 100% thresholds used everywhere.

import { Money } from '@/components/money'

export type PoteSummaryRow = {
  categoryId: string
  name: string
  icon: string
  color: string
  limit: number // cents (derived)
  spent: number // cents
}

export function ResumoPotesTable({
  rows,
  totalSpent,
  periodLabel,
}: {
  rows: PoteSummaryRow[]
  totalSpent: number
  periodLabel: string
}) {
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0)

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-cofre-border bg-cofre-card">
      <div className="px-4 pb-2.5 pt-4">
        <div className="text-sm font-bold">Resumo por pote</div>
        <div className="mt-0.5 text-[11px] text-cofre-faint">
          {periodLabel} · veja “Orçamento do mês” abaixo para detalhes
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-cofre-panel text-left">
            {['Pote', 'Gasto', 'Disponível', '% Utilizado', '% Total'].map(
              (h, i) => (
                <th
                  key={h}
                  className={`border-b border-cofre-border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-cofre-faint ${
                    i === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const restante = r.limit - r.spent
            const pctUtil = r.limit > 0 ? (r.spent / r.limit) * 100 : 0
            const pctTotal = totalSpent > 0 ? (r.spent / totalSpent) * 100 : 0
            const pctColor =
              pctUtil >= 100
                ? 'text-cofre-red'
                : pctUtil >= 80
                  ? 'text-cofre-amber'
                  : 'text-cofre-jade'
            return (
              <tr key={r.categoryId} className="border-b border-cofre-border">
                <td className="px-2.5 py-2">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden style={{ color: r.color }}>
                      {r.icon}
                    </span>
                    <span className="font-semibold">{r.name}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-right font-bold">
                  <Money cents={r.spent} />
                </td>
                <td
                  className={`whitespace-nowrap px-2.5 py-2 text-right ${
                    restante >= 0 ? 'text-cofre-muted' : 'text-cofre-red'
                  }`}
                >
                  <Money cents={restante} />
                </td>
                <td className={`px-2.5 py-2 text-right font-bold ${pctColor}`}>
                  {pctUtil.toFixed(0)}%
                </td>
                <td className="px-2.5 py-2 text-right text-cofre-muted">
                  {pctTotal.toFixed(0)}%
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-2.5 py-2 font-bold">Total</td>
            <td className="whitespace-nowrap px-2.5 py-2 text-right font-extrabold">
              <Money cents={totalSpent} />
            </td>
            <td className="whitespace-nowrap px-2.5 py-2 text-right text-cofre-muted">
              <Money cents={totalLimit - totalSpent} />
            </td>
            <td colSpan={2} className="px-2.5 py-2" />
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
