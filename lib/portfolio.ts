// Portfolio math — pure functions, no I/O.
//
// Role in the architecture: everything the investments screens show about a
// position (how many units, average price, how much is invested, how much it is
// worth today, profit) is DERIVED here from the raw list of operations. Nothing
// of that is stored in the database, so the numbers can never drift from the
// history — the same reasoning behind the derived budget limits in lib/budget.
//
// This file must NOT import Prisma: it runs in Vitest and, if needed, in the
// browser. The page converts Prisma's Decimal columns to plain numbers at the
// boundary (`Number(row.quantity)`) and hands them over.
//
// Units, once and for all (see ADR-007):
//   * quantity        — units, fractional (0.00123456 BTC)
//   * totalCents      — money that actually moved, INTEGER cents
//   * currentPriceCents / avgPriceCents — cents per unit, may be FRACTIONAL
// Tests live in lib/portfolio.test.ts.

import type { AssetType, AssetOperationType, TreasuryKind } from '@/lib/constants'
import { ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from '@/lib/constants'

// Below this, a leftover quantity is floating-point noise, not a holding.
// (0.1 + 0.2 - 0.3 is 5.5e-17 in IEEE-754, not 0.)
export const QUANTITY_EPSILON = 1e-8

/** One buy or sell, already converted to plain numbers. */
export type Operation = {
  type: AssetOperationType
  quantity: number // units, always positive
  totalCents: number // integer cents that moved
  date: Date
  createdAt?: Date // tie-break when two operations share a date
}

/** The asset's own fields (identity + the manually typed quote). */
export type AssetInfo = {
  id: string
  ticker: string
  type: AssetType
  currentPriceCents: number | null // cents per unit, may be fractional
  priceUpdatedAt: Date | null
  // Fixed income only — both null on every other type. The pair IS the bond's
  // identity, and `ticker` above is generated from it (see lib/treasury.ts).
  // Carried through the position so the edit modal can prefill the two fields
  // that actually name the row, instead of a ticker nobody typed.
  treasuryKind: TreasuryKind | null
  maturityDate: Date | null
}

/** What the portfolio screens render for one asset. */
export type Position = AssetInfo & {
  quantity: number
  investedCents: number // cost basis of the units STILL held
  avgPriceCents: number | null // investedCents / quantity; null when closed
  currentValueCents: number | null // null when the asset has no quote
  profitCents: number | null
  profitPercent: number | null
  realizedProfitCents: number // booked on sells
  operationCount: number
  isClosed: boolean
}

export type PortfolioSummary = {
  investedCents: number
  currentValueCents: number
  profitCents: number
  profitPercent: number | null
  realizedProfitCents: number
  assetCount: number
  openCount: number
  unpricedCount: number // open positions with no quote yet
}

export type AllocationSlice = {
  type: AssetType
  label: string
  color: string
  valueCents: number
  percent: number // share of the portfolio value, 0-100
}

/**
 * Builds one position from its operations, using the average-cost method
 * (custo médio) — the Brazilian standard.
 *
 * A buy adds units and cost. A sell removes the PROPORTIONAL slice of the cost
 * (`invested * sold / held`), which is mathematically the same as "quantity ×
 * average price" but never carries a rounded average around, so the average
 * price of the remaining units is left untouched by a sell — the property we
 * want. What the sell earned above (or below) that cost becomes realized
 * profit.
 *
 * The function is total: selling more than the position holds clamps at zero
 * instead of throwing (the Server Action validates and refuses that separately).
 *
 * @param asset - The asset's own fields, including its current quote.
 * @param operations - Its operations, in any order (sorted internally).
 */
export function buildPosition(asset: AssetInfo, operations: Operation[]): Position {
  // Chronological order matters: a sell processed before its buy would clamp
  // to zero and throw the whole cost basis away.
  const ordered = [...operations].sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime()
    if (byDate !== 0) return byDate
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  })

  let quantity = 0
  let investedCents = 0
  let realizedProfitCents = 0

  for (const op of ordered) {
    if (op.type === 'buy') {
      quantity += op.quantity
      investedCents += op.totalCents
      continue
    }

    // Sell: never take out more cost (or more units) than the position has.
    const sold = Math.min(op.quantity, quantity)
    const costOut =
      quantity > QUANTITY_EPSILON ? Math.round(investedCents * (sold / quantity)) : 0

    realizedProfitCents += op.totalCents - costOut
    investedCents -= costOut
    quantity -= sold
  }

  // Snap a fully sold position to exact zeros so rounding dust doesn't show up
  // as a phantom holding worth R$ 0,01.
  const isClosed = quantity <= QUANTITY_EPSILON
  if (isClosed) {
    quantity = 0
    investedCents = 0
  }

  const price = asset.currentPriceCents
  const currentValueCents = price === null ? null : Math.round(quantity * price)
  const profitCents = currentValueCents === null ? null : currentValueCents - investedCents
  const profitPercent =
    profitCents === null || investedCents <= 0
      ? null
      : Math.round((profitCents / investedCents) * 10000) / 100

  return {
    ...asset,
    quantity,
    investedCents,
    avgPriceCents: isClosed ? null : investedCents / quantity,
    currentValueCents,
    profitCents,
    profitPercent,
    realizedProfitCents,
    operationCount: operations.length,
    isClosed,
  }
}

