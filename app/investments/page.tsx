// Route "/investments" — the investments module has no page of its own yet.
//
// redirect() is a Next.js server helper: it stops rendering and sends the user
// somewhere else. Until the "Visão Geral" screen exists, the module's root URL
// simply lands on the portfolio, so a bookmark or a typed URL never 404s.

import { redirect } from 'next/navigation'

export default function InvestmentsPage() {
  redirect('/investments/portfolio')
}
