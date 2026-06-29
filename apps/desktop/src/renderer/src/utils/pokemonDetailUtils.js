/**
 * Pure utility functions for the Pokémon detail view (Pokedex → card list).
 * Extracted to be independently testable.
 */

export function parseCardNum(str) {
  if (!str) return Infinity
  const m = str.split('/')[0].match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : Infinity
}

export function rawPrice(card) {
  return card.cardmarket?.prices?.averageSellPrice
    ?? card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null
}

/**
 * Sort comparator for Pokémon cards.
 *
 * 'released': primary sort by set.releaseDate (ISO string), secondary by card number.
 *   Cards with no date sort last.
 * 'number': sort by the numeric part of the card's number field.
 * 'price': sort by rawPrice. Cards with null price sort last (not NaN).
 */
export function compareCards(a, b, sortBy, sortDir) {
  let cmp = 0

  if (sortBy === 'released') {
    const da = a.set?.releaseDate || ''
    const db = b.set?.releaseDate || ''
    if (!da && !db) cmp = parseCardNum(a.number) - parseCardNum(b.number)
    else if (!da) cmp = 1
    else if (!db) cmp = -1
    else cmp = da.localeCompare(db) || parseCardNum(a.number) - parseCardNum(b.number)
  } else if (sortBy === 'number') {
    cmp = parseCardNum(a.number) - parseCardNum(b.number)
  } else if (sortBy === 'price') {
    const pa = rawPrice(a)
    const pb = rawPrice(b)
    if (pa === null && pb === null) cmp = 0
    else if (pa === null) cmp = 1   // null prices sort last
    else if (pb === null) cmp = -1
    else cmp = pa - pb
  }

  return sortDir === 'asc' ? cmp : -cmp
}

export function sortCards(cards, sortBy, sortDir) {
  return [...cards].sort((a, b) => compareCards(a, b, sortBy, sortDir))
}

/**
 * Build the Set filter dropdown options from a list of cards.
 * Returns options sorted alphabetically by label (A → Z).
 */
export function buildSetDropdownOptions(cards) {
  const seen = new Map()
  cards.forEach((c) => {
    if (c.set?.id && !seen.has(c.set.id)) {
      const series = c.set.series && c.set.series !== c.set.name ? c.set.series : ''
      const label = series ? `${series} - ${c.set.name || c.set.id}` : (c.set.name || c.set.id)
      seen.set(c.set.id, { id: c.set.id, label, releaseDate: c.set.releaseDate || '' })
    }
  })
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label))
}
