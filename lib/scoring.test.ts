import { describe, it, expect } from 'vitest'
import {
  computeAssetScore,
  computeAssetScores,
  formatScore,
  scoreScopeFor,
  scoreWeight,
  type Answer,
  type Question,
  type ScorableAsset,
} from '@/lib/scoring'

// --- fixtures ---------------------------------------------------------------

const petr: ScorableAsset = { id: 'a1', type: 'stock_br', manualScore: null }
const aapl: ScorableAsset = { id: 'a2', type: 'stock_intl', manualScore: null }
const hglg: ScorableAsset = { id: 'a3', type: 'fii', manualScore: null }
const btc: ScorableAsset = { id: 'a4', type: 'crypto', manualScore: 7 }

/** Builds a checklist of `count` questions for one scope: s1, s2, s3... */
function checklist(scope: Question['scope'], count: number): Question[] {
  const prefix = scope === 'stocks' ? 's' : 'f'
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index + 1}`,
    scope,
    text: `Pergunta ${index + 1}`,
    hint: null,
    position: index,
  }))
}

/** Answers `yes` question ids with sim and `no` ids with não, for one asset. */
function answers(assetId: string, yes: string[], no: string[]): Answer[] {
  return [
    ...yes.map((questionId) => ({ assetId, questionId, value: true })),
    ...no.map((questionId) => ({ assetId, questionId, value: false })),
  ]
}

const stocks = checklist('stocks', 10)
const fiis = checklist('fiis', 10)
const allQuestions = [...stocks, ...fiis]

// --- tests ------------------------------------------------------------------

describe('scoreScopeFor', () => {
  it('grades both stock types with the same checklist', () => {
    expect(scoreScopeFor('stock_br')).toBe('stocks')
    expect(scoreScopeFor('stock_intl')).toBe('stocks')
  })

  it('gives FIIs their own checklist', () => {
    expect(scoreScopeFor('fii')).toBe('fiis')
  })

  it('returns null for the types scored by hand', () => {
    expect(scoreScopeFor('crypto')).toBeNull()
    expect(scoreScopeFor('fixed_income')).toBeNull()
  })
})

describe('computeAssetScore', () => {
  it('scores yes minus no', () => {
    // 7 sim and 3 não out of 10 => 7 - 3 = +4
    const score = computeAssetScore(
      petr,
      allQuestions,
      answers('a1', ['s1', 's2', 's3', 's4', 's5', 's6', 's7'], ['s8', 's9', 's10']),
    )

    expect(score.value).toBe(4)
    expect(score.yes).toBe(7)
    expect(score.no).toBe(3)
    expect(score.answered).toBe(10)
    expect(score.total).toBe(10)
    expect(score.source).toBe('checklist')
  })

  it('reaches the extremes of the -10..+10 range', () => {
    const allIds = stocks.map((question) => question.id)
    expect(computeAssetScore(petr, allQuestions, answers('a1', allIds, [])).value).toBe(10)
    expect(computeAssetScore(petr, allQuestions, answers('a1', [], allIds)).value).toBe(-10)
  })

  it('counts only the answered questions, and reports how many', () => {
    // 4 sim, 2 não, 4 left blank => +2 out of 6 answered (not -2 for the blanks)
    const score = computeAssetScore(
      petr,
      allQuestions,
      answers('a1', ['s1', 's2', 's3', 's4'], ['s5', 's6']),
    )

    expect(score.value).toBe(2)
    expect(score.answered).toBe(6)
    expect(score.total).toBe(10)
  })

  it('returns null when nothing was answered — that is not a score of 0', () => {
    const score = computeAssetScore(petr, allQuestions, [])

    expect(score.value).toBeNull()
    expect(score.answered).toBe(0)
  })

  it('returns a real 0 when the sims and the nãos cancel out', () => {
    const score = computeAssetScore(
      petr,
      allQuestions,
      answers('a1', ['s1', 's2'], ['s3', 's4']),
    )

    expect(score.value).toBe(0)
  })

  it('returns null when the scope has no questions at all', () => {
    const score = computeAssetScore(petr, fiis, answers('a1', ['s1'], []))

    expect(score.value).toBeNull()
    expect(score.total).toBe(0)
  })

  it('ignores answers pointing at another scope or at a deleted question', () => {
    const score = computeAssetScore(hglg, allQuestions, [
      ...answers('a3', ['f1', 'f2'], []),
      // A stocks question and a question that no longer exists: neither counts.
      { assetId: 'a3', questionId: 's1', value: true },
      { assetId: 'a3', questionId: 'gone', value: true },
    ])

    expect(score.value).toBe(2)
    expect(score.answered).toBe(2)
    expect(score.total).toBe(10)
  })

  it('ignores answers belonging to another asset', () => {
    const score = computeAssetScore(petr, allQuestions, [
      ...answers('a1', ['s1'], []),
      ...answers('a2', ['s2', 's3', 's4'], []),
    ])

    expect(score.value).toBe(1)
  })

  it('uses the hand-typed score for crypto and fixed income', () => {
    const score = computeAssetScore(btc, allQuestions, [])

    expect(score.value).toBe(7)
    expect(score.source).toBe('manual')
    expect(score.total).toBe(0)
  })

  it('reports a never-typed manual score as null', () => {
    const score = computeAssetScore({ ...btc, manualScore: null }, allQuestions, [])

    expect(score.value).toBeNull()
  })

  it('ignores checklist answers on a hand-scored asset', () => {
    const score = computeAssetScore(btc, allQuestions, answers('a4', ['s1', 's2'], []))

    expect(score.value).toBe(7)
    expect(score.yes).toBe(0)
  })
})

describe('computeAssetScores', () => {
  it('scores a whole portfolio, keyed by asset id', () => {
    const scores = computeAssetScores(
      [petr, aapl, hglg, btc],
      allQuestions,
      [
        ...answers('a1', ['s1', 's2', 's3'], ['s4']),
        ...answers('a3', ['f1'], ['f2', 'f3']),
      ],
    )

    expect(scores.get('a1')?.value).toBe(2)
    expect(scores.get('a2')?.value).toBeNull() // never evaluated
    expect(scores.get('a3')?.value).toBe(-1)
    expect(scores.get('a4')?.value).toBe(7) // manual
    expect(scores.size).toBe(4)
  })

  it('handles an empty portfolio', () => {
    expect(computeAssetScores([], allQuestions, []).size).toBe(0)
  })
})

describe('scoreWeight', () => {
  it('weighs a positive score by its value', () => {
    expect(scoreWeight(computeAssetScore(petr, allQuestions, answers('a1', ['s1', 's2'], [])))).toBe(2)
  })

  it('zeroes a neutral or negative score — only positives attract money', () => {
    const neutral = computeAssetScore(petr, allQuestions, answers('a1', ['s1'], ['s2']))
    const negative = computeAssetScore(petr, allQuestions, answers('a1', [], ['s1', 's2']))

    expect(scoreWeight(neutral)).toBe(0)
    expect(scoreWeight(negative)).toBe(0)
  })

  it('zeroes an ungraded asset', () => {
    expect(scoreWeight(computeAssetScore(petr, allQuestions, []))).toBe(0)
    expect(scoreWeight(undefined)).toBe(0)
    expect(scoreWeight(null)).toBe(0)
  })
})

describe('formatScore', () => {
  it('signs the number and dashes the missing score', () => {
    expect(formatScore(4)).toBe('+4')
    expect(formatScore(0)).toBe('0')
    expect(formatScore(-3)).toBe('-3')
    expect(formatScore(null)).toBe('—')
  })
})
