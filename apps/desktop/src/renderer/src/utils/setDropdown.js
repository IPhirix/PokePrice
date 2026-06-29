/**
 * Pure helpers for the set-filter dropdown in CardSearch.
 * Kept separate so they can be unit-tested without React.
 */

/**
 * Returns the display label for a set: "Series - Name" when a series exists,
 * otherwise just "Name".
 */
export function formatSetDisplay(set) {
  const series = set.series || "";
  const name = set.name || "";
  return series ? `${series} - ${name}` : name;
}

/**
 * Adds a `display` field to every set and sorts the array alphabetically
 * by that display string. Does not mutate the input array.
 */
export function sortAndFormatSets(sets) {
  return sets
    .map((s) => ({ ...s, display: formatSetDisplay(s) }))
    .sort((a, b) => a.display.localeCompare(b.display));
}

/**
 * Filters an array of formatted sets (with `display` field) by a search
 * string. Matches anywhere in the display string, case-insensitively.
 * Returns all sets when query is empty.
 */
export function filterSets(formattedSets, query) {
  if (!query) return formattedSets;
  const q = query.toLowerCase();
  return formattedSets.filter((s) => s.display.toLowerCase().includes(q));
}