/**
 * Builds every position at once, grouping the operations by asset id.
 *
 * @param assets - All the user's assets.
 * @param operations - All their operations, tagged with the asset they belong to.
 */
export function buildPositions(
  assets: AssetInfo[],
  operations: (Operation & { assetId: string })[],
): Position[] {
  // Group once into a Map (O(1) lookups) instead of filtering per asset.
  const byAsset = new Map<string, Operation[]>()
  for (const op of operations) {
    const list = byAsset.get(op.assetId)
    if (list) list.push(op)
    else byAsset.set(op.assetId, [op])
  }

  return assets.map((asset) => buildPosition(asset, byAsset.get(asset.id) ?? []))
}

/**
 * The unit price of one operation, in cents — what the user actually paid (or
 * received) per unit.
 *
 * It is DERIVED, never stored: the database keeps the quantity and the total
 * that moved, so this can never contradict the history (ADR-007). The result
 * may be fractional, like any price.
 *
 * Takes only the two fields it needs, so a form editing one purchase can call
 * it without assembling a whole Operation.
 *
 * @param operation - Anything carrying a quantity and the total that moved.
 */
export function operationUnitPriceCents(operation: {
  quantity: number
  totalCents: number
}): number {
  // A zero quantity would divide by zero; the schema rejects it, but this
  // function must stay total for whatever the database already holds.
  if (operation.quantity <= QUANTITY_EPSILON) return 0
  return operation.totalCents / operation.quantity
}

/**
 * The value we count a position for in totals and allocation: its market value
 * when there is a quote, otherwise what was paid for it — so an asset the user
 * hasn't priced yet doesn't silently vanish from the portfolio total.
 *
 * @param position - A built position.
 */
export function positionValueCents(position: Position): number {
  return position.currentValueCents ?? position.investedCents
}

/**
 * Adds the positions up into the numbers the overview cards show.
 *
 * @param positions - Every position of the portfolio.
 */
export function summarizePortfolio(positions: Position[]): PortfolioSummary {
  let investedCents = 0
  let currentValueCents = 0
  let realizedProfitCents = 0
  let openCount = 0
  let unpricedCount = 0

  for (const position of positions) {
    investedCents += position.investedCents
    currentValueCents += positionValueCents(position)
    realizedProfitCents += position.realizedProfitCents

    if (!position.isClosed) {
      openCount += 1
      if (position.currentPriceCents === null) unpricedCount += 1
    }
  }

  const profitCents = currentValueCents - investedCents

  return {
    investedCents,
    currentValueCents,
    profitCents,
    profitPercent:
      investedCents > 0 ? Math.round((profitCents / investedCents) * 10000) / 100 : null,
    realizedProfitCents,
    assetCount: positions.length,
    openCount,
    unpricedCount,
  }
}

/**
 * Groups the open positions by asset class for the allocation chart, biggest
 * slice first. Closed positions are left out (they are worth nothing today).
 *
 * @param positions - Every position of the portfolio.
 */
export function allocationByType(positions: Position[]): AllocationSlice[] {
  const totals = new Map<AssetType, number>()

  for (const position of positions) {
    if (position.isClosed) continue
    const value = positionValueCents(position)
    totals.set(position.type, (totals.get(position.type) ?? 0) + value)
  }

  // Array.from (instead of spread) keeps this compatible with the project's
  // TypeScript target, which doesn't down-level Map iterators.
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
  if (total <= 0) return []

  return Array.from(totals.entries())
    .map(([type, valueCents]) => ({
      type,
      label: ASSET_TYPE_LABELS[type],
      color: ASSET_TYPE_COLORS[type],
      valueCents,
      percent: Math.round((valueCents / total) * 1000) / 10,
    }))
    .sort((a, b) => b.valueCents - a.valueCents)
}

/**
 * True when a manually typed quote is old enough to deserve a warning.
 *
 * Takes `now` as a parameter (instead of calling new Date() inside) so it is
 * directly unit-testable — same convention as lib/budget.
 *
 * @param priceUpdatedAt - When the quote was last typed in, or null.
 * @param now - The current moment.
 * @param days - How many days count as stale (default 7).
 */
export function isPriceStale(
  priceUpdatedAt: Date | null,
  now: Date,
  days = 7,
): boolean {
  if (priceUpdatedAt === null) return false
  const elapsed = now.getTime() - priceUpdatedAt.getTime()
  return elapsed > days * 24 * 60 * 60 * 1000
}
