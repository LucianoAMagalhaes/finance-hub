'use client'

// Period selector — month + year dropdowns for the dashboard.
//
// "use client": it reacts to <select> changes and navigates, which needs the
// browser. Changing either dropdown pushes a new URL (?month=&year=); because
// the dashboard reads the period from the URL (and is force-dynamic), Next.js
// re-runs the page query for the chosen period. Keeping the period in the URL
// also makes it shareable/bookmarkable.

import { useRouter } from 'next/navigation'
import { MONTH_LABELS } from '@/lib/budget'

// Years offered in the dropdown: a few back and one ahead of the current year,
// plus the selected year if it falls outside that window (e.g. an old URL).
function yearOptions(selected: number): number[] {
  const current = new Date().getUTCFullYear()
  const years = new Set<number>()
  for (let y = current - 5; y <= current + 1; y++) years.add(y)
  years.add(selected)
  return Array.from(years).sort((a, b) => b - a)
}

export function PeriodSelector({ month, year }: { month: number; year: number }) {
  const router = useRouter()

  function go(nextMonth: number, nextYear: number) {
    router.push(`/?month=${nextMonth}&year=${nextYear}`)
  }

  const select =
    'rounded-md border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="period-month">
        Mês
      </label>
      <select
        id="period-month"
        className={select}
        value={month}
        onChange={(e) => go(Number(e.target.value), year)}
      >
        {/* MONTH_LABELS is 1-indexed (index 0 is unused). */}
        {MONTH_LABELS.slice(1).map((label, i) => (
          <option key={i + 1} value={i + 1}>
            {label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="period-year">
        Ano
      </label>
      <select
        id="period-year"
        className={select}
        value={year}
        onChange={(e) => go(month, Number(e.target.value))}
      >
        {yearOptions(year).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
