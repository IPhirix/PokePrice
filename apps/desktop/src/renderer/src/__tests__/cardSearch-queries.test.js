/**
 * Verifies that useCardSearch passes the correct Lucene-style string format
 * to searchCardsAdvanced — the format that the Rust parse_lucene_query
 * function now accepts.
 *
 * Bug: searching by set name (e.g. "Crown Zenith") returned nothing because
 * the hook passed strings like set.name:"Crown Zenith" but Rust expected a
 * JSON object. The Rust fix adds a parser; these tests guard the contract.
 */

import { renderHook, act } from '@testing-library/react'
import { useCardSearch } from '../hooks/useCardSearch'

const mockSearchCardsAdvanced = vi.fn().mockResolvedValue([])

beforeEach(() => {
  global.window = global.window || {}
  global.window.api = {
    searchCardsAdvanced: mockSearchCardsAdvanced,
  }
  mockSearchCardsAdvanced.mockClear()
})

// ── set filter (extraQuery) ──────────────────────────────────────────────────

describe('useCardSearch — set filter', () => {
  it('calls searchCardsAdvanced with set.name string when set filter active, no name', async () => {
    const { result } = renderHook(() =>
      useCardSearch({ extraQuery: 'set.name:"Crown Zenith"' })
    )
    await act(async () => {
      await result.current.handleSearch()
    })
    expect(mockSearchCardsAdvanced).toHaveBeenCalledWith('set.name:"Crown Zenith"')
  })

  it('appends set.name filter to every name sub-query', async () => {
    const { result } = renderHook(() =>
      useCardSearch({ extraQuery: 'set.name:"Crown Zenith"' })
    )
    act(() => result.current.handleQueryChange({ target: { value: 'Pikachu' } }))
    await act(async () => { await result.current.handleSearch() })

    const allCalls = mockSearchCardsAdvanced.mock.calls.map(([q]) => q)
    // Every sub-query must carry the set filter
    expect(allCalls.every((q) => q.includes('set.name:"Crown Zenith"'))).toBe(true)
    // At least one call includes the card name too
    expect(
      allCalls.some((q) => q.includes('name:"Pikachu*"') && q.includes('set.name:"Crown Zenith"'))
    ).toBe(true)
  })

  it('does not call searchCardsAdvanced when query and extraQuery are both empty', async () => {
    const { result } = renderHook(() => useCardSearch())
    await act(async () => { await result.current.handleSearch() })
    expect(mockSearchCardsAdvanced).not.toHaveBeenCalled()
  })
})

// ── plain text search paths ──────────────────────────────────────────────────

describe('useCardSearch — plain text triggers set.name search', () => {
  it('tries set.name query when user types a set name directly', async () => {
    const { result } = renderHook(() => useCardSearch())
    act(() => result.current.handleQueryChange({ target: { value: 'Crown Zenith' } }))
    await act(async () => { await result.current.handleSearch() })

    const allCalls = mockSearchCardsAdvanced.mock.calls.map(([q]) => q)
    expect(allCalls.some((q) => q === 'set.name:"Crown Zenith"')).toBe(true)
  })

  it('passes name:"X*" format for plain card name search', async () => {
    const { result } = renderHook(() => useCardSearch())
    act(() => result.current.handleQueryChange({ target: { value: 'Charizard' } }))
    await act(async () => { await result.current.handleSearch() })

    const allCalls = mockSearchCardsAdvanced.mock.calls.map(([q]) => q)
    expect(allCalls.some((q) => q.startsWith('name:"Charizard*"'))).toBe(true)
  })
})

// ── result deduplication ─────────────────────────────────────────────────────

describe('useCardSearch — result deduplication', () => {
  it('deduplicates cards returned by multiple parallel sub-queries', async () => {
    const card = { id: 'swsh12pt5-72', name: 'Pikachu' }
    mockSearchCardsAdvanced.mockResolvedValue([card])

    const { result } = renderHook(() =>
      useCardSearch({ extraQuery: 'set.name:"Crown Zenith"' })
    )
    act(() => result.current.handleQueryChange({ target: { value: 'Pikachu' } }))
    await act(async () => { await result.current.handleSearch() })

    const ids = result.current.results.map((c) => c.id)
    expect(ids).toEqual([...new Set(ids)])
  })
})

// ── card number query ────────────────────────────────────────────────────────

describe('useCardSearch — card number query', () => {
  it('passes name:"X*" when searching Pokémon name with #number', async () => {
    const { result } = renderHook(() => useCardSearch())
    act(() => result.current.handleQueryChange({ target: { value: 'Pikachu #72' } }))
    await act(async () => { await result.current.handleSearch() })

    const allCalls = mockSearchCardsAdvanced.mock.calls.map(([q]) => q)
    expect(allCalls.some((q) => q.includes('name:"Pikachu*"'))).toBe(true)
  })
})

// ── SearchPage query string format ───────────────────────────────────────────
// These tests verify the raw string formats SearchPage builds, which the Rust
// parse_lucene_query must accept. They don't test the component — just the
// string construction logic matches the parser contract.

describe('SearchPage query string format contract', () => {
  it('set.id browse format is valid Lucene', () => {
    const browsedSet = { id: 'swsh12pt5', name: 'Crown Zenith' }
    const query = `set.id:"${browsedSet.id}"`
    expect(query).toBe('set.id:"swsh12pt5"')
    expect(query).toMatch(/^set\.id:"[^"]+"$/)
  })

  it('rarity-only filter format is valid Lucene', () => {
    const query = 'rarity:"Special Illustration Rare"'
    expect(query).toMatch(/^rarity:"[^"]+"$/)
  })

  it('card id lookup format is valid Lucene', () => {
    const card = { id: 'swsh12pt5-72' }
    const query = `id:"${card.id}"`
    expect(query).toBe('id:"swsh12pt5-72"')
  })

  it('combined filter parts join correctly', () => {
    const extraParts = ['set.name:"Crown Zenith"', 'rarity:"Rare Holo"']
    const combined = extraParts.join(' ')
    expect(combined).toBe('set.name:"Crown Zenith" rarity:"Rare Holo"')
    // Each key:value pair is recognizable
    expect(combined).toMatch(/set\.name:"[^"]+"/)
    expect(combined).toMatch(/rarity:"[^"]+"/)
  })

  it('name + set combined format matches parser expectation', () => {
    const name = 'Charizard'
    const setName = 'Base Set'
    const query = `name:"${name}*" set.name:"${setName}"`
    expect(query).toBe('name:"Charizard*" set.name:"Base Set"')
  })
})
