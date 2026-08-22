// Evaluation sheet — the modal behind the "Nota" cell of the portfolio table.
//
// "use client": every answer is browser state until the user hits Salvar, and
// the live score at the bottom has to move as they click. The whole sheet is
// submitted at once (one Server Action call), the same "edit locally, save the
// plan in one go" shape as the jar-percent editor in Configurações.
//
// Two different sheets behind one entry point, decided by the asset's type:
//   * stocks and FIIs answer the checklist (Sim / Não / blank per question);
//   * crypto and fixed income get a single hand-typed score.
// See lib/scoring.ts for why, and ADR-009 for the scale.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MANUAL_SCORE_MIN, MANUAL_SCORE_MAX } from '@/lib/constants'
import { formatScore, type Question } from '@/lib/scoring'
import { setAssetAnswers, setAssetManualScore } from './actions'

/** What the page hands down for one asset's evaluation. */
export type ScoreSheetAsset = {
  id: string
  ticker: string
  /** null when this type has no checklist (crypto, fixed income). */
  questions: Question[] | null
  /** questionId -> true/false. A missing key means "not answered". */
  answers: Record<string, boolean>
  manualScore: number | null
}

export function ScoreSheet({
  asset,
  onSuccess,
}: {
  asset: ScoreSheetAsset
  onSuccess?: () => void
}) {
  if (asset.questions === null) {
    return <ManualSheet asset={asset} onSuccess={onSuccess} />
  }
  return <ChecklistSheet asset={asset} questions={asset.questions} onSuccess={onSuccess} />
}

// --- Checklist (stocks and FIIs) -------------------------------------------

