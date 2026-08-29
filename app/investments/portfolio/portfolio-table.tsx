'use client'

// Portfolio table — the Carteira screen's main content, in the spirit of Google
// Finance: one dense list, numbers right-aligned, the result as a colored pill,
// and an arrow on each row that unfolds that ticker's purchases.
//
// "use client": which row is unfolded is browser state. The numbers themselves
// arrive already computed by lib/portfolio (a Server Component did that), so
// this file only decides how to draw them — and the drill-down costs no extra
// query, because the page already sent each row's operations along.
//
// Reading the money columns: "Investido" is the cost basis of the units still
// held; "Valor atual" is quantity × quote; the result is the difference. An
// asset with no quote shows "—" instead of a made-up zero.

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Money } from '@/components/money'
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS, type TreasuryKind } from '@/lib/constants'
import { formatBRL, formatDate, formatPriceBRL, formatQuantity } from '@/lib/format'
import {
  isPriceStale,
  operationUnitPriceCents,
  type Operation,
  type Position,
} from '@/lib/portfolio'
import type { AssetScore } from '@/lib/scoring'
import { AssetRowActions } from './asset-row-actions'
import { ScoreCell } from './score-cell'
import type { ScoreSheetAsset } from './score-sheet'
import { PurchaseRowActions } from './purchase-row-actions'
import { QuoteCell } from './quote-cell'
import { paysCoupons, treasuryNetValue } from '@/lib/treasury'

/** One operation as the drill-down shows it (id included, for the React key). */
export type OperationRow = Operation & { id: string }

/** A position plus the history behind it and its evaluation. */
export type PortfolioRow = Position & {
  operations: OperationRow[]
  score: AssetScore
  sheet: ScoreSheetAsset
}

