// Contribution planner page — route "/investments/contributions" ("Aportes").
//
// A Server Component: it reads everything the suggestion depends on (positions,
// scores and the allocation plan) and hands plain data to the client, which does
// the arithmetic. There are NO Server Actions here — this screen writes nothing.
// It answers "where should this money go?"; recording the purchase stays with
// the "Nova compra" modal on the Carteira, and nothing here touches the budget's
// transactions or accounts (ADR-008).
//
// Doing the math in the browser is deliberate: planContribution is a pure
// function, so the user can drag the amount around and see the plan react
// instantly instead of waiting on a round trip per keystroke.
//
// Decimal -> number happens here at the boundary, as on the Carteira (ADR-007).

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { buildPositions, type AssetInfo } from '@/lib/portfolio'
import { computeAssetScores, type Question } from '@/lib/scoring'
import { toTargetMap } from '@/lib/allocation'
import { ContributionPlanner } from './contribution-planner'

export const dynamic = 'force-dynamic'

export default async function ContributionsPage() {
  const user = await getLocalUser()

  // Five independent queries, in parallel — same shape as the Carteira page.
  const [assets, operations, questions, answers, allocationTargets] = await Promise.all([
    prisma.asset.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ticker: true,
        type: true,
        currentPriceCents: true,
        priceUpdatedAt: true,
        manualScore: true,
      },
      orderBy: { ticker: 'asc' },
    }),
    prisma.assetOperation.findMany({
      where: { userId: user.id },
      select: {
        assetId: true,
        type: true,
        quantity: true,
        totalCents: true,
        date: true,
        createdAt: true,
      },
    }),
    prisma.scoreQuestion.findMany({
      where: { userId: user.id },
      select: { id: true, scope: true, text: true, hint: true, position: true },
      orderBy: [{ scope: 'asc' }, { position: 'asc' }],
    }),
    prisma.scoreAnswer.findMany({
      where: { userId: user.id },
      select: { assetId: true, questionId: true, value: true },
    }),
    prisma.allocationTarget.findMany({
      where: { userId: user.id },
      select: { type: true, targetPercent: true },
    }),
  ])

  const assetInfos: AssetInfo[] = assets.map((asset) => ({
    ...asset,
    currentPriceCents:
      asset.currentPriceCents === null ? null : Number(asset.currentPriceCents),
  }))

  const positions = buildPositions(
    assetInfos,
    operations.map((op) => ({ ...op, quantity: Number(op.quantity) })),
  )

  const scores = computeAssetScores(assets, questions as Question[], answers)
  const targets = toTargetMap(allocationTargets)

  // A Map cannot cross the server/client boundary, so it travels as entries and
  // the client rebuilds it.
  const scoreEntries = Array.from(scores.entries())

  return (
    // Full width like the Carteira: the plan is a table per type, and capping
    // the width would push it into a horizontal scrollbar.
    <main className="p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Aportes</h1>
        <p className="mt-1 text-sm text-cofre-muted">
          Diga quanto vai aportar e veja onde colocar. O dinheiro vai primeiro
          para os tipos abaixo da meta e, dentro de cada tipo, para os ativos de
          nota alta que estão mais atrás da própria fatia.
        </p>
      </header>

      <ContributionPlanner
        positions={positions}
        scoreEntries={scoreEntries}
        targets={targets}
      />
    </main>
  )
}
