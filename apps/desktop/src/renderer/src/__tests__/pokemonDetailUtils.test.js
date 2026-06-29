import { sortCards, buildSetDropdownOptions, rawPrice, parseCardNum } from '../utils/pokemonDetailUtils'

// ── fixtures ────────────────────────────────────────────────────────────────────

function card(overrides) {
  return {
    id: 'base1-1',
    name: 'Pikachu',
    number: '1',
    set: { id: 'base1', name: 'Base Set', series: 'Base', releaseDate: '' },
    cardmarket: null,
    tcgplayer: null,
    ...overrides,
  }
}

// ── parseCardNum ─────────────────────────────────────────────────────────────

describe('parseCardNum', () => {
  it('parses plain number', () => expect(parseCardNum('25')).toBe(25))
  it('parses n/total format', () => expect(parseCardNum('25/102')).toBe(25))
  it('returns Infinity for null', () => expect(parseCardNum(null)).toBe(Infinity))
  it('returns Infinity for empty string', () => expect(parseCardNum('')).toBe(Infinity))
})

// ── rawPrice ─────────────────────────────────────────────────────────────────

describe('rawPrice', () => {
  it('returns null when no price data', () => expect(rawPrice(card())).toBeNull())
  it('returns cardmarket average sell price', () => {
    expect(rawPrice(card({ cardmarket: { prices: { averageSellPrice: 1.5 } } }))).toBe(1.5)
  })
  it('returns tcgplayer normal market price', () => {
    expect(rawPrice(card({ tcgplayer: { prices: { normal: { market: 2.0 } } } }))).toBe(2.0)
  })
})

// ── sortCards — 'released' ────────────────────────────────────────────────────

describe("sortCards 'released'", () => {
  it('asc puts earlier release date first', () => {
    const cards = [
      card({ id: 'b', number: '2', set: { id: 's2', name: 'S2', releaseDate: '2020-01-01' } }),
      card({ id: 'a', number: '1', set: { id: 's1', name: 'S1', releaseDate: '2019-01-01' } }),
    ]
    const result = sortCards(cards, 'released', 'asc')
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
  })

  it('desc reverses the date order', () => {
    const cards = [
      card({ id: 'a', number: '1', set: { id: 's1', name: 'S1', releaseDate: '2019-01-01' } }),
      card({ id: 'b', number: '2', set: { id: 's2', name: 'S2', releaseDate: '2020-01-01' } }),
    ]
    const result = sortCards(cards, 'released', 'desc')
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('a')
  })

  it('cards with no releaseDate sort last', () => {
    const cards = [
      card({ id: 'no-date', number: '1', set: { id: 's0', name: 'S0', releaseDate: '' } }),
      card({ id: 'has-date', number: '2', set: { id: 's1', name: 'S1', releaseDate: '2019-01-01' } }),
    ]
    const result = sortCards(cards, 'released', 'asc')
    expect(result[0].id).toBe('has-date')
    expect(result[1].id).toBe('no-date')
  })

  it('secondary sort by card number when dates are equal', () => {
    const cards = [
      card({ id: 'c2', number: '25', set: { id: 's1', name: 'S1', releaseDate: '2019-01-01' } }),
      card({ id: 'c1', number: '3',  set: { id: 's1', name: 'S1', releaseDate: '2019-01-01' } }),
    ]
    const result = sortCards(cards, 'released', 'asc')
    expect(result[0].id).toBe('c1')
    expect(result[1].id).toBe('c2')
  })
})

// ── sortCards — 'price' ───────────────────────────────────────────────────────

describe("sortCards 'price'", () => {
  it('asc puts lower price first', () => {
    const cards = [
      card({ id: 'expensive', cardmarket: { prices: { averageSellPrice: 10 } } }),
      card({ id: 'cheap',     cardmarket: { prices: { averageSellPrice: 1  } } }),
    ]
    const result = sortCards(cards, 'price', 'asc')
    expect(result[0].id).toBe('cheap')
    expect(result[1].id).toBe('expensive')
  })

  it('desc puts higher price first', () => {
    const cards = [
      card({ id: 'cheap',     cardmarket: { prices: { averageSellPrice: 1  } } }),
      card({ id: 'expensive', cardmarket: { prices: { averageSellPrice: 10 } } }),
    ]
    const result = sortCards(cards, 'price', 'desc')
    expect(result[0].id).toBe('expensive')
    expect(result[1].id).toBe('cheap')
  })

  it('cards with null price sort last (not NaN crash)', () => {
    const cards = [
      card({ id: 'no-price' }),
      card({ id: 'priced', cardmarket: { prices: { averageSellPrice: 5 } } }),
    ]
    const result = sortCards(cards, 'price', 'asc')
    expect(result[0].id).toBe('priced')
    expect(result[1].id).toBe('no-price')
  })

  it('all null prices — stable, no NaN, returns same length', () => {
    const cards = [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c' })]
    const result = sortCards(cards, 'price', 'asc')
    expect(result).toHaveLength(3)
    result.forEach((c) => expect(isNaN(rawPrice(c) ?? 0)).toBe(false))
  })
})

// ── sortCards — 'number' ──────────────────────────────────────────────────────

describe("sortCards 'number'", () => {
  it('asc sorts numerically not lexicographically', () => {
    const cards = [
      card({ id: 'c9', number: '9' }),
      card({ id: 'c11', number: '11' }),
      card({ id: 'c2', number: '2' }),
    ]
    const result = sortCards(cards, 'number', 'asc')
    expect(result.map((c) => c.id)).toEqual(['c2', 'c9', 'c11'])
  })
})

// ── buildSetDropdownOptions ────────────────────────────────────────────────────

describe('buildSetDropdownOptions', () => {
  it('sorts sets alphabetically by label A→Z', () => {
    const cards = [
      card({ set: { id: 'sv1',  name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023-03-31' } }),
      card({ set: { id: 'base1', name: 'Base Set',         series: 'Base',              releaseDate: '1999-01-09' } }),
      card({ set: { id: 'xy1',  name: 'XY',               series: 'XY',                releaseDate: '2014-02-05' } }),
    ]
    const opts = buildSetDropdownOptions(cards)
    const labels = opts.map((o) => o.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b))
    expect(labels).toEqual(sorted)
  })

  it('does NOT sort by release date', () => {
    const cards = [
      card({ set: { id: 'recent', name: 'Zzz Set', series: '', releaseDate: '2024-01-01' } }),
      card({ set: { id: 'old',    name: 'Aaa Set', series: '', releaseDate: '1999-01-01' } }),
    ]
    const opts = buildSetDropdownOptions(cards)
    // Alphabetically: Aaa Set first, Zzz Set second
    expect(opts[0].label).toBe('Aaa Set')
    expect(opts[1].label).toBe('Zzz Set')
  })

  it('deduplicates cards from the same set', () => {
    const setData = { id: 'base1', name: 'Base Set', series: 'Base', releaseDate: '1999-01-09' }
    const cards = [
      card({ id: 'base1-1', set: setData }),
      card({ id: 'base1-2', set: setData }),
    ]
    const opts = buildSetDropdownOptions(cards)
    expect(opts).toHaveLength(1)
  })
})