function ChecklistSheet({
  asset,
  questions,
  onSuccess,
}: {
  asset: ScoreSheetAsset
  questions: Question[]
  onSuccess?: () => void
}) {
  const router = useRouter()
  // Local copy of the answers; undefined for a question left blank.
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>(
    () => ({ ...asset.answers }),
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // The live score, recomputed on every click — same arithmetic as
  // lib/scoring.computeAssetScore, over the answers not yet saved.
  const answered = questions.filter((q) => answers[q.id] !== undefined)
  const yes = answered.filter((q) => answers[q.id] === true).length
  const no = answered.length - yes
  const score = answered.length === 0 ? null : yes - no

  function setAnswer(questionId: string, value: boolean | undefined) {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  function handleSave() {
    setError(null)
    // Only the answered ones travel: a blank question is the ABSENCE of a row,
    // which is exactly how the database stores "not answered".
    const payload = questions
      .filter((question) => answers[question.id] !== undefined)
      .map((question) => ({ questionId: question.id, value: answers[question.id] as boolean }))

    startTransition(async () => {
      const result = await setAssetAnswers(asset.id, payload)
      if (result.ok) {
        router.refresh()
        onSuccess?.()
      } else {
        setError(result.error)
      }
    })
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-cofre-muted">
          Este grupo ainda não tem perguntas, então {asset.ticker} fica sem nota.
        </p>
        <Link
          href="/settings"
          className="inline-block rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90"
        >
          Cadastrar perguntas em Configurações
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
        {questions.map((question, index) => {
          const answer = answers[question.id]
          return (
            <li
              key={question.id}
              className="flex items-start gap-3 rounded-md border border-cofre-border/60 p-2.5"
            >
              <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-cofre-faint">
                {index + 1}.
              </span>
              <div className="flex-1">
                <p className="text-sm text-cofre-text">{question.text}</p>
                {question.hint && (
                  <p className="mt-0.5 text-xs text-cofre-faint">{question.hint}</p>
                )}
              </div>

              {/* Sim / Não as a pair of pills. Clicking the lit one again turns
                  it off — that is how a question goes back to "não respondida",
                  which is different from answering "Não" (that costs a point). */}
              <div className="flex shrink-0 gap-1">
                <Pill
                  active={answer === true}
                  tone="jade"
                  onClick={() => setAnswer(question.id, answer === true ? undefined : true)}
                >
                  Sim
                </Pill>
                <Pill
                  active={answer === false}
                  tone="red"
                  onClick={() => setAnswer(question.id, answer === false ? undefined : false)}
                >
                  Não
                </Pill>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Live total, the same "you can see the plan add up" idea as the jar
          percentages in Configurações. */}
      <div className="flex items-center justify-between rounded-md border border-cofre-border bg-cofre-panel px-3 py-2.5">
        <div className="text-xs text-cofre-muted">
          {answered.length} de {questions.length} respondida
          {answered.length === 1 ? '' : 's'}
          {answered.length < questions.length && (
            <span className="text-cofre-faint"> · as em branco não contam</span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-cofre-muted">Nota</span>
          <span className={`text-lg font-extrabold tabular-nums ${scoreColor(score)}`}>
            {formatScore(score)}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Salvar avaliação'}
        </button>
        <button
          type="button"
          onClick={() => setAnswers({})}
          disabled={isPending}
          className="rounded-md border border-cofre-border px-3 py-2 text-sm font-medium text-cofre-muted transition hover:text-cofre-text disabled:opacity-50"
        >
          Limpar tudo
        </button>
      </div>
    </div>
  )
}

// --- Manual score (crypto and fixed income) --------------------------------

function ManualSheet({
  asset,
  onSuccess,
}: {
  asset: ScoreSheetAsset
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [score, setScore] = useState<number | null>(asset.manualScore)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await setAssetManualScore(asset.id, { manualScore: score })
      if (result.ok) {
        router.refresh()
        onSuccess?.()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cofre-muted">
        {asset.ticker} não tem checklist — a nota é sua, de {MANUAL_SCORE_MIN} a +
        {MANUAL_SCORE_MAX}. Quanto maior, mais aporte ele atrai; a nota só disputa
        dinheiro com outros ativos do mesmo tipo, nunca com uma ação ou um FII.
      </p>

      {/* Slider mirrored by a number field — same pair the jar-percent editor
          uses, so the two "set a number" screens behave alike. */}
      <div className="flex items-center gap-4 rounded-md border border-cofre-border bg-cofre-panel px-4 py-3">
        <input
          type="range"
          min={MANUAL_SCORE_MIN}
          max={MANUAL_SCORE_MAX}
          step={1}
          value={score ?? 0}
          onChange={(e) => setScore(Number(e.target.value))}
          className="hidden flex-1 accent-cofre-jade sm:block"
          aria-label={`Nota de ${asset.ticker}`}
        />
        <input
          type="number"
          min={MANUAL_SCORE_MIN}
          max={MANUAL_SCORE_MAX}
          step={1}
          value={score ?? ''}
          placeholder="—"
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') {
              setScore(null)
              return
            }
            const clamped = Math.max(
              MANUAL_SCORE_MIN,
              Math.min(MANUAL_SCORE_MAX, Math.round(Number(raw))),
            )
            setScore(Number.isNaN(clamped) ? null : clamped)
          }}
          className="w-20 rounded-md border border-cofre-border px-3 py-2 text-center text-sm tabular-nums focus:border-cofre-jade focus:outline-none"
        />
        <span className={`w-12 text-right text-lg font-extrabold tabular-nums ${scoreColor(score)}`}>
          {formatScore(score)}
        </span>
      </div>

      <p className="text-xs text-cofre-faint">
        Deixe em branco para tirar a nota — um ativo sem nota não entra na sugestão
        de aporte.
      </p>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Salvar nota'}
        </button>
        <button
          type="button"
          onClick={() => setScore(null)}
          disabled={isPending}
          className="rounded-md border border-cofre-border px-3 py-2 text-sm font-medium text-cofre-muted transition hover:text-cofre-text disabled:opacity-50"
        >
          Limpar
        </button>
      </div>
    </div>
  )
}

// --- Shared bits -----------------------------------------------------------

/** Jade for a positive score, red for a negative one, muted for 0 or none. */
export function scoreColor(score: number | null): string {
  if (score === null) return 'text-cofre-faint'
  if (score > 0) return 'text-cofre-jade'
  if (score < 0) return 'text-cofre-red'
  return 'text-cofre-amber'
}

function Pill({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: 'jade' | 'red'
  onClick: () => void
  children: React.ReactNode
}) {
  const on =
    tone === 'jade'
      ? 'bg-cofre-jadedim text-cofre-jade ring-1 ring-cofre-jade/40'
      : 'bg-cofre-reddim text-cofre-red ring-1 ring-cofre-red/40'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? on : 'text-cofre-faint hover:bg-cofre-panel hover:text-cofre-muted'
      }`}
    >
      {children}
    </button>
  )
}
