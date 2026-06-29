import { describe, it, expect } from 'vitest'
import { filterHistoryByRange, getConditionPrice, formatVariants } from './priceUtils'

const makeHistory = (dates: string[]) =>
  dates.map(date => ({ date, price: 100, source: 'supabase' as const }))

describe('filterHistoryByRange', () => {
  const today = '2026-06-25'

  it('returns all points for "all"', () => {
    const h = makeHistory(['2024-01-01', '2025-01-01', today])
    expect(filterHistoryByRange(h, 'all', today)).toHaveLength(3)
  })

  it('filters to last 30 days', () => {
    const h = makeHistory(['2026-05-01', '2026-06-01', '2026-06-20', today])
    const result = filterHistoryByRange(h, 30, today)
    expect(result.map(p => p.date)).toEqual(['2026-06-01', '2026-06-20', today])
  })

  it('filters to last 90 days', () => {
    const h = makeHistory(['2026-01-01', '2026-04-01', '2026-06-01', today])
    const result = filterHistoryByRange(h, 90, today)
    expect(result.map(p => p.date)).toEqual(['2026-04-01', '2026-06-01', today])
  })

  it('filters to last 180 days', () => {
    const h = makeHistory(['2025-11-01', '2026-01-01', '2026-06-01', today])
    const result = filterHistoryByRange(h, 180, today)
    expect(result.map(p => p.date)).toEqual(['2026-01-01', '2026-06-01', today])
  })

  it('filters to last 365 days', () => {
    const h = makeHistory(['2024-06-01', '2025-07-01', '2026-06-01', today])
    const result = filterHistoryByRange(h, 365, today)
    expect(result.map(p => p.date)).toEqual(['2025-07-01', '2026-06-01', today])
  })

  it('filters YTD from Jan 1 of current year', () => {
    const h = makeHistory(['2025-12-31', '2026-01-01', '2026-03-15', today])
    const result = filterHistoryByRange(h, 'ytd', today)
    expect(result.map(p => p.date)).toEqual(['2026-01-01', '2026-03-15', today])
  })

  it('returns empty array for empty history', () => {
    expect(filterHistoryByRange([], 90, today)).toEqual([])
  })

  it('preserves order (ascending by date)', () => {
    const h = makeHistory([today, '2026-06-20', '2026-06-15'])
    const result = filterHistoryByRange(h, 30, today)
    const dates = result.map(p => p.date)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('getConditionPrice', () => {
  const allConditions = {
    Ungraded: 100,
    'PSA 10': 500,
    'PSA 9': 300,
    'PSA 8': 200,
    'CGC 9': 280,
    'CGC 10': null,
  }

  it('returns raw price for "raw" condition', () => {
    expect(getConditionPrice(allConditions, 'raw')).toBe(100)
  })

  it('returns PSA 10 price for "psa10"', () => {
    expect(getConditionPrice(allConditions, 'psa10')).toBe(500)
  })

  it('returns PSA 9 price for "psa9"', () => {
    expect(getConditionPrice(allConditions, 'psa9')).toBe(300)
  })

  it('returns PSA 8 price for "psa8"', () => {
    expect(getConditionPrice(allConditions, 'psa8')).toBe(200)
  })

  it('returns null for condition with no price', () => {
    expect(getConditionPrice(allConditions, 'cgc10')).toBeNull()
  })

  it('returns null for unknown condition', () => {
    expect(getConditionPrice(allConditions, 'unknown')).toBeNull()
  })

  it('returns null for empty allConditions', () => {
    expect(getConditionPrice({}, 'raw')).toBeNull()
  })
})

describe('formatVariants', () => {
  it('returns "—" for null', () => {
    expect(formatVariants(null)).toBe('—')
  })

  it('returns "—" for empty object', () => {
    expect(formatVariants({})).toBe('—')
  })

  it('lists true variant keys', () => {
    const result = formatVariants({ normal: true, holo: true, reverse: false, firstEdition: false })
    expect(result).toBe('Normal, Holo')
  })

  it('returns "—" when all variants are false', () => {
    expect(formatVariants({ normal: false, holo: false })).toBe('—')
  })

  it('capitalises first letter of each variant key', () => {
    expect(formatVariants({ firstEdition: true })).toBe('FirstEdition')
  })
})
