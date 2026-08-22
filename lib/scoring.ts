// Asset scoring math — pure functions, no I/O.
//
// Role in the architecture: each stock/FII is graded against a checklist of
// objective yes/no questions the user writes in Configurações. Every "sim" adds
// a point and every "não" removes one, so a 10-question list produces a score
// from -10 to +10 (see ADR-009). Crypto and fixed income have no checklist and
// carry a hand-typed score on the asset row instead, on the SAME scale.
//
// The score is DERIVED here from the raw answers and never stored, exactly like
// the position in lib/portfolio.ts and the budget limit in lib/budget.ts: a
// derived number can never disagree with the inputs it came from.
//
// This file must NOT import Prisma — it runs in Vitest and in the browser (the
// contribution planner recomputes on every keystroke). The page converts Prisma
// rows to these plain shapes at the boundary.
// Tests live in lib/scoring.test.ts.

import type { AssetType, ScoreScope } from '@/lib/constants'

/** One question of one checklist, already converted to plain values. */
export type Question = {
  id: string
  scope: ScoreScope
  text: string
  hint: string | null
  position: number
}

/** One asset's answer to one question. A MISSING row means "not answered". */
export type Answer = {
  assetId: string
  questionId: string
  value: boolean
}

/** The asset fields the score depends on. */
export type ScorableAsset = {
  id: string
  type: AssetType
  manualScore: number | null
}

/** What the UI renders in the "Nota" column and what feeds the aporte weights. */
export type AssetScore = {
  assetId: string
  /** yes − no for a checklist, or the typed number. Null = not graded yet. */
  value: number | null
  source: 'checklist' | 'manual'
  yes: number
  no: number
  /** How many questions were answered, out of how many exist in the scope. */
  answered: number
  total: number // always 0 for a manual score — there is no checklist
}

/**
 * Which checklist grades an asset of this type, or null when the type is graded
 * by hand. Both stock types share the `stocks` list on purpose: the questions
 * are about company health, which does not change with the exchange.
 *
 * @param type - The asset's type as stored in the DB.
 */
export function scoreScopeFor(type: AssetType): ScoreScope | null {
  switch (type) {
    case 'stock_br':
    case 'stock_intl':
      return 'stocks'
    case 'fii':
      return 'fiis'
    case 'crypto':
    case 'fixed_income':
      return null
  }
}

/**
 * Builds one asset's score.
 *
 * Only ANSWERED questions count, so a half-filled checklist gives a partial
 * score plus an "answered/total" the UI can warn about — better than pretending
 * an unanswered question is a "não" and punishing the asset for it.
 *
 * @param asset - The asset being graded (its type picks the checklist).
 * @param questions - Every question of every scope; filtered here by scope.
 * @param answers - This asset's answers (extra assets' answers are ignored).
 */
export function computeAssetScore(
  asset: ScorableAsset,
  questions: Question[],
  answers: Answer[],
): AssetScore {
  const scope = scoreScopeFor(asset.type)

  // No checklist for this type: the score is whatever the user typed by hand.
  if (scope === null) {
    return {
      assetId: asset.id,
      value: asset.manualScore ?? null,
      source: 'manual',
      yes: 0,
      no: 0,
      answered: 0,
      total: 0,
    }
  }

  const scoped = questions.filter((question) => question.scope === scope)
  // An answer only counts when it points at a question of THIS scope — a
  // leftover row from a question that was moved or deleted must not score.
  const validIds = new Set(scoped.map((question) => question.id))

  let yes = 0
  let no = 0
  for (const answer of answers) {
    if (answer.assetId !== asset.id) continue
    if (!validIds.has(answer.questionId)) continue
    if (answer.value) yes += 1
    else no += 1
  }

  const answered = yes + no

  return {
    assetId: asset.id,
    // Nothing answered = not graded yet, which is different from a score of 0
    // (a checklist with as many "não" as "sim"). Only the first one is excluded
    // from the aporte suggestion for "not evaluated".
    value: answered === 0 ? null : yes - no,
    source: 'checklist',
    yes,
    no,
    answered,
    total: scoped.length,
  }
}

/**
 * Same as computeAssetScore for a whole portfolio, indexed by asset id.
 * Groups the answers once instead of scanning the full list per asset.
 *
 * @param assets - Every asset to grade.
 * @param questions - Every question of every scope.
 * @param answers - Every answer of every asset.
 */
export function computeAssetScores(
  assets: ScorableAsset[],
  questions: Question[],
  answers: Answer[],
): Map<string, AssetScore> {
  const byAsset = new Map<string, Answer[]>()
  for (const answer of answers) {
    const list = byAsset.get(answer.assetId)
    if (list) list.push(answer)
    else byAsset.set(answer.assetId, [answer])
  }

  return new Map(
    assets.map((asset) => [
      asset.id,
      computeAssetScore(asset, questions, byAsset.get(asset.id) ?? []),
    ]),
  )
}

/**
 * The weight this score carries when splitting a contribution.
 *
 * Decided with the user (ADR-009): only a POSITIVE score attracts new money. An
 * ungraded asset (null) and one whose checklist came out neutral or negative
 * both weigh zero — they stay in the portfolio and stay listed on the planner,
 * they just do not receive a suggestion.
 *
 * @param score - The asset's score, or undefined when it has none.
 */
export function scoreWeight(score: AssetScore | undefined | null): number {
  if (!score || score.value === null) return 0
  return Math.max(0, score.value)
}

/**
 * Formats a score for display: "+4", "0", "-3", or "—" when not graded.
 * Kept here so the table cell and the planner never drift apart.
 *
 * @param value - The score, or null when the asset was never graded.
 */
export function formatScore(value: number | null): string {
  if (value === null) return '—'
  return value > 0 ? `+${value}` : String(value)
}
