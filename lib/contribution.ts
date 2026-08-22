// Contribution planner — pure functions, no I/O.
//
// Role in the architecture: given how much the user is about to invest, this
// decides how much goes into each asset. It is the point where the two previous
// pieces meet — the allocation plan (lib/allocation) and the asset score
// (lib/scoring) — and it is the reason both of them exist.
//
// The rule, decided with the user and recorded in ADR-009, is the same on both
// levels: SOMETHING defines a target, and the new money goes to whoever is
// furthest BELOW their own target.
//
//   Level 1 — between TYPES.  The weight is the allocation plan (40% Ação BR…).
//   Level 2 — between ASSETS of a type.  The weight is the asset's score.
//
// Two consequences worth spelling out, because they are the whole point:
//   * a type or an asset already ABOVE its target receives nothing, so an aporte
//     rebalances the portfolio on its own and never has to suggest a sale;
//   * a high score does not, by itself, attract money — a great asset that is
//     already oversized waits, and the money goes to the great asset that is
//     underweight.
//
// This file must NOT import Prisma: it runs in Vitest and in the browser (the
// planner screen recomputes on every keystroke, with no round trip).
// Tests live in lib/contribution.test.ts.

import { ASSET_TYPES, type AssetType } from '@/lib/constants'
import { scoreWeight, type AssetScore } from '@/lib/scoring'
import { positionValueCents, type Position } from '@/lib/portfolio'

/** Why an asset got nothing, when it got nothing. */
export type SkipReason =
  | 'no-score' // never evaluated
  | 'non-positive-score' // evaluated, but 0 or negative: only positives attract money
  | 'on-target' // good and scored, but already at or above its share
  | 'below-minimum' // its slice came out under the minimum per asset

export type AssetAllocation = {
  assetId: string
  ticker: string
  type: AssetType
  score: number | null
  /** The share of the type this asset's score entitles it to, 0-100. */
  weightPercent: number
  currentValueCents: number
  targetValueCents: number
  gapCents: number
  amountCents: number
  /** amountCents / quote, so the user knows how many units to buy. */
  quantityHint: number | null
  skipped?: SkipReason
}

export type TypeAllocation = {
  type: AssetType
  targetPercent: number
  currentValueCents: number
  currentPercent: number
  targetValueCents: number
  gapCents: number
  amountCents: number
  assets: AssetAllocation[]
  /** The type is owed money but has no asset that can take it. */
  warning?: 'no-eligible-assets'
}

export type ContributionPlan = {
  amountCents: number
  /** What actually landed on an asset. */
  allocatedCents: number
  /** Reserved for a type with nothing to buy — the user picks the paper. */
  unallocatedCents: number
  portfolioValueCents: number
  projectedValueCents: number
  types: TypeAllocation[]
  /** Sum of the plan's percentages; the UI warns when it is not 100. */
  targetsSum: number
}

export type ContributionInput = {
  positions: Position[]
  scores: Map<string, AssetScore>
  targets: Record<AssetType, number>
  amountCents: number
  /** Below this, a suggestion is not worth acting on. Default R$ 100,00. */
  minPerAssetCents?: number
}

export const DEFAULT_MIN_PER_ASSET_CENTS = 10_000

/** One thing competing for money: what it holds now and what it is worth. */
type GapItem = { key: string; currentCents: number; weight: number }

/**
 * THE primitive, used identically on both levels.
 *
 * Every item gets a target proportional to its weight, computed over the pool
 * AFTER the contribution lands. Whatever is missing from that target is its
 * gap, and the money is split across the gaps.
 *
 * Because the targets are computed over the post-contribution pool, the gaps
 * always add up to at least the contribution itself, so the money always has
 * somewhere to go (proof: sum(target) − sum(current) = amount, and clamping the
 * negatives at zero only makes the total larger).
 *
 * @param amountCents - Integer cents to split.
 * @param items - Who is competing, with what they already hold and their weight.
 * @returns Per key: the target, the gap and the cents awarded.
 */
