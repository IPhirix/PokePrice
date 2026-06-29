/**
 * Pure helpers for sealed product search detection and normalization.
 * Kept separate from components so they can be unit-tested without React.
 */

export const SEALED_KEYWORDS = [
  'elite trainer box',
  'etb',
  'booster box',
  'booster bundle',
  'booster pack',
  'collection box',
  'premium collection',
  'gift box',
  'mini tin',
  'tin',
  'theme deck',
  'starter deck',
  'blister',
  'bundle',
  'display box',
]

/**
 * Returns true when the query contains a sealed product keyword.
 * Case-insensitive. Used to decide whether to route to sealed product search.
 */
export function isSealedProductQuery(query) {
  const q = query.toLowerCase()
  return SEALED_KEYWORDS.some((k) => q.includes(k))
}

/**
 * Normalizes a sealed product search query before sending to the backend.
 * Expands abbreviations and lowercases the result.
 *   "crown zenith ETB" → "crown zenith elite trainer box"
 *   "Booster Box"      → "booster box"
 */
export function normalizeForSealedSearch(query) {
  let q = query.trim().toLowerCase()
  q = q.replace(/\betb\b/g, 'elite trainer box')
  return q
}

/**
 * Safely extracts the products array from a sealed search API response.
 * Handles the `{ products: [...] }` shape the Rust backend returns, and
 * gracefully degrades for null/undefined/old-array-format responses.
 */
export function parseSealedProducts(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return []
  return response.products || []
}
