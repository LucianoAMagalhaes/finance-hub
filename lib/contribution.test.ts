import { describe, it, expect } from 'vitest'
import {
  allocateByGap,
  planContribution,
  DEFAULT_MIN_PER_ASSET_CENTS,
  type ContributionInput,
} from '@/lib/contribution'
import type { AssetScore } from '@/lib/scoring'
import type { Position } from '@/lib/portfolio'
import { ASSET_TYPES, type AssetType } from '@/lib/constants'

// --- fixtures ---------------------------------------------------------------

const R$ = (reais: number) => reais * 100

/** A position worth exactly `valueCents`, priced at R$ 1,00 per unit. */
function position(
  id: string,
  ticker: string,
  type: AssetType,
  valueCents: number,
  options: { priced?: boolean; closed?: boolean } = {},
): Position {
  const priced = options.priced ?? true
  return {
    id,
    ticker,
    type,
    currentPriceCents: priced ? 100 : null,
    priceUpdatedAt: null,
    treasuryKind: null,
    maturityDate: null,
    quantity: options.closed ? 0 : valueCents / 100,
    investedCents: options.closed ? 0 : valueCents,
    avgPriceCents: options.closed ? null : 100,
    currentValueCents: priced ? valueCents : null,
    profitCents: priced ? 0 : null,
    profitPercent: priced ? 0 : null,
    realizedProfitCents: 0,
    operationCount: 1,
    isClosed: options.closed ?? false,
  }
}

function score(assetId: string, value: number | null): AssetScore {
  return {
    assetId,
    value,
    source: 'checklist',
    yes: 0,
    no: 0,
    answered: value === null ? 0 : 1,
    total: 10,
  }
}

function scoreMap(entries: [string, number | null][]): Map<string, AssetScore> {
  return new Map(entries.map(([id, value]) => [id, score(id, value)]))
}

function targets(partial: Partial<Record<AssetType, number>>): Record<AssetType, number> {
  const base = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<AssetType, number>
  return { ...base, ...partial }
}

/** The worked example used to design the feature. */
function workedExample(overrides: Partial<ContributionInput> = {}): ContributionInput {
  return {
    positions: [
      position('p1', 'PETR4', 'stock_br', R$(2000)),
      position('p2', 'ITUB4', 'stock_br', R$(2400)),
      position('p3', 'WEGE3', 'stock_br', R$(1600)),
      position('p4', 'MXRF11', 'fii', R$(2000)),
      position('p5', 'HGLG11', 'fii', R$(1000)),
      position('p6', 'BTC', 'crypto', R$(1000)),
    ],
    scores: scoreMap([
      ['p1', 8], ['p2', 7], ['p3', 5],
      ['p4', 6], ['p5', 9],
      ['p6', 7],
    ]),
    targets: targets({ stock_br: 40, stock_intl: 10, fii: 30, crypto: 5, fixed_income: 15 }),
    amountCents: R$(1000),
    minPerAssetCents: 0, // the minimum has its own tests
    ...overrides,
  }
}

const typeOf = (plan: ReturnType<typeof planContribution>, type: AssetType) =>
  plan.types.find((t) => t.type === type)!
const assetOf = (plan: ReturnType<typeof planContribution>, ticker: string) =>
  plan.types.flatMap((t) => t.assets).find((a) => a.ticker === ticker)!

// --- allocateByGap ----------------------------------------------------------

