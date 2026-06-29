export interface PricePoint {
  date: string
  price: number
  source?: string
}

export type ChartRange = 30 | 90 | 180 | 365 | 'ytd' | 'all'

// Maps our condition keys to allConditions keys returned by fetchAllConditionPrices
const CONDITION_LABEL: Record<string, string> = {
  raw:   'Ungraded',
  psa10: 'PSA 10',
  psa9:  'PSA 9',
  psa8:  'PSA 8',
  cgc10: 'CGC 10',
  cgc9:  'CGC 9',
}

export function filterHistoryByRange(
  history: PricePoint[],
  range: ChartRange,
  today: string = new Date().toISOString().slice(0, 10)
): PricePoint[] {
  if (!history.length) return []

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))

  if (range === 'all') return sorted

  let cutoff: string
  if (range === 'ytd') {
    cutoff = `${today.slice(0, 4)}-01-01`
  } else {
    const d = new Date(today)
    d.setDate(d.getDate() - range)
    cutoff = d.toISOString().slice(0, 10)
  }

  return sorted.filter(p => p.date >= cutoff)
}

export function getConditionPrice(
  allConditions: Record<string, number | null>,
  condition: string
): number | null {
  const label = CONDITION_LABEL[condition]
  if (!label) return null
  return allConditions[label] ?? null
}

export function formatVariants(variants: Record<string, boolean> | null | undefined): string {
  if (!variants) return '—'
  const active = Object.entries(variants)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
  return active.length ? active.join(', ') : '—'
}
