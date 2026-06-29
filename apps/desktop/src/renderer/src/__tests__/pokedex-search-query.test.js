/**
 * Tests for the query format passed to searchCardsAdvanced when loading
 * a Pokemon's card list from the Pokedex detail view.
 *
 * Bug: Pokedex.jsx was passing a string like `name:"Pikachu*"` to
 * searchCardsAdvanced. The Rust backend expects a JSON object { name: "..." }.
 * Indexing a string Value in Rust returns null, so name is "", and the
 * function returns [] immediately — no cards shown.
 */

import { buildPokemonCardQuery, buildCardDetailQuery } from '../utils/pokemonSearchQuery'

describe('buildPokemonCardQuery', () => {
  it('returns an object, not a string', () => {
    const result = buildPokemonCardQuery('Pikachu')
    expect(typeof result).toBe('object')
    expect(result).not.toBeNull()
  })

  it('has a name property matching the pokemon display name', () => {
    const result = buildPokemonCardQuery('Pikachu')
    expect(result).toHaveProperty('name', 'Pikachu')
  })

  it('strips Male/Female suffix before building query', () => {
    expect(buildPokemonCardQuery('Nidoran Male')).toHaveProperty('name', 'Nidoran')
    expect(buildPokemonCardQuery('Nidoran Female')).toHaveProperty('name', 'Nidoran')
  })

  it('does not produce a Lucene-style string like name:"Pikachu*"', () => {
    const result = buildPokemonCardQuery('Pikachu')
    expect(typeof result).not.toBe('string')
  })
})

describe('buildCardDetailQuery', () => {
  it('returns an object with a name property', () => {
    const card = { id: 'swsh1-1', name: 'Pikachu' }
    const result = buildCardDetailQuery(card)
    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('name', 'Pikachu')
  })

  it('does not produce a Lucene-style id string like id:"swsh1-1"', () => {
    const card = { id: 'swsh1-1', name: 'Pikachu' }
    const result = buildCardDetailQuery(card)
    expect(typeof result).not.toBe('string')
  })
})