describe('allocateByGap', () => {
  it('sends everything to the one that is behind', () => {
    // A holds 2000 and B holds 1000 with equal weight; 1000 lands. The pool
    // becomes 4000, so each target is 2000 — A is already there, B is 1000 short.
    const result = allocateByGap(1000, [
      { key: 'a', currentCents: 2000, weight: 1 },
      { key: 'b', currentCents: 1000, weight: 1 },
    ])

    expect(result.get('a')!.amountCents).toBe(0)
    expect(result.get('b')!.amountCents).toBe(1000)
  })

  it('never loses a cent to rounding', () => {
    // 1000 across three equal gaps is 333.33 each — the leftover cent has to go
    // somewhere, and the total must still be exactly 1000.
    const result = allocateByGap(1000, [
      { key: 'a', currentCents: 0, weight: 1 },
      { key: 'b', currentCents: 0, weight: 1 },
      { key: 'c', currentCents: 0, weight: 1 },
    ])

    const total = Array.from(result.values()).reduce((sum, item) => sum + item.amountCents, 0)
    expect(total).toBe(1000)
  })

  it('distributes nothing when no one has weight', () => {
    const result = allocateByGap(1000, [
      { key: 'a', currentCents: 500, weight: 0 },
      { key: 'b', currentCents: 500, weight: 0 },
    ])

    expect(Array.from(result.values()).every((item) => item.amountCents === 0)).toBe(true)
  })

  it('gives nothing away when the amount is zero, but still reports the gaps', () => {
    const result = allocateByGap(0, [
      { key: 'a', currentCents: 0, weight: 1 },
      { key: 'b', currentCents: 1000, weight: 1 },
    ])

    expect(result.get('a')!.amountCents).toBe(0)
    expect(result.get('a')!.gapCents).toBe(500) // half of the 1000 pool
  })

  it('normalizes weights, so a plan that does not sum to 100 still works', () => {
    const ninety = allocateByGap(1000, [
      { key: 'a', currentCents: 0, weight: 45 },
      { key: 'b', currentCents: 0, weight: 45 },
    ])
    const hundred = allocateByGap(1000, [
      { key: 'a', currentCents: 0, weight: 50 },
      { key: 'b', currentCents: 0, weight: 50 },
    ])

    expect(ninety.get('a')!.amountCents).toBe(hundred.get('a')!.amountCents)
  })
})

// --- planContribution: the worked example ----------------------------------

describe('planContribution — level 1, between types', () => {
  const plan = planContribution(workedExample())

  it('starves the types that are already above their target', () => {
    // Portfolio 10.000 + 1.000 = 11.000. Ação BR wants 40% = 4.400 but holds
    // 6.000; crypto wants 5% = 550 but holds 1.000. Both are done.
    expect(typeOf(plan, 'stock_br').amountCents).toBe(0)
    expect(typeOf(plan, 'crypto').amountCents).toBe(0)
  })

  it('feeds the types that are behind, proportionally to how far behind', () => {
    // Gaps: intl 1.100, fii 300, RF 1.650 => 3.050 total.
    // 1000 × 1100/3050 = 360,65 | × 300/3050 = 98,36 | × 1650/3050 = 540,98
    // Flooring those loses one cent, which goes to the biggest gap (RF).
    expect(typeOf(plan, 'stock_intl').amountCents).toBe(36065)
    expect(typeOf(plan, 'fii').amountCents).toBe(9836)
    expect(typeOf(plan, 'fixed_income').amountCents).toBe(54099)
  })

  it('accounts for every cent of the contribution', () => {
    expect(plan.allocatedCents + plan.unallocatedCents).toBe(R$(1000))
  })

  it('reports the portfolio before and after', () => {
    expect(plan.portfolioValueCents).toBe(R$(10000))
    expect(plan.projectedValueCents).toBe(R$(11000))
    expect(plan.targetsSum).toBe(100)
  })
})

describe('planContribution — level 2, between assets of a type', () => {
  const plan = planContribution(workedExample())

  it('gives the whole slice to the good asset that is underweight', () => {
    // FIIs get 98,36. Scores 6 and 9 => MXRF11 deserves 40% and HGLG11 60% of
    // the 3.098,36 pool: 1.239 and 1.859. MXRF11 already holds 2.000 (over),
    // HGLG11 holds 1.000 (859 short). All of it goes to HGLG11.
    expect(assetOf(plan, 'HGLG11').amountCents).toBe(9836)
    expect(assetOf(plan, 'MXRF11').amountCents).toBe(0)
    expect(assetOf(plan, 'MXRF11').skipped).toBe('on-target')
  })

  it('reports the share each score entitles the asset to', () => {
    expect(assetOf(plan, 'HGLG11').weightPercent).toBe(60)
    expect(assetOf(plan, 'MXRF11').weightPercent).toBe(40)
  })

  it('suggests how many units to buy', () => {
    // 9836 cents at a quote of 100 cents per unit.
    expect(assetOf(plan, 'HGLG11').quantityHint).toBeCloseTo(98.36, 2)
  })

  it('leaves the quantity open when the asset has no quote', () => {
    const plan = planContribution(
      workedExample({
        positions: [
          position('p4', 'MXRF11', 'fii', R$(2000)),
          position('p5', 'HGLG11', 'fii', R$(1000), { priced: false }),
        ],
        // This portfolio is FIIs only, so the plan has to be FIIs only too —
        // against the worked example's 30% they would be far overweight and
        // correctly receive nothing.
        targets: targets({ fii: 100 }),
      }),
    )

    expect(assetOf(plan, 'HGLG11').amountCents).toBeGreaterThan(0)
    expect(assetOf(plan, 'HGLG11').quantityHint).toBeNull()
  })
})

