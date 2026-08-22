// Portfolio page — route "/investments/portfolio" (the "Carteira" screen).
//
// This is a Server Component (no "use client"): it runs on the server, queries
// the database with Prisma and passes plain data down. Nothing about the
// position is stored — quantity, average price and profit are all computed here
// by lib/portfolio from the raw operations, so the numbers can never drift from
// the history.
//
// Two Prisma columns are Decimal (quantity and the quote — see ADR-007). Decimal
// is a Decimal.js object, which cannot cross into a Client Component, so this
// page converts both with Number(...) right at the boundary.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { Money } from '@/components/money'
import {
  allocationByType,
  buildPositions,
  positionValueCents,
  summarizePortfolio,
  type AssetInfo,
} from '@/lib/portfolio'
import { AllocationChart } from './allocation-chart'
import { NewPurchaseButton } from './new-purchase-button'
import { PortfolioTable, type OperationRow, type PortfolioRow } from './portfolio-table'

// Always render fresh data: the table changes on every asset or operation the
// user records, and the actions revalidate this path.
export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const user = await getLocalUser()

  // Both queries run in parallel — they don't depend on each other.
  const [assets, operations] = await Promise.all([
    prisma.asset.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ticker: true,
        type: true,
        currentPriceCents: true,
        priceUpdatedAt: true,
      },
      orderBy: { ticker: 'asc' },
    }),
    prisma.assetOperation.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        assetId: true,
        type: true,
        quantity: true,
        totalCents: true,
        date: true,
        createdAt: true,
      },
    }),
  ])

  // Decimal -> number, once, here at the edge.
  const assetInfos: AssetInfo[] = assets.map((asset) => ({
    ...asset,
    currentPriceCents:
      asset.currentPriceCents === null ? null : Number(asset.currentPriceCents),
  }))

  const operationInputs: (OperationRow & { assetId: string })[] = operations.map(
    (op) => ({ ...op, quantity: Number(op.quantity) }),
  )

  const positions = buildPositions(assetInfos, operationInputs)
  const summary = summarizePortfolio(positions)

  // Group the operations by asset once, so each row already carries its own
  // history: unfolding a ticker in the table costs no extra query (the same
  // trick the dashboard uses for the jar drill-down).
  const byAsset = new Map<string, OperationRow[]>()
  for (const operation of operationInputs) {
    const list = byAsset.get(operation.assetId)
    if (list) list.push(operation)
    else byAsset.set(operation.assetId, [operation])
  }

  // Biggest position first; fully sold ones sink to the bottom.
  const rows: PortfolioRow[] = [...positions]
    .sort((a, b) => positionValueCents(b) - positionValueCents(a))
    .map((position) => ({
      ...position,
      operations: byAsset.get(position.id) ?? [],
    }))

  const now = new Date()

  // The split by type, for the pie beside the table. Open positions only — a
  // fully sold ticker is worth nothing today, so it has no slice.
  const slices = allocationByType(positions)

  return (
    // Full width, unlike the other screens' max-w-6xl: this table has nine
    // columns and a chart beside it, and capping the width was what pushed the
    // table into a horizontal scrollbar while the right side sat empty.
    <main className="p-6 lg:p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Carteira</h1>
          <p className="mt-1 text-sm text-cofre-muted">
            Seus ativos, com quantidade, preço médio e valor atual. Clique na
            seta para ver as compras do ticker.
          </p>
        </div>
        <NewPurchaseButton />
      </header>

      {rows.length > 0 && (
        <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cofre-muted">
              Investido
            </div>
            <p className="text-2xl font-extrabold tracking-tight">
              <Money cents={summary.investedCents} />
            </p>
            <p className="mt-1.5 text-xs text-cofre-faint">
              {summary.openCount} ativo{summary.openCount === 1 ? '' : 's'} em carteira
            </p>
          </div>

          <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cofre-muted">
              Valor atual
            </div>
            <p className="text-2xl font-extrabold tracking-tight">
              <Money cents={summary.currentValueCents} />
            </p>
            <p className="mt-1.5 text-xs text-cofre-faint">
              {summary.unpricedCount > 0
                ? `${summary.unpricedCount} sem cotação (contam pelo custo)`
                : 'todas as cotações informadas'}
            </p>
          </div>

          <div className="rounded-lg border border-cofre-border bg-cofre-card p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cofre-muted">
              Resultado
            </div>
            <p className="text-2xl font-extrabold tracking-tight">
              <Money cents={summary.profitCents} colored />
            </p>
            <p className="mt-1.5 text-xs text-cofre-faint">
              {summary.profitPercent === null
                ? 'sem base de custo'
                : `${summary.profitPercent > 0 ? '+' : ''}${summary.profitPercent.toLocaleString(
                    'pt-BR',
                    { maximumFractionDigits: 2 },
                  )}% sobre o investido`}
            </p>
          </div>
        </section>
      )}

      {/* Table and pie side by side on a wide screen, stacked on a narrow one.
          minmax(0,1fr) (instead of plain 1fr) is what lets the table's own
          horizontal scroll work inside the grid: a bare 1fr track refuses to
          shrink below its content and the whole page would scroll instead. */}
      <div
        className={
          slices.length > 0
            ? 'grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]'
            : ''
        }
      >
        <PortfolioTable rows={rows} now={now} />
        {slices.length > 0 && <AllocationChart slices={slices} />}
      </div>
    </main>
  )
}
