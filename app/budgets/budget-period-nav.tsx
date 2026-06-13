// Month navigation for the budgets page.
//
// No "use client": this is a presentational Server Component. It renders plain
// <Link>s (next/link), which Next.js turns into fast client-side navigations to
// the same /budgets route with a different ?month=&year=. Because the period
// lives in the URL, the page stays shareable and bookmarkable, and the Server
// Component re-runs its Prisma query for the chosen month automatically.

import Link from 'next/link'
import { MONTH_LABELS, shiftPeriod, type BudgetPeriod } from '@/lib/budget'

// Builds the /budgets URL for a given period.
function periodHref({ month, year }: BudgetPeriod): string {
  return `/budgets?month=${month}&year=${year}`
}

export function BudgetPeriodNav({ month, year }: BudgetPeriod) {
  const prev = shiftPeriod({ month, year }, -1)
  const next = shiftPeriod({ month, year }, 1)

  const arrow =
    'flex h-9 w-9 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition hover:bg-gray-800'

  return (
    <div className="flex items-center gap-3">
      <Link href={periodHref(prev)} className={arrow} aria-label="Mês anterior">
        ‹
      </Link>

      <span className="min-w-[140px] text-center text-sm font-medium text-gray-200">
        {MONTH_LABELS[month]} de {year}
      </span>

      <Link href={periodHref(next)} className={arrow} aria-label="Próximo mês">
        ›
      </Link>
    </div>
  )
}
