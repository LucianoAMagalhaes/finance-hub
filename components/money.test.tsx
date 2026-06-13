// Component test for <Money />.
//
// Renders the component into a simulated DOM (jsdom) and asserts on what the
// user would actually see / the markup produced.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Money } from '@/components/money'

// Currency formatting inserts a non-breaking space (U+00A0 / U+202F) between
// "R$" and the number; collapse any whitespace to a plain space before asserting.
const normalize = (s: string) => s.replace(/\s/g, ' ')

describe('<Money />', () => {
  it('renders the amount formatted as BRL', () => {
    const { container } = render(<Money cents={150000} />)
    // Normalize the currency's non-breaking space before comparing.
    expect(normalize(container.textContent ?? '')).toBe('R$ 1.500,00')
  })

  it('is not colored by default', () => {
    const { container } = render(<Money cents={1000} />)
    expect(container.querySelector('span')).not.toHaveClass('text-green-500')
    expect(container.querySelector('span')).not.toHaveClass('text-red-500')
  })

  it('colors positive amounts green when colored', () => {
    const { container } = render(<Money cents={1000} colored />)
    expect(container.querySelector('span')).toHaveClass('text-green-500')
  })

  it('colors negative amounts red when colored', () => {
    const { container } = render(<Money cents={-1000} colored />)
    expect(container.querySelector('span')).toHaveClass('text-red-500')
  })
})