export function PortfolioTable({ rows, now }: { rows: PortfolioRow[]; now: Date }) {
  // Which ticker is unfolded (its asset id), or null for none. One at a time,
  // like the jar drill-down on the dashboard.
  const [openId, setOpenId] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cofre-borderlight bg-cofre-card p-10 text-center">
        <p className="text-sm font-bold text-cofre-text">Carteira vazia</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-cofre-faint">
          Registre sua primeira compra. A quantidade, o preço médio e a rentabilidade são
          calculados a partir das operações — comprar o mesmo ticker de novo só acrescenta
          uma compra à linha.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-cofre-border bg-cofre-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-cofre-border text-left text-xs uppercase tracking-wider text-cofre-faint">
            <th className="px-4 py-3 font-semibold">Ativo</th>
            <th className="px-4 py-3 text-right font-semibold">Qtd.</th>
            <th className="px-4 py-3 text-right font-semibold">Preço médio</th>
            <th className="px-4 py-3 text-right font-semibold">Investido</th>
            <th className="px-4 py-3 text-right font-semibold">Cotação</th>
            <th className="px-4 py-3 text-right font-semibold">Valor atual</th>
            <th className="px-4 py-3 text-right font-semibold">Resultado</th>
            <th className="px-4 py-3 text-right font-semibold">Nota</th>
            <th className="px-4 py-3" />
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = openId === row.id
            const stale = isPriceStale(row.priceUpdatedAt, now)
            const positive = (row.profitCents ?? 0) >= 0

            return (
              // A keyed Fragment per asset: <tbody> gets the row itself plus,
              // when unfolded, the panel row right underneath it — two sibling
              // <tr>s, which is the only valid way to nest a table row.
              <Fragment key={row.id}>
                <tr
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="cursor-pointer border-b border-cofre-border/60 transition hover:bg-cofre-panel/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>
                        <span className="block font-bold text-cofre-text">
                          {row.ticker}
                        </span>
                        {/* The class label sits under the ticker instead of
                            taking a column of its own — that is what keeps the
                            table narrow enough to read at a glance. The color
                            comes from a constant, but is applied inline
                            because it is a hex, not a Tailwind token. */}
                        <span
                          className="block text-xs font-medium uppercase tracking-wide"
                          style={{ color: ASSET_TYPE_COLORS[row.type] }}
                        >
                          {ASSET_TYPE_LABELS[row.type]}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums text-cofre-muted">
                    {formatQuantity(row.quantity)}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums text-cofre-muted">
                    {row.avgPriceCents === null ? '—' : formatPriceBRL(row.avgPriceCents)}
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums">
                    <Money cents={row.investedCents} />
                  </td>

                  {/* stopPropagation: editing the quote must not fold the row. */}
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <QuoteCell
                      assetId={row.id}
                      ticker={row.ticker}
                      currentPriceCents={row.currentPriceCents}
                      priceUpdatedAt={row.priceUpdatedAt}
                      stale={stale}
                      now={now}
                    />
                  </td>

                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.currentValueCents === null ? (
                      <span className="text-cofre-faint">—</span>
                    ) : (
                      <Money cents={row.currentValueCents} />
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {row.profitCents === null ? (
                      <span className="text-cofre-faint">—</span>
                    ) : (
                      <span
                        className={`inline-flex items-baseline gap-1.5 rounded-full px-2 py-1 text-xs font-semibold tabular-nums ${
                          positive
                            ? 'bg-cofre-jadedim text-cofre-jade'
                            : 'bg-cofre-reddim text-cofre-red'
                        }`}
                      >
                        <span>
                          {positive ? '+' : '−'}
                          {formatBRL(Math.abs(row.profitCents))}
                        </span>
                        {row.profitPercent !== null && (
                          <span className="opacity-80">
                            {positive ? '+' : ''}
                            {row.profitPercent.toLocaleString('pt-BR', {
                              maximumFractionDigits: 2,
                            })}
                            %
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* The evaluation. stopPropagation so opening the sheet does
                      not also fold the row, same as the quote cell above. */}
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ScoreCell asset={row.sheet} score={row.score} />
                  </td>

                  {/* stopPropagation again: Editar/Excluir are not "fold". */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <AssetRowActions
                      asset={{
                        id: row.id,
                        ticker: row.ticker,
                        type: row.type,
                        currentPriceCents: row.currentPriceCents,
                        treasuryKind: row.treasuryKind,
                        maturityDate: row.maturityDate,
                      }}
                      operationCount={row.operationCount}
                    />
                  </td>

                  {/* The fold control closes the row, after the actions. A real
                      button, so the row also folds with the keyboard (a <tr>
                      can't be focused). stopPropagation keeps the click from
                      reaching the row and toggling a second time.

                      The arrow points where the click takes you: DOWN unfolds
                      the purchases below, UP folds them back. */}
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : row.id)}
                      aria-expanded={open}
                      aria-label={`${open ? 'Recolher' : 'Ver'} as compras de ${row.ticker}`}
                      className="rounded-md p-1.5 text-cofre-faint transition hover:bg-cofre-panel hover:text-cofre-text"
                    >
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                </tr>

                {open && (
                  <tr className="border-b border-cofre-border/60">
                    <td colSpan={10} className="bg-cofre-panel px-4 py-4">
                      <OperationsPanel
                        ticker={row.ticker}
                        operations={row.operations}
                        row={row}
                        now={now}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// The unfolded panel: every purchase of that ticker, newest first, as a table
// of its own with each purchase on its own separated line and its own edit and
// delete buttons.
//
// The unit price is derived from the total and the quantity (see ADR-007) — the
// database never stores a price that could contradict the money that moved.
function OperationsPanel({
  ticker,
  operations,
  row,
  now,
}: {
  ticker: string
  operations: OperationRow[]
  row: PortfolioRow
  now: Date
}) {
  if (operations.length === 0) {
    return <p className="text-xs text-cofre-faint">Nenhuma compra registrada.</p>
  }

  const ordered = [...operations].sort((a, b) => b.date.getTime() - a.date.getTime())

  // Only a Tesouro bond has withholding to show. Everything else keeps the plain
  // list of purchases it always had.
  const tax =
    row.treasuryKind === null
      ? null
      : treasuryNetValue(
          row.treasuryKind,
          operations.filter((operation) => operation.type === 'buy'),
          row.currentPriceCents,
          now,
        )

  // The income-tax rate belongs to the PURCHASE, not to the position: a lot
  // bought last month and one bought three years ago are taxed differently.
  const rateByDate = new Map(
    (tax?.lots ?? []).map((lotTax) => [lotTax.date.getTime(), lotTax]),
  )

  return (
    <div className="space-y-3">
    <div className="overflow-hidden rounded-md border border-cofre-border bg-cofre-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-cofre-border text-left uppercase tracking-wider text-cofre-faint">
            <th className="px-3 py-2 font-semibold">Data da Compra</th>
            <th className="px-3 py-2 text-right font-semibold">Preço de Compra</th>
            <th className="px-3 py-2 text-right font-semibold">Quantidade</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            {tax !== null && (
              <th className="px-3 py-2 text-right font-semibold">IR previsto</th>
            )}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {ordered.map((operation) => (
            <tr
              key={operation.id}
              className="border-b border-cofre-border/60 text-cofre-muted last:border-0"
            >
              <td className="px-3 py-2">{formatDate(operation.date)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatPriceBRL(operationUnitPriceCents(operation))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatQuantity(operation.quantity)}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-cofre-text">
                {formatBRL(operation.totalCents)}
              </td>
              {tax !== null && (
                <td className="px-3 py-2 text-right tabular-nums">
                  {(() => {
                    const lotTax = rateByDate.get(operation.date.getTime())
                    if (lotTax === undefined) return <span className="text-cofre-faint">—</span>
                    return (
                      <>
                        {formatBRL(lotTax.irCents)}{' '}
                        <span className="text-cofre-faint">
                          ({(lotTax.irRate * 100).toLocaleString('pt-BR', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                          % · {lotTax.days}d)
                        </span>
                      </>
                    )
                  })()}
                </td>
              )}
              <td className="px-3 py-1.5">
                <PurchaseRowActions
                  purchase={{
                    id: operation.id,
                    quantity: operation.quantity,
                    totalCents: operation.totalCents,
                    date: operation.date,
                  }}
                  ticker={ticker}
                  isLast={operations.length === 1}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

      {tax !== null && <NetValuePanel tax={tax} kind={row.treasuryKind!} />}
    </div>
  )
}

// What a Tesouro position would actually pay out today: the gross value minus
// everything withheld on a redemption.
//
// This lives in the unfolded panel and NOT in the "Resultado" column on purpose.
// That column has to mean one thing across every row, so a bond and a share stay
// comparable in it — and for a share there is no withholding to net out. The tax
// only makes sense once you are looking at this bond in particular.
//
// Every number here is an ESTIMATE, and the footnote says so. The custody fee
// accrues daily on a price that moved every one of those days, which no stored
// data can reproduce; income tax is exact in its rate but assumes a redemption
// TODAY, at today's price.
function NetValuePanel({
  tax,
  kind,
}: {
  tax: NonNullable<ReturnType<typeof treasuryNetValue>>
  kind: TreasuryKind
}) {
  const line = (label: string, cents: number, negative = false) => (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-cofre-muted">{label}</span>
      <span className="tabular-nums text-cofre-text">
        {negative && cents > 0 ? '− ' : ''}
        {formatBRL(cents)}
      </span>
    </div>
  )

  return (
    <div className="rounded-md border border-cofre-border bg-cofre-card p-3 text-xs">
      <p className="mb-2 font-semibold uppercase tracking-wider text-cofre-faint">
        Se resgatasse hoje
      </p>

      <div className="space-y-1">
        {line('Valor bruto', tax.grossCents)}
        {tax.iofCents > 0 && line('IOF', tax.iofCents, true)}
        {line('Imposto de renda', tax.irCents, true)}
        {line('Taxa de custódia B3', tax.custodyCents, true)}

        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-cofre-border pt-2">
          <span className="font-semibold text-cofre-text">Valor líquido</span>
          <span className="font-semibold tabular-nums text-cofre-text">
            {formatBRL(tax.netCents)}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-cofre-muted">Resultado líquido</span>
          <Money cents={tax.netCents - tax.investedCents} colored />
        </div>
      </div>

      <p className="mt-3 text-cofre-faint">
        IR e taxa B3 são <strong>previstos</strong>: assumem resgate hoje, ao preço de
        hoje. A taxa de custódia é uma estimativa — ela acumula todo dia sobre um preço
        que variou.
      </p>

      {/* The one case where the number on screen is knowably too low. */}
      {paysCoupons(kind) && (
        <p className="mt-2 rounded bg-cofre-amberdim px-2 py-1.5 text-cofre-amber">
          Este título paga juros semestrais e o app não registra cupons recebidos — o
          resultado acima está menor que o real.
        </p>
      )}
    </div>
  )
}
