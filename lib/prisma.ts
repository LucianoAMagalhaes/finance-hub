// Prisma Client singleton.
//
// Role in the architecture: this file is the single place that creates and
// exports the database client. Every server-side query in the app imports
// `prisma` from here (e.g. `import { prisma } from '@/lib/prisma'`).
//
// Why a singleton? In development Next.js uses Hot Module Replacement: it
// reloads modules on every code change. Without guarding, each reload would
// create a brand new PrismaClient, and each client opens its own pool of
// database connections. After a few edits you would exhaust Postgres'
// connection limit ("too many clients"). To avoid that we cache the client
// on Node's `globalThis` object, which survives those reloads, and reuse it.
//
// In production this code path runs once, so a normal `new PrismaClient()`
// would be fine — but keeping one implementation is simpler and harmless.

import { PrismaClient } from '@prisma/client'

// `globalThis` is the global object shared across module reloads. We extend
// its type so TypeScript knows about our cached client property.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reuse the cached client if it already exists, otherwise create a new one.
// `log` prints the SQL queries to the terminal in dev, which helps while
// learning what Prisma actually sends to the database.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Only cache on the global object outside of production, so production gets a
// fresh, predictable client and we don't leak the instance between requests.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
