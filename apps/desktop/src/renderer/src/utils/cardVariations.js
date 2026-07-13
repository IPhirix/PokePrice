/**
 * Pure helpers for the "which variation?" card picker shown when a search
 * result maps to multiple pokemon_cards rows (different rarities/editions).
 * Kept separate from components so they can be unit-tested without React.
 */

/**
 * A variation row is only renderable if it carries the fields the picker
 * displays. Rows missing these render as blank buttons in the list.
 */
export function isValidVariation(v) {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.product_name === 'string' &&
    v.product_name.length > 0 &&
    v.pricecharting_id != null
  )
}

/**
 * Filters raw variation rows down to ones safe to render. Handles
 * null/undefined/non-array responses gracefully.
 */
export function filterValidVariations(vars) {
  if (!Array.isArray(vars)) return []
  return vars.filter(isValidVariation)
}

/**
 * Decides whether the variation picker should be shown at all. Only shown
 * when there's more than one valid, distinguishable option — otherwise the
 * single (or zero) result is auto-selected and the picker step is skipped.
 */
export function shouldShowVariationPicker(vars) {
  return filterValidVariations(vars).length > 1
}
