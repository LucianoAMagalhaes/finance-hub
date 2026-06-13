// Unit tests for the settings schemas.
//
// Pure validation tests: feed inputs, assert success/failure and the parsed
// output (trims, lowercases, type coercion).

import { describe, it, expect } from 'vitest'
import {
  profileSchema,
  categorySchema,
  tagSchema,
} from '@/lib/settings-schema'

describe('profileSchema', () => {
  it('accepts a valid profile and normalizes the email', () => {
    const parsed = profileSchema.parse({ name: '  Ana  ', email: '  Ana@Mail.COM ' })
    expect(parsed).toEqual({ name: 'Ana', email: 'ana@mail.com' })
  })

  it('rejects an empty name', () => {
    expect(profileSchema.safeParse({ name: '   ', email: 'a@b.com' }).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(profileSchema.safeParse({ name: 'Ana', email: 'not-an-email' }).success).toBe(false)
  })
})

describe('categorySchema', () => {
  const valid = { name: 'Conforto', icon: '🛋️', color: '#f97316', type: 'expense' }

  it('accepts a valid category', () => {
    const parsed = categorySchema.parse(valid)
    expect(parsed.name).toBe('Conforto')
    expect(parsed.type).toBe('expense')
  })

  it('trims the name', () => {
    expect(categorySchema.parse({ ...valid, name: '  Lazer ' }).name).toBe('Lazer')
  })

  it('rejects an empty name', () => {
    expect(categorySchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects a non-hex color', () => {
    expect(categorySchema.safeParse({ ...valid, color: 'orange' }).success).toBe(false)
    expect(categorySchema.safeParse({ ...valid, color: '#fff' }).success).toBe(false)
  })

  it('rejects an empty icon', () => {
    expect(categorySchema.safeParse({ ...valid, icon: '   ' }).success).toBe(false)
  })

  it('rejects an invalid type', () => {
    expect(categorySchema.safeParse({ ...valid, type: 'savings' }).success).toBe(false)
  })
})

describe('tagSchema', () => {
  it('accepts a valid tag', () => {
    const parsed = tagSchema.parse({ name: ' viagem ', color: '#06B6D4' })
    expect(parsed.name).toBe('viagem')
    expect(parsed.color).toBe('#06B6D4')
  })

  it('rejects a missing/invalid color', () => {
    expect(tagSchema.safeParse({ name: 'viagem', color: '' }).success).toBe(false)
    expect(tagSchema.safeParse({ name: 'viagem', color: '#xyzxyz' }).success).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(tagSchema.safeParse({ name: '', color: '#000000' }).success).toBe(false)
  })
})
