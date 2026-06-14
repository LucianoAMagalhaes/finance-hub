'use client'

// Dashboard budget section — the per-jar overview with inline drill-down.
//
// "use client": unlike most of the dashboard, this component is interactive —
// clicking a jar expands a list of that jar's transactions for the month right
// below it. State (which jar is open) lives in the browser, so this must be a
// Client Component. It receives already-fetched data via props from the
// dashboard Server Component; no data fetching happens here.
//
// Each jar's limit is DERIVED from its target share of the month's income (see
// lib/budget). Jars with a real limit (target > 0 and income received) show a
// progress bar with the 80%/100% alerts; 0%/no-income jars render neutrally.

import { useState } from 'react'
import { Money } from '@/components/money'
import { budgetStatus, type BudgetLevel } from '@/lib/budget'
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

// Tailwind classes per alert level: bar fill and text.
const LEVEL_STYLES: Record<BudgetLevel, { bar: string; text: string }> = {
  ok: { bar: 'bg-green-500', text: 'text-gray-400' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-300' },
  over: { bar: 'bg-red-500', text: 'text-red-300' },
}

export function DashboardBudget({
  jars,
  income,
}: {
  jars: JarRow[]
  income: number
}) {
  // Which jar is currently expanded (its categoryId), or null for none. Only one
  // open at a time keeps the dashboard compact.
  const [openId, setOpenId] = useState<string | null>(null)

  const hasIncome = income > 0
  const totalSpent = jars.reduce((sum, j) => sum + j.spent, 0)
  const totalLimit = jars.reduce((sum, j) => sum + j.limit, 0)
  const totals = budgetStatus(totalSpent, totalLimit)

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-200">Orçamento do mês</h2>
        <span className="text-xs text-gray-400">
          Limites derivados de {hasIncome ? <Money cents={income} /> : 'R$ 0,00'} de
          receita
        </span>
      </div>

      {jars.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhum pote de despesa cadastrado. Crie categorias em Configurações.
        </p>
      ) : !hasIncome ? (
        <p className="rounded-md border border-amber-900/60 bg-amber-950/40 p-3 text-sm text-amber-200">
          Sem receita lançada neste mês. Os limites de cada pote são derivados da
          renda, então lance suas receitas para vê-los aqui.
        </p>
      ) : (
        // Total spent vs derived total across all jars.
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-gray-400">Gasto total</span>
          <span className={LEVEL_STYLES[totals.level].text}>
            <Money cents={totalSpent} /> de <Money cents={totalLimit} /> (
            {totals.percent}%)
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {jars.map((jar) => (
          <JarItem
            key={jar.categoryId}
            jar={jar}
            hasIncome={hasIncome}
            open={openId === jar.categoryId}
            onToggle={() =>
              setOpenId((cur) => (cur === jar.categoryId ? null : jar.categoryId))
            }
          />
        ))}
      </ul>
    </section>
  )
}

function JarItem({
  jar,
  hasIncome,
  open,
  onToggle,
}: {
  jar: JarRow
  hasIncome: boolean
  open: boolean
  onToggle: () => void
}) {
  const hasLimit = hasIncome && jar.percent > 0
  const status = budgetStatus(jar.spent, jar.limit)
  const style = LEVEL_STYLES[status.level]

  return (
    <li className="rounded-md border border-gray-800 bg-gray-950/40">
      {/* The whole header is a button so clicking anywhere toggles the drill-down. */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 text-left transition hover:bg-gray-800/40"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            <span style={{ color: jar.color }}>
              {jar.icon} {jar.name}
            </span>
            <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">
              {jar.percent}%
            </span>
          </span>
          <span className={`text-xs ${hasLimit ? style.text : 'text-gray-400'}`}>
            {hasLimit ? (
              <>
                <Money cents={jar.spent} /> de <Money cents={jar.limit} /> (
                {status.percent}%)
              </>
            ) : (
              <>
                <Money cents={jar.spent} />
              </>
            )}
            {/* A little chevron that rotates when open. */}
            <span
              className={`ml-2 inline-block text-gray-500 transition-transform ${
                open ? 'rotate-90' : ''
              }`}
            >
              ›
            </span>
          </span>
        </div>

        {hasLimit ? (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className={`h-full rounded-full ${style.bar}`}
              style={{ width: `${Math.min(status.percent, 100)}%` }}
            />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-gray-500">
            {jar.percent === 0 ? 'Defina a meta em Configurações' : 'Sem receita no mês'}
          </p>
        )}
      </button>

      {/* Drill-down: this jar's transactions for the month. */}
      {open && (
        <div className="border-t border-gray-800 px-3 py-2">
          {jar.transactions.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum gasto neste pote no mês.</p>
          ) : (
            <ul className="divide-y divide-gray-800/60">
              {jar.transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-100">
                      {t.description}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {formatDate(t.date)}
                      {t.tagName ? ` · ${t.tagName}` : ''}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-gray-300">
                    <Money cents={t.amount} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
