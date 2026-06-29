import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildForTcgCardResult } from './prices.helpers'

// Tests for the pure helper that assembles the forTcgCard response.
// DB and pricing package calls are mocked — only the assembly logic is tested here.

describe('buildForTcgCardResult', () => {
  it('returns price for requested condition from allConditions', () => {
    const allConditions = { Ungraded: 150, 'PSA 10': 600, 'PSA 9': 350, 'PSA 8': 200, 'CGC 10': null, 'CGC 9': 300 }
    const history = [{ date: '2026-06-01', price: 140 }, { date: '2026-06-25', price: 150 }]
    const result = buildForTcgCardResult({ allConditions, history, condition: 'raw' })
    expect(result.price).toBe(150)
    expect(result.allConditions).toBe(allConditions)
    expect(result.history).toBe(history)
  })

  it('computes positive changeDay from last two history points', () => {
    const history = [
      { date: '2026-06-24', price: 100 },
      { date: '2026-06-25', price: 110 },
    ]
    const result = buildForTcgCardResult({ allConditions: { Ungraded: 110 }, history, condition: 'raw' })
    expect(result.changeDay).toBeCloseTo(10)
  })

  it('computes negative changeDay', () => {
    const history = [
      { date: '2026-06-24', price: 200 },
      { date: '2026-06-25', price: 150 },
    ]
    const result = buildForTcgCardResult({ allConditions: { Ungraded: 150 }, history, condition: 'raw' })
    expect(result.changeDay).toBeCloseTo(-25)
  })

  it('returns null changeDay when history has fewer than 2 points', () => {
    const result = buildForTcgCardResult({
      allConditions: { Ungraded: 100 },
      history: [{ date: '2026-06-25', price: 100 }],
      condition: 'raw',
    })
    expect(result.changeDay).toBeNull()
  })

  it('returns null price when allConditions missing the condition key', () => {
    const result = buildForTcgCardResult({ allConditions: {}, history: [], condition: 'raw' })
    expect(result.price).toBeNull()
  })

  it('returns null price when allConditions value is null', () => {
    const result = buildForTcgCardResult({ allConditions: { Ungraded: null }, history: [], condition: 'raw' })
    expect(result.price).toBeNull()
  })

  it('returns empty history unchanged', () => {
    const result = buildForTcgCardResult({ allConditions: {}, history: [], condition: 'psa10' })
    expect(result.history).toEqual([])
  })
})
