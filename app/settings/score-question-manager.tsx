// Checklist manager — the questions each stock/FII is graded against.
//
// "use client": everything here is interactive (add form, inline edit, delete
// confirmation, reordering), so it runs in the browser. The Settings page stays
// a Server Component that reads the DB and passes the rows down; after each
// successful mutation we call router.refresh() to re-fetch it, so the list
// always mirrors the database without a second client-side copy — same shape as
// entity-manager.tsx.
//
// Why these live in the database instead of in code: the user is still refining
// their own investing criteria, and a question they cannot edit is a question
// they will stop trusting (ADR-009).

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { SCORE_SCOPES, SCORE_SCOPE_LABELS, type ScoreScope } from '@/lib/constants'
import { scoreQuestionSchema, scoreQuestionEditSchema } from '@/lib/scoring-schema'
import {
  createScoreQuestion,
  updateScoreQuestion,
  deleteScoreQuestion,
  moveScoreQuestion,
} from './actions'

// The plain row shape the page passes down (matches the Prisma select), plus
// how many answers point at it — the delete confirmation needs that number.
export type ScoreQuestionRow = {
  id: string
  scope: ScoreScope
  text: string
  hint: string | null
  position: number
  answerCount: number
}

const field =
  'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'

export function ScoreQuestionManager({ items }: { items: ScoreQuestionRow[] }) {
  return (
    <div className="space-y-8">
      {SCORE_SCOPES.map((scope) => (
        <ScopeBlock
          key={scope}
          scope={scope}
          items={items.filter((item) => item.scope === scope)}
        />
      ))}
    </div>
  )
}

// One checklist: its own add form and its own ordered list. The two scopes are
// independent — a stock is never graded by a FII question and vice versa.
function ScopeBlock({ scope, items }: { scope: ScoreScope; items: ScoreQuestionRow[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const payload = { scope, text, hint }
    const parsed = scoreQuestionSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createScoreQuestion(payload)
      if (result.ok) {
        setText('')
        setHint('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-cofre-text">
          {SCORE_SCOPE_LABELS[scope]}
        </h3>
        {/* The count IS the range of the score: 10 questions means -10..+10. */}
        <span className="text-xs text-cofre-faint">
          {items.length} pergunta{items.length === 1 ? '' : 's'}
          {items.length > 0 && ` · nota de −${items.length} a +${items.length}`}
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-cofre-border bg-cofre-panel p-3"
      >
        <div className="min-w-[14rem] flex-[3]">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Pergunta</label>
          <input
            className={field}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Dívida Líquida/EBITDA é menor que 2,5x?"
            maxLength={200}
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">
            Observação (opcional)
          </label>
          <input
            className={field}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Histórico: 5 anos"
            maxLength={120}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-cofre-muted">
          Nenhuma pergunta nesta lista — os ativos deste grupo ficam sem nota.
        </p>
      ) : (
        <ol className="divide-y divide-cofre-border rounded-lg border border-cofre-border">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === items.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

// One question: reads as text, toggles into an inline edit form on demand.
function Row({
  item,
  index,
  isFirst,
  isLast,
}: {
  item: ScoreQuestionRow
  index: number
  isFirst: boolean
  isLast: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState(item.text)
  const [hint, setHint] = useState(item.hint ?? '')

  function handleSave() {
    setError(null)
    const payload = { text, hint }
    const parsed = scoreQuestionEditSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    startTransition(async () => {
      const result = await updateScoreQuestion(item.id, payload)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    // Deleting a question deletes its answers (Cascade), which moves the score
    // of every asset that had answered it — so say exactly what is lost.
    const consequence =
      item.answerCount > 0
        ? ` ${item.answerCount} resposta(s) já dada(s) serão perdidas e a nota dos ativos vai mudar.`
        : ''
    const ok = window.confirm(`Excluir a pergunta "${item.text}"?${consequence}`)
    if (!ok) return

    setError(null)
    startTransition(async () => {
      const result = await deleteScoreQuestion(item.id)
      if (result.ok) router.refresh()
      else setError(result.error)
    })
  }

  function handleMove(direction: 'up' | 'down') {
    setError(null)
    startTransition(async () => {
      const result = await moveScoreQuestion(item.id, direction)
      if (result.ok) router.refresh()
      else setError(result.error)
    })
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-2 p-3">
        <input
          className={`${field} min-w-[14rem] flex-[3]`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
        />
        <input
          className={`${field} min-w-[10rem] flex-1`}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Observação (opcional)"
          maxLength={120}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-3 py-2 text-sm font-semibold text-[#0B1410] hover:opacity-90 disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => {
            setText(item.text)
            setHint(item.hint ?? '')
            setError(null)
            setEditing(false)
          }}
          disabled={isPending}
          className="rounded-md border border-cofre-border px-3 py-2 text-sm font-medium text-cofre-text hover:bg-cofre-panel disabled:opacity-50"
        >
          Cancelar
        </button>
        {error && <span className="w-full text-xs text-cofre-red">{error}</span>}
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 p-3">
      <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-cofre-faint">
        {index + 1}.
      </span>
      <div className="flex-1">
        <p className="text-sm text-cofre-text">{item.text}</p>
        {item.hint && <p className="mt-0.5 text-xs text-cofre-faint">{item.hint}</p>}
      </div>

      {/* Reorder: the arrows swap this question with its neighbour. */}
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          onClick={() => handleMove('up')}
          disabled={isPending || isFirst}
          aria-label="Mover para cima"
          className="text-cofre-faint transition hover:text-cofre-text disabled:opacity-25"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => handleMove('down')}
          disabled={isPending || isLast}
          aria-label="Mover para baixo"
          className="text-cofre-faint transition hover:text-cofre-text disabled:opacity-25"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-cofre-muted hover:text-cofre-text"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium text-cofre-red hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
      {error && <span className="w-full text-xs text-cofre-red">{error}</span>}
    </li>
  )
}