export function allocateByGap(
  amountCents: number,
  items: GapItem[],
): Map<string, { targetCents: number; gapCents: number; amountCents: number }> {
  const result = new Map<
    string,
    { targetCents: number; gapCents: number; amountCents: number }
  >()

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  const currentTotal = items.reduce((sum, item) => sum + item.currentCents, 0)

  // Nobody is eligible: hand back zeros and let the caller report the money as
  // unallocated rather than forcing it somewhere arbitrary.
  if (totalWeight <= 0) {
    for (const item of items) {
      result.set(item.key, { targetCents: 0, gapCents: 0, amountCents: 0 })
    }
    return result
  }

  const pool = currentTotal + amountCents

  // Targets normalize by the weights, so a plan summing to 90% or 110% still
  // produces a coherent split — the UI warns, the arithmetic does not break.
  const gaps = items.map((item) => {
    const targetCents = Math.round((pool * item.weight) / totalWeight)
    return { ...item, targetCents, gapCents: Math.max(0, targetCents - item.currentCents) }
  })

  const totalGap = gaps.reduce((sum, item) => sum + item.gapCents, 0)

  if (totalGap <= 0 || amountCents <= 0) {
    for (const item of gaps) {
      result.set(item.key, {
        targetCents: item.targetCents,
        gapCents: item.gapCents,
        amountCents: 0,
      })
    }
    return result
  }

  // Floor everything, then hand the rounding leftovers to the biggest gaps. The
  // total therefore matches the contribution TO THE CENT — money is integer
  // cents in this app (ADR-005), and a planner that loses three centavos to
  // rounding is a planner the user stops trusting.
  let distributed = 0
  for (const item of gaps) {
    const share = Math.floor((amountCents * item.gapCents) / totalGap)
    result.set(item.key, {
      targetCents: item.targetCents,
      gapCents: item.gapCents,
      amountCents: share,
    })
    distributed += share
  }

  let leftover = amountCents - distributed
  const byGap = [...gaps].sort((a, b) => b.gapCents - a.gapCents)
  for (const item of byGap) {
    if (leftover <= 0) break
    if (item.gapCents <= 0) continue
    const current = result.get(item.key)!
    current.amountCents += 1
    leftover -= 1
  }

  return result
}

/**
 * Applies the "don't bother me with R$ 3,47" rule.
 *
 * Anything under the minimum is dropped and its money is re-split among the
 * survivors by the same gap rule. That can push another asset under the
 * minimum, so it repeats — bounded by the number of items, since each pass
 * removes at least one.
 *
 * When NOTHING clears the minimum (a contribution smaller than the minimum
 * itself), the single largest gap takes the whole amount: one actionable
 * suggestion beats a page of dust.
 *
 * @param amountCents - The type's money.
 * @param items - The eligible assets of that type.
 * @param minPerAssetCents - The floor for a single suggestion.
 */
function allocateWithMinimum(
  amountCents: number,
  items: GapItem[],
  minPerAssetCents: number,
): Map<string, { targetCents: number; gapCents: number; amountCents: number }> {
  // The split before anyone is dropped. It is what the re-added rows keep, so a
  // dropped asset still reports its REAL gap — otherwise it would come back
  // with gap 0 and read as "already on target", which is the opposite of why it
  // was dropped.
  const baseline = allocateByGap(amountCents, items)

  let eligible = items
  let allocation = baseline

  if (minPerAssetCents <= 0 || amountCents <= 0) return allocation

  for (let pass = 0; pass < items.length; pass++) {
    const funded = eligible.filter((item) => (allocation.get(item.key)?.amountCents ?? 0) > 0)
    const tooSmall = funded.filter(
      (item) => (allocation.get(item.key)?.amountCents ?? 0) < minPerAssetCents,
    )
    // Everyone funded clears the bar (or nobody is funded at all).
    if (tooSmall.length === 0 || funded.length === 0) break

    // Everything is below the bar: concentrate on the neediest instead of
    // spreading dust. Ties break on the larger weight, then the key, so the
    // same inputs always give the same answer.
    if (tooSmall.length === funded.length) {
      const winner = [...funded].sort((a, b) => {
        const gapDiff = (allocation.get(b.key)?.gapCents ?? 0) - (allocation.get(a.key)?.gapCents ?? 0)
        if (gapDiff !== 0) return gapDiff
        if (b.weight !== a.weight) return b.weight - a.weight
        return a.key.localeCompare(b.key)
      })[0]
      eligible = eligible.filter((item) => item.key === winner.key)
      allocation = allocateByGap(amountCents, eligible)
      break
    }

    // Drop the smallest suggestion and re-split among the rest.
    const smallest = tooSmall.sort(
      (a, b) => (allocation.get(a.key)?.amountCents ?? 0) - (allocation.get(b.key)?.amountCents ?? 0),
    )[0]
    eligible = eligible.filter((item) => item.key !== smallest.key)
    if (eligible.length === 0) break
    allocation = allocateByGap(amountCents, eligible)
  }

  // Re-add the dropped ones with zero cents but their original target and gap,
  // so the caller can show them with the right reason instead of silently
  // losing rows.
  const final = new Map(allocation)
  for (const item of items) {
    if (!final.has(item.key)) {
      const original = baseline.get(item.key)
      final.set(item.key, {
        targetCents: original?.targetCents ?? 0,
        gapCents: original?.gapCents ?? 0,
        amountCents: 0,
      })
    }
  }
  return final
}

/**
 * Builds the whole suggestion: the contribution split by type, then by asset.
 *
 * @param input - Positions, scores, the allocation plan and the amount.
 */
