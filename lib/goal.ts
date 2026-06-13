// Goal domain helpers — pure functions, no I/O.
//
// Role in the architecture: the math behind "how is this goal doing?" and "how
// much should I put aside each month?" lives here, away from React and Prisma,
// so it can be unit-tested directly (see goal.test.ts) and reused anywhere.
// Money is in integer cents (see CLAUDE.md), so every amount is a whole number.

export type GoalProgress = {
  // Saved as a percentage of the target, rounded (capped at 100 for display).
  percent: number
  // target - current, in cents, never negative (0 once the goal is reached).
  remaining: number
  // True when the goal has been fully funded.
  complete: boolean
}

/**
 * Computes how close a goal is to its target.
 *
 * @param current - Amount saved so far, in integer cents (>= 0).
 * @param target - Target amount, in integer cents (> 0).
 */
export function goalProgress(current: number, target: number): GoalProgress {
  // Guard against a zero/negative target so we never divide by zero.
  if (target <= 0) {
    return { percent: 100, remaining: 0, complete: true }
  }

  const remaining = Math.max(0, target - current)
  const complete = current >= target
  // Cap the displayed percentage at 100 — saving past the target is still 100%.
  const percent = Math.min(100, Math.round((current / target) * 100))

  return { percent, remaining, complete }
}

/**
 * Number of whole calendar months from `now` to `deadline`, with a floor of 1.
 *
 * We count month boundaries (ignoring the day of month — good enough for a
 * "suggested" value) and never return less than 1, so a deadline in the current
 * month or already past suggests funding the whole remainder over one month.
 */
export function monthsUntil(deadline: Date, now: Date): number {
  const months =
    (deadline.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (deadline.getUTCMonth() - now.getUTCMonth())
  return Math.max(1, months)
}

/**
 * Suggested monthly contribution to reach the target by the deadline.
 *
 * It spreads what's still missing over the months remaining, rounding up so the
 * goal is funded by the deadline rather than just after it. Returns 0 once the
 * goal is already reached.
 *
 * @param target - Target amount, in integer cents.
 * @param current - Amount saved so far, in integer cents.
 * @param deadline - When the goal should be reached.
 * @param now - The reference "today" (the caller passes `new Date()`).
 */
export function suggestedMonthlyContribution(
  target: number,
  current: number,
  deadline: Date,
  now: Date,
): number {
  const remaining = Math.max(0, target - current)
  if (remaining === 0) return 0

  return Math.ceil(remaining / monthsUntil(deadline, now))
}
