'use client'

// Dashboard budget section — a 3-column grid of jar cards with inline drill-down.
//
// "use client": clicking a jar card toggles a list of that jar's transactions
// for the month, shown below the grid. State (which jar is open) lives in the
// browser, so this must be a Client Component. It receives already-fetched data
// via props from the dashboard Server Component. Styled to match the reference
// ("cofre" palette): cards with a progress bar and an 80%/100% alert triangle.
//
// Each jar's limit is DERIVED from its target share of the month's income (see
// lib/budget). Jars with a real limit (target > 0 and income received) show a
// progress bar; 0%/no-income jars render neutrally.

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Money } from '@/components/money'
import { formatDate } from '@/lib/format'

// One transaction shown in a jar's drill-down.
export type JarTransaction = {
  id: string
  description: string
  amount: number // cents
  date: Date
  tagName: string | null
}

// One expense jar with its month figures and its transactions (for drill-down).
export type JarRow = {
  categoryId: string
  name: string
  icon: string
  color: string
  percent: number // target share of income, 0-100
  limit: number // derived limit in cents
  spent: number // cents spent this month
  transactions: JarTransaction[]
}

export function DashboardBudget({
  jars,
  income,
}: {
  jars: JarRow[]
  income: number
}) {
  // Which jar is currently expanded (its categoryId), or null for none.
  const [openId, setOpenId] = useState<string | null>(null)
  const hasIncome = income > 0
  const openJar = jars.find((j) => j.categoryId === openId) ?? null

  return (
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">Orçamento do mês por pote</h2>
        <span className="text-xs text-cofre-faint">
          Limite = % da renda ({hasIncome ? <Money cents={income} /> : 'R$ 0,00'})
        </span>
      </div>

      {jars.length === 0 ? (
        <p className="mt-3 text-sm text-cofre-faint">
          Nenhum pote de despesa cadastrado. Crie categorias em Configurações.
        </p>
      ) : !hasIncome ? (
        <p className="mt-3 rounded-md border border-cofre-amberdim bg-cofre-amberdim/30 p-3 text-sm text-cofre-amber">
          Sem receita lançada neste mês. Os limites de cada pote são derivados da
          renda, então lance suas receitas para vê-los aqui.
        </p>
      ) : (
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jars.map((jar) => (
            <JarCard
              key={jar.categoryId}
              jar={jar}
              open={openId === jar.categoryId}
              onToggle={() =>
                setOpenId((cur) => (cur === jar.categoryId ? null : jar.categoryId))
              }
            />
          ))}
        </div>
      )}

      {openJar && (
        <DrillList jar={openJar} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}

function JarCard({
  jar,
  open,
  onToggle,
}: {
  jar: JarRow
  open: boolean
  onToggle: () => void
}) {
  const hasLimit = jar.limit > 0 && jar.percent > 0
  const ratio = hasLimit ? jar.spent / jar.limit : 0
  const alert = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
  const barColor =
    alert === 'over' ? '#F0654E' : alert === 'warn' ? '#F5A623' : jar.color

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="rounded-lg border p-3.5 text-left transition"
      style={{
        borderColor: open ? jar.color : '#2E363C',
        background: open ? '#1C2125' : 'transparent',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden style={{ color: jar.color }}>
            {jar.icon}
          </span>
          <span className="text-[13px] font-bold">{jar.name}</span>
        </span>
        {hasLimit && alert !== 'ok' && (
          <AlertTriangle
            size={14}
            color={alert === 'over' ? '#F0654E' : '#F5A623'}
          />
        )}
      </div>

      {hasLimit ? (
        <>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-bold">
              <Money cents={jar.spent} />
            </span>
            <span className="text-cofre-faint">
              de <Money cents={jar.limit} /> ({jar.percent}%)
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cofre-panel">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(ratio * 100, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold">
            <Money cents={jar.spent} />
          </span>
          <span className="text-cofre-faint">
            {jar.percent === 0 ? 'sem meta' : 'sem receita'}
          </span>
        </div>
      )}
    </button>
  )
}

// The drill-down list of a jar's transactions for the month, shown below the grid.
function DrillList({ jar, onClose }: { jar: JarRow; onClose: () => void }) {
  return (
    <div className="mt-4 border-t border-cofre-border pt-3.5">
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-bold">
        <span aria-hidden style={{ color: jar.color }}>
          {jar.icon}
        </span>
        Transações de “{jar.name}”
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-cofre-muted hover:text-cofre-text"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>

      {jar.transactions.length === 0 ? (
        <p className="text-xs text-cofre-faint">Nenhum gasto neste pote no mês.</p>
      ) : (
        <ul>
          {jar.transactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 border-b border-cofre-border py-1.5 text-[13px] last:border-0"
            >
              <span className="min-w-0">
                <span className="font-semibold">{t.description}</span>
                <span className="text-cofre-faint">
                  {' · '}
                  {formatDate(t.date)}
                  {t.tagName ? ` · ${t.tagName}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-cofre-muted">
                <Money cents={t.amount} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