// --- who is excluded, and why ----------------------------------------------

describe('planContribution — exclusions', () => {
  it('keeps an unevaluated asset out, saying so', () => {
    const plan = planContribution(
      workedExample({
        scores: scoreMap([['p4', null], ['p5', 9], ['p1', 8], ['p2', 7], ['p3', 5], ['p6', 7]]),
      }),
    )

    expect(assetOf(plan, 'MXRF11').amountCents).toBe(0)
    expect(assetOf(plan, 'MXRF11').skipped).toBe('no-score')
  })

  it('keeps a neutral or negative score out, saying so', () => {
    const neutral = planContribution(
      workedExample({
        scores: scoreMap([['p4', 0], ['p5', 9], ['p1', 8], ['p2', 7], ['p3', 5], ['p6', 7]]),
      }),
    )
    const negative = planContribution(
      workedExample({
        scores: scoreMap([['p4', -3], ['p5', 9], ['p1', 8], ['p2', 7], ['p3', 5], ['p6', 7]]),
      }),
    )

    expect(neutral.types.flatMap((t) => t.assets).find((a) => a.ticker === 'MXRF11')!.skipped)
      .toBe('non-positive-score')
    expect(negative.types.flatMap((t) => t.assets).find((a) => a.ticker === 'MXRF11')!.skipped)
      .toBe('non-positive-score')
  })

  it('ignores a fully sold position entirely', () => {
    // WEGE3 is closed. If it counted, its gap would be its whole target and it
    // would swallow the money for something the user deliberately exited.
    const plan = planContribution(
      workedExample({
        positions: [
          position('p1', 'PETR4', 'stock_br', R$(1000)),
          position('p3', 'WEGE3', 'stock_br', 0, { closed: true }),
        ],
        scores: scoreMap([['p1', 8], ['p3', 10]]),
        targets: targets({ stock_br: 100 }),
      }),
    )

    expect(assetOf(plan, 'PETR4').amountCents).toBe(R$(1000))
    expect(plan.types.flatMap((t) => t.assets).some((a) => a.ticker === 'WEGE3')).toBe(false)
  })

  it('reserves the money of a planned type that has nothing to buy', () => {
    // Renda Fixa is 15% of the plan and the portfolio holds none of it.
    const plan = planContribution(workedExample())
    const rf = typeOf(plan, 'fixed_income')

    expect(rf.amountCents).toBe(54099)
    expect(rf.warning).toBe('no-eligible-assets')
    expect(rf.assets).toHaveLength(0)
    // Reserved, NOT quietly pushed into stocks.
    expect(plan.unallocatedCents).toBeGreaterThanOrEqual(54099)
  })

  it('allocates nothing at all when no asset is evaluated', () => {
    const plan = planContribution(
      workedExample({ scores: new Map(), minPerAssetCents: 0 }),
    )

    expect(plan.allocatedCents).toBe(0)
    expect(plan.unallocatedCents).toBe(R$(1000))
  })
})

// --- the minimum per asset --------------------------------------------------

