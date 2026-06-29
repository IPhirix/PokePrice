/**
 * Builds the query object for searchCardsAdvanced when loading all cards
 * for a given Pokemon in the Pokedex detail view.
 *
 * The Rust backend (cards_search_advanced) expects a JSON object { name: "..." }.
 * Passing a string causes q["name"] to return null in Rust, returning no cards.
 */
export function buildPokemonCardQuery(displayName) {
  const name = displayName.replace(/ (Male|Female)$/, '').trim()
  return { name }
}

/**
 * Builds the query object for fetching a single card's full detail
 * (rarity, artist, types) in the background enrichment loop.
 */
export function buildCardDetailQuery(card) {
  return { name: card.name }
}
