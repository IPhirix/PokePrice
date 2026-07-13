/**
 * TDD tests for the card variation picker helpers.
 *
 * Regression: getCardVariations previously returned TCGdex card objects
 * (id/name/number/set/images) instead of PriceCharting product rows
 * (product_name/console_name/pricecharting_id), so the picker rendered a
 * list of blank buttons whenever "variations" existed. These helpers ensure
 * the picker only ever shows fully-formed rows, and never displays a list
 * when there's nothing (or only one thing) to pick between.
 */

import {
  isValidVariation,
  filterValidVariations,
  shouldShowVariationPicker,
} from '../utils/cardVariations'

// ── isValidVariation ─────────────────────────────────────────────────────────

describe('isValidVariation', () => {
  it('accepts a fully-formed variation row', () =>
    expect(
      isValidVariation({ product_name: 'Charizard #4 [Holo]', console_name: 'Pokemon Base Set', pricecharting_id: 123 }),
    ).toBe(true))

  it('rejects a row missing product_name (blank list regression)', () =>
    expect(isValidVariation({ console_name: 'Pokemon Base Set', pricecharting_id: 123 })).toBe(false))

  it('rejects a row with empty-string product_name', () =>
    expect(isValidVariation({ product_name: '', pricecharting_id: 123 })).toBe(false))

  it('rejects a row missing pricecharting_id', () =>
    expect(isValidVariation({ product_name: 'Charizard #4' })).toBe(false))

  it('rejects null', () => expect(isValidVariation(null)).toBe(false))
  it('rejects undefined', () => expect(isValidVariation(undefined)).toBe(false))
  it('rejects a string', () => expect(isValidVariation('Charizard')).toBe(false))
})

// ── filterValidVariations ────────────────────────────────────────────────────

describe('filterValidVariations', () => {
  it('keeps only valid rows out of a mixed list', () => {
    const rows = [
      { product_name: 'Charizard #4 [Holo]', pricecharting_id: 1 },
      { id: 'base1-4', name: 'Charizard', number: '4' }, // shape from the old TCGdex bug
      { product_name: 'Charizard #4 [1st Edition]', pricecharting_id: 2 },
    ]
    expect(filterValidVariations(rows)).toHaveLength(2)
  })

  it('returns empty array for null', () => expect(filterValidVariations(null)).toEqual([]))
  it('returns empty array for undefined', () => expect(filterValidVariations(undefined)).toEqual([]))
  it('returns empty array for non-array input', () => expect(filterValidVariations({})).toEqual([]))
  it('returns empty array for empty array', () => expect(filterValidVariations([])).toEqual([]))
})

// ── shouldShowVariationPicker ─────────────────────────────────────────────────

describe('shouldShowVariationPicker', () => {
  it('is false with no variations', () => expect(shouldShowVariationPicker([])).toBe(false))

  it('is false with a single valid variation (auto-selected instead)', () =>
    expect(shouldShowVariationPicker([{ product_name: 'Charizard #4', pricecharting_id: 1 }])).toBe(false))

  it('is true with two or more valid variations', () =>
    expect(
      shouldShowVariationPicker([
        { product_name: 'Charizard #4 [Holo]', pricecharting_id: 1 },
        { product_name: 'Charizard #4 [1st Edition]', pricecharting_id: 2 },
      ]),
    ).toBe(true))

  it('is false when the backend returns entries that all fail validation', () =>
    expect(
      shouldShowVariationPicker([
        { id: 'base1-4', name: 'Charizard' },
        { id: 'base1-5', name: 'Blastoise' },
      ]),
    ).toBe(false))

  it('ignores invalid rows when counting toward the threshold', () =>
    expect(
      shouldShowVariationPicker([
        { product_name: 'Charizard #4 [Holo]', pricecharting_id: 1 },
        { id: 'base1-4', name: 'Charizard' },
      ]),
    ).toBe(false))
})