describe('planContribution — minimum per asset', () => {
  it('drops the crumbs and re-splits among the survivors', () => {
    // Three empty assets, R$ 300 to split. Even thirds are R$ 100 — exactly the
    // minimum — so raising the bar to R$ 150 must concentrate on fewer names.
    const base = {
      positions: [
        position('a', 'AAA', 'fii', 0),
        position('b', 'BBB', 'fii', 0),
        position('c', 'CCC', 'fii', 0),
      ],
      scores: scoreMap([['a', 5], ['b', 5], ['c', 5]]),
      targets: targets({ fii: 100 }),
      amountCents: R$(300),
    }

    const spread = planContribution({ ...base, minPerAssetCents: 0 })
    expect(spread.types.flatMap((t) => t.assets).filter((a) => a.amountCents > 0)).toHaveLength(3)

    const concentrated = planContribution({ ...base, minPerAssetCents: R$(150) })
    const funded = concentrated.types.flatMap((t) => t.assets).filter((a) => a.amountCents > 0)
    expect(funded.length).toBeLessThan(3)
    expect(funded.every((a) => a.amountCents >= R$(150))).toBe(true)
    // The money is still fully placed, not lost with the dropped rows.
    expect(concentrated.allocatedCents).toBe(R$(300))
  })

  it('marks a dropped asset as below-minimum, not as unscored', () => {
    const plan = planContribution({
      positions: [position('a', 'AAA', 'fii', 0), position('b', 'BBB', 'fii', 0)],
      scores: scoreMap([['a', 9], ['b', 1]]),
      targets: targets({ fii: 100 }),
      amountCents: R$(100),
      minPerAssetCents: R$(60),
    })

    const dropped = plan.types.flatMap((t) => t.assets).find((a) => a.amountCents === 0)
    expect(dropped?.skipped).toBe('below-minimum')
  })

  it('gives a contribution smaller than the minimum to a single asset', () => {
    const plan = planContribution({
      positions: [position('a', 'AAA', 'fii', 0), position('b', 'BBB', 'fii', 0)],
      scores: scoreMap([['a', 9], ['b', 3]]),
      targets: targets({ fii: 100 }),
      amountCents: R$(50),
      minPerAssetCents: DEFAULT_MIN_PER_ASSET_CENTS,
    })

    const funded = plan.types.flatMap((t) => t.assets).filter((a) => a.amountCents > 0)
    expect(funded).toHaveLength(1)
    expect(funded[0].amountCents).toBe(R$(50))
    // The best-scored one, which is also the one furthest from its share.
    expect(funded[0].ticker).toBe('AAA')
  })
})

// --- edge cases -------------------------------------------------------------

describe('planContribution — edge cases', () => {
  it('handles an empty portfolio', () => {
    const plan = planContribution({
      positions: [],
      scores: new Map(),
      targets: targets({ stock_br: 50, fii: 50 }),
      amountCents: R$(1000),
    })

    expect(plan.portfolioValueCents).toBe(0)
    expect(plan.unallocatedCents).toBe(R$(1000))
    expect(typeOf(plan, 'stock_br').warning).toBe('no-eligible-assets')
  })

  it('handles a portfolio with no plan at all', () => {
    const plan = planContribution({
      ...workedExample(),
      targets: targets({}),
    })

    expect(plan.targetsSum).toBe(0)
    expect(plan.allocatedCents).toBe(0)
    expect(plan.unallocatedCents).toBe(0) // nothing was even reserved
  })

  it('still adds up when the plan does not reach 100%', () => {
    const plan = planContribution(workedExample({ targets: targets({ fii: 45, stock_br: 45 }) }))

    expect(plan.targetsSum).toBe(90)
    expect(plan.allocatedCents + plan.unallocatedCents).toBe(R$(1000))
  })

  it('suggests nothing for a contribution of zero, but still shows the picture', () => {
    const plan = planContribution(workedExample({ amountCents: 0 }))

    expect(plan.allocatedCents).toBe(0)
    expect(plan.portfolioValueCents).toBe(R$(10000))
    // Ação BR is 60% of the portfolio against a 40% goal — visible at rest.
    expect(typeOf(plan, 'stock_br').currentPercent).toBe(60)
  })

  it('is deterministic: the same inputs give the same plan', () => {
    const a = planContribution(workedExample())
    const b = planContribution(workedExample())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
