// Local user helper.
//
// Role in the architecture: Phase 1 is single-user and local-only (see
// ADR-004 / CLAUDE.md), so instead of authentication we always operate as the
// one fixed user created by the seed. Every server-side query that needs an
// owner calls getLocalUser() to get its id.

import { prisma } from '@/lib/prisma'

// Must match the email used in prisma/seed.ts.
export const LOCAL_USER_EMAIL = 'local@finra.app'

/**
 * Returns the local user row. Throws a clear error if the seed hasn't run yet,
 * so the failure is obvious instead of a confusing null further down.
 */
export async function getLocalUser() {
  const user = await prisma.user.findUnique({
    where: { email: LOCAL_USER_EMAIL },
  })

  if (!user) {
    throw new Error(
      `Local user (${LOCAL_USER_EMAIL}) not found. Run \`npm run db:seed\` first.`,
    )
  }

  return user
}
