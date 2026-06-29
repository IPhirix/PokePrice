import type { CardCondition, PricePoint } from '@pokeprice/types'
import type { Pool } from 'pg'

// Maps card condition to the pokemon_prices column that holds its price
export const CONDITION_COL: Record<string, string> = {
  raw:    'loose_price',
  psa10:  'manual_only_price',
  psa9:   'graded_price',
  psa8:   'new_price',
  cgc10:  'graded_price',
  cgc9:   'graded_price',
  sealed: 'loose_price',
}

const ALLOWED_COLS = new Set(['loose_price', 'manual_only_price', 'graded_price', 'new_price'])

interface CardRef {
  name?: string | null
  number?: string | null
  setName?: string | null
  pricechartingId?: string | null
  pricechartingName?: string | null
  condition?: CardCondition | string | null
  type?: string
}

/**
 * Resolves a card to its pricecharting_id in the Supabase pokemon_cards table.
 * Priority: pricechartingId → pricechartingName → name+number match.
 */
export async function resolveSupabaseId(pool: Pool, card: CardRef): Promise<string | null> {
  if (card.pricechartingId) return card.pricechartingId

  if (card.pricechartingName) {
    const res = await pool.query(
      `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 LIMIT 1`,
      [card.pricechartingName]
    )
    if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
  }

  if (card.name && card.number) {
    const productName = `${card.name} #${card.number}`
    if (card.setName) {
      const res = await pool.query(
        `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 AND console_name ILIKE $2 LIMIT 1`,
        [productName, `%${card.setName}%`]
      )
      if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
    }
    const res = await pool.query(
      `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 LIMIT 1`,
      [productName]
    )
    if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
  }

  return null
}

/**
 * Fetches full price history for a card+condition from the Supabase price DB.
 * Falls back to loose_price if the graded column has no data.
 */
export async function fetchPriceHistory(pool: Pool, card: CardRef): Promise<PricePoint[]> {
  const col = CONDITION_COL[card.condition ?? 'raw'] ?? 'loose_price'
  if (!ALLOWED_COLS.has(col)) return []

  const pcId = await resolveSupabaseId(pool, card)
  if (!pcId) return []

  const res = await pool.query(
    `SELECT pcp.snapshot_date::date::text AS date, pcp.${col} AS price
     FROM pokemon_card_prices pcp
     JOIN pokemon_cards pc ON pc.id = pcp.card_id
     WHERE pc.pricecharting_id = $1 AND pcp.${col} IS NOT NULL
     ORDER BY pcp.snapshot_date`,
    [pcId]
  )

  if (res.rows.length > 0) {
    return res.rows.map((r: { date: string; price: string }) => ({
      date: r.date,
      price: parseFloat(r.price),
      source: 'supabase',
    }))
  }

  // Fallback to loose_price if graded column is empty
  if (col !== 'loose_price') {
    const fallback = await pool.query(
      `SELECT pcp.snapshot_date::date::text AS date, pcp.loose_price AS price
       FROM pokemon_card_prices pcp
       JOIN pokemon_cards pc ON pc.id = pcp.card_id
       WHERE pc.pricecharting_id = $1 AND pcp.loose_price IS NOT NULL
       ORDER BY pcp.snapshot_date`,
      [pcId]
    )
    return fallback.rows.map((r: { date: string; price: string }) => ({
      date: r.date,
      price: parseFloat(r.price),
      source: 'supabase',
    }))
  }

  return []
}

/**
 * Fetches the latest price for all conditions (for CardDetail multi-grade view).
 */
export async function fetchAllConditionPrices(
  pool: Pool,
  card: CardRef
): Promise<Record<string, number | null>> {
  const pcId = await resolveSupabaseId(pool, card)
  if (!pcId) return {}

  const res = await pool.query(
    `SELECT pcp.snapshot_date::date::text AS date,
            pcp.loose_price, pcp.manual_only_price, pcp.graded_price, pcp.new_price
     FROM pokemon_card_prices pcp
     JOIN pokemon_cards pc ON pc.id = pcp.card_id
     WHERE pc.pricecharting_id = $1
     ORDER BY pcp.snapshot_date DESC
     LIMIT 1`,
    [pcId]
  )

  const row = res.rows[0]
  if (!row) return {}
  const p = (v: string | null) => (v != null ? parseFloat(v) : null)
  return {
    _snapshotDate: row.date,
    Ungraded: p(row.loose_price),
    'PSA 10': p(row.manual_only_price),
    'PSA 9':  p(row.graded_price),
    'PSA 8':  p(row.new_price),
    'CGC 10': null,
    'CGC 9':  p(row.graded_price),
  }
}

/**
 * Given a price history array, returns the latest price and % changes
 * for day / week / month windows.
 */
export function calcPriceChanges(history: PricePoint[]): {
  currentPrice: number | null
  changeDay: number | null
  changeWeek: number | null
  changeMonth: number | null
} {
  if (!history.length) return { currentPrice: null, changeDay: null, changeWeek: null, changeMonth: null }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const now = new Date(latest.date)

  function findClosest(daysAgo: number): PricePoint | undefined {
    const target = new Date(now)
    target.setDate(target.getDate() - daysAgo)
    const targetStr = target.toISOString().slice(0, 10)
    return sorted.filter(p => p.date <= targetStr).pop()
  }

  function pct(current: number, prev: number | undefined): number | null {
    if (prev == null || prev === 0) return null
    return Math.round(((current - prev) / prev) * 10000) / 100
  }

  return {
    currentPrice: latest.price,
    changeDay:   pct(latest.price, findClosest(1)?.price),
    changeWeek:  pct(latest.price, findClosest(7)?.price),
    changeMonth: pct(latest.price, findClosest(30)?.price),
  }
}
