import { describe, expect, it } from 'vitest'
import { normalizeToE164 } from './phone-normalize'

describe('normalizeToE164', () => {
  it('normalizes formatted (555) 123-4567 to +15551234567', () => {
    expect(normalizeToE164('(555) 123-4567')).toBe('+15551234567')
  })

  it('normalizes dashed 555-123-4567 to +15551234567', () => {
    expect(normalizeToE164('555-123-4567')).toBe('+15551234567')
  })

  it('normalizes bare 10-digit 5551234567 to +15551234567', () => {
    expect(normalizeToE164('5551234567')).toBe('+15551234567')
  })

  it('normalizes 11-digit 15551234567 (US country code) to +15551234567', () => {
    expect(normalizeToE164('15551234567')).toBe('+15551234567')
  })

  it('passes through already-E164 +15551234567 unchanged', () => {
    expect(normalizeToE164('+15551234567')).toBe('+15551234567')
  })

  it('normalizes dashed 1-888-830-6873 to +18888306873', () => {
    expect(normalizeToE164('1-888-830-6873')).toBe('+18888306873')
  })

  it('returns "+" for empty string (caller handles validation)', () => {
    expect(normalizeToE164('')).toBe('+')
  })

  it('passes through international +442071234567 unchanged', () => {
    expect(normalizeToE164('+442071234567')).toBe('+442071234567')
  })
})
