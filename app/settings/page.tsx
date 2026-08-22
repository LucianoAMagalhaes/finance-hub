// Settings page — route "/settings".
//
// A Server Component: it runs on the server, reads the local user plus the three
// customizable catalogs (categories, tags) with Prisma, and hands
// plain data to the client managers. Each manager calls the Server Actions in
// ./actions.ts and refreshes this page after a change.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { ProfileForm } from './profile-form'
import { EntityManager, type EntityRow } from './entity-manager'
import { TagManager, type TagRow } from './tag-manager'
import { AccountManager, type AccountRow } from './account-manager'
import {
  CategoryPercentEditor,
  type PercentRow,
} from './category-percent-editor'
import {
  ScoreQuestionManager,
  type ScoreQuestionRow,
} from './score-question-manager'
import {
  AllocationTargetEditor,
  type AllocationRow,
} from './allocation-target-editor'
import { allocationByType, buildPositions, type AssetInfo } from '@/lib/portfolio'
import { ASSET_TYPES } from '@/lib/constants'

// Always render fresh data: the catalogs change as the user edits them here.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getLocalUser()

  // Fetch the catalogs in parallel (independent queries).
  const [categories, tags, accounts, scoreQuestions, targets, assets, operations] =
    await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        type: true,
        targetPercent: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, initialBalance: true, color: true },
      orderBy: { name: 'asc' },
    }),
    // The scoring checklist. `_count.answers` tells the delete confirmation how
    // many answers a question would take down with it (onDelete: Cascade).
    prisma.scoreQuestion.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        scope: true,
        text: true,
        hint: true,
        position: true,
        _count: { select: { answers: true } },
      },
      orderBy: [{ scope: 'asc' }, { position: 'asc' }],
    }),
    // The allocation plan, plus what the portfolio actually holds today: the
    // editor shows the goal next to the reality, so the gap the aporte planner
    // will close is visible while the plan is being written.
    prisma.allocationTarget.findMany({
      where: { userId: user.id },
      select: { type: true, targetPercent: true },
    }),
    prisma.asset.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ticker: true,
        type: true,
        currentPriceCents: true,
        priceUpdatedAt: true,
      },
    }),
    prisma.assetOperation.findMany({
      where: { userId: user.id },
      select: { assetId: true, type: true, quantity: true, totalCents: true, date: true },
    }),
  ])

  // The Prisma select already matches EntityRow's shape (targetPercent is an
  // extra field the row list simply ignores).
  const categoryRows = categories as EntityRow[]

  // Only expense categories carry a target share; the "Metas" editor shows them
  // ordered by share (highest first), matching how the jars are weighted.
  const percentRows: PercentRow[] = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      targetPercent: c.targetPercent,
    }))
    .sort((a, b) => b.targetPercent - a.targetPercent || a.name.localeCompare(b.name))
  // Tag color is nullable in the DB; fall back to a neutral default for the UI.
  const tagRows: TagRow[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? '#6b7280',
  }))
  // Flatten Prisma's _count into the plain shape the manager expects.
  const scoreQuestionRows: ScoreQuestionRow[] = scoreQuestions.map((q) => ({
    id: q.id,
    scope: q.scope,
    text: q.text,
    hint: q.hint,
    position: q.position,
    answerCount: q._count.answers,
  }))
  // Today's split by type. Decimal -> number at the boundary, same as the
  // portfolio page does (ADR-007), then the position math derives the value.
  const positions = buildPositions(
    assets.map((asset) => ({
      ...asset,
      currentPriceCents:
        asset.currentPriceCents === null ? null : Number(asset.currentPriceCents),
    })) as AssetInfo[],
    operations.map((op) => ({ ...op, quantity: Number(op.quantity) })),
  )
  const currentByType = new Map(
    allocationByType(positions).map((slice) => [slice.type, slice.percent]),
  )
  const savedTargets = new Map(targets.map((t) => [t.type, t.targetPercent]))

  // Every type is always on screen, saved row or not: a type at 0% has to be a
  // deliberate zero, not a line the user never saw.
  const allocationRows: AllocationRow[] = ASSET_TYPES.map((type) => ({
    type,
    targetPercent: savedTargets.get(type) ?? 0,
    currentPercent: currentByType.get(type) ?? 0,
  }))

  // Account color is nullable too; same neutral fallback.
  const accountRows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    initialBalance: a.initialBalance,
    color: a.color ?? '#6b7280',
  }))

  return (
    <main className="max-w-6xl space-y-10 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-cofre-muted">
          Edite seu perfil e personalize categorias, contas, marcadores e o
          checklist de avaliação dos ativos.
        </p>
      </header>

      <Section
        title="Perfil"
        description="Seu nome e e-mail de identificação."
      >
        <ProfileForm initialName={user.name} initialEmail={user.email} />
      </Section>

      <Section
        title="Categorias"
        description="Os “potes” do método. Despesas usam os 6 potes; receitas usam fontes."
      >
        <EntityManager kind="category" items={categoryRows} />
      </Section>

      <Section
        title="Contas bancárias"
        description="Onde o dinheiro fica. O saldo de cada conta = saldo inicial + receitas − despesas."
      >
        <AccountManager items={accountRows} />
      </Section>

      <Section
        title="Metas dos potes"
        description="Quanto da sua renda mensal vai para cada pote de despesa. O ideal é somar 100%."
      >
        <CategoryPercentEditor items={percentRows} />
      </Section>

      <Section
        title="Metas de alocação"
        description="Quanto da sua carteira de investimentos você quer em cada tipo de ativo. O ideal é somar 100%."
      >
        <AllocationTargetEditor
          items={allocationRows}
          hasPortfolio={positions.length > 0}
        />
      </Section>

      <Section
        title="Checklist de avaliação"
        description="As perguntas que dão a nota de cada ação e FII. Cada “sim” soma 1 ponto e cada “não” tira 1."
      >
        <ScoreQuestionManager items={scoreQuestionRows} />
      </Section>

      <Section
        title="Marcadores"
        description="Etiquetas reutilizáveis, uma por transação."
      >
        <TagManager items={tagRows} />
      </Section>
    </main>
  )
}

// A titled block wrapping each settings area. Plain presentational helper.
function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-cofre-text">{title}</h2>
        <p className="text-sm text-cofre-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}