export function planContribution(input: ContributionInput): ContributionPlan {
  const { positions, scores, targets, amountCents } = input
  const minPerAssetCents = input.minPerAssetCents ?? DEFAULT_MIN_PER_ASSET_CENTS

  // A fully sold ticker is out: its gap would be its entire target and it would
  // swallow the contribution for something the user deliberately exited.
  const open = positions.filter((position) => !position.isClosed)

  const byType = new Map<AssetType, Position[]>()
  for (const position of open) {
    const list = byType.get(position.type)
    if (list) list.push(position)
    else byType.set(position.type, [position])
  }

  const typeValue = (type: AssetType) =>
    (byType.get(type) ?? []).reduce((sum, position) => sum + positionValueCents(position), 0)

  const portfolioValueCents = ASSET_TYPES.reduce((sum, type) => sum + typeValue(type), 0)
  const targetsSum = ASSET_TYPES.reduce((sum, type) => sum + targets[type], 0)

  // --- Level 1: split between the types -------------------------------------
  const typeSplit = allocateByGap(
    amountCents,
    ASSET_TYPES.map((type) => ({
      key: type,
      currentCents: typeValue(type),
      weight: targets[type],
    })),
  )

  let allocatedCents = 0
  let unallocatedCents = 0

  const types: TypeAllocation[] = ASSET_TYPES.map((type) => {
    const split = typeSplit.get(type)!
    const currentValueCents = typeValue(type)
    const typeAmount = split.amountCents
    const members = byType.get(type) ?? []

    // --- Level 2: split between the assets of this type ---------------------
    // Only a POSITIVE score attracts money (ADR-009). Everyone else stays on
    // screen with the reason, so nothing silently disappears.
    const eligible: GapItem[] = []
    for (const position of members) {
      const weight = scoreWeight(scores.get(position.id))
      if (weight > 0) {
        eligible.push({
          key: position.id,
          currentCents: positionValueCents(position),
          weight,
        })
      }
    }

    const assetSplit =
      eligible.length > 0
        ? allocateWithMinimum(typeAmount, eligible, minPerAssetCents)
        : new Map<string, { targetCents: number; gapCents: number; amountCents: number }>()

    const eligibleWeight = eligible.reduce((sum, item) => sum + item.weight, 0)

    const assets: AssetAllocation[] = members
      .map((position) => {
        const score = scores.get(position.id)
        const weight = scoreWeight(score)
        const split = assetSplit.get(position.id)
        const currentValueCents = positionValueCents(position)
        const assetAmount = split?.amountCents ?? 0

        let skipped: SkipReason | undefined
        if (assetAmount === 0) {
          if (!score || score.value === null) skipped = 'no-score'
          else if (weight === 0) skipped = 'non-positive-score'
          else if ((split?.gapCents ?? 0) <= 0) skipped = 'on-target'
          else skipped = 'below-minimum'
        }

        return {
          assetId: position.id,
          ticker: position.ticker,
          type,
          score: score?.value ?? null,
          weightPercent:
            eligibleWeight > 0 ? Math.round((weight / eligibleWeight) * 1000) / 10 : 0,
          currentValueCents,
          targetValueCents: split?.targetCents ?? 0,
          gapCents: split?.gapCents ?? 0,
          amountCents: assetAmount,
          // Fractional shares are normal here (crypto especially), so this is a
          // hint, not a rounded lot.
          quantityHint:
            position.currentPriceCents && position.currentPriceCents > 0 && assetAmount > 0
              ? assetAmount / position.currentPriceCents
              : null,
          skipped,
        }
      })
      // Biggest suggestion first; the skipped ones sink, ordered by score.
      .sort(
        (a, b) =>
          b.amountCents - a.amountCents ||
          (b.score ?? -Infinity) - (a.score ?? -Infinity) ||
          a.ticker.localeCompare(b.ticker),
      )

    const placed = assets.reduce((sum, asset) => sum + asset.amountCents, 0)
    allocatedCents += placed
    unallocatedCents += typeAmount - placed

    return {
      type,
      targetPercent: targets[type],
      currentValueCents,
      currentPercent:
        portfolioValueCents > 0
          ? Math.round((currentValueCents / portfolioValueCents) * 1000) / 10
          : 0,
      targetValueCents: split.targetCents,
      gapCents: split.gapCents,
      amountCents: typeAmount,
      assets,
      // The plan asks for this type and the money is reserved, but there is no
      // asset able to take it. Deliberately NOT redistributed: "R$ 541 vão para
      // Renda Fixa, escolha o papel" is a useful answer, and quietly pushing
      // that money into stocks would not be.
      warning: typeAmount > 0 && placed === 0 ? 'no-eligible-assets' : undefined,
    }
  })

  return {
    amountCents,
    allocatedCents,
    unallocatedCents,
    portfolioValueCents,
    projectedValueCents: portfolioValueCents + amountCents,
    types,
    targetsSum,
  }
}
