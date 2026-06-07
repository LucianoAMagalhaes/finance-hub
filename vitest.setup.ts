// Vitest global setup — runs once before the test files.
//
// Role: registers the jest-dom matchers (e.g. `toBeInTheDocument`,
// `toHaveTextContent`) on Vitest's `expect`, and unmounts rendered React
// components after each test so they don't leak DOM state between tests.

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
