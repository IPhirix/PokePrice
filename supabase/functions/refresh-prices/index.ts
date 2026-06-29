// Supabase Edge Function — runs daily at 8am via cron schedule.
// Iterates all users' collections + watchlists, looks up latest price
// from pokemon_prices (PriceCharting data), writes to pokemon_card_prices.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Pool } from 'https://deno.land/x/pg@v0.17.0/mod.ts'

const CONDITION_COL: Record<string, string> = {
  raw:    'loose_price',
  psa10:  'manual_only_price',
  psa9:   'graded_price',
  psa8:   'new_price',
  cgc10:  'graded_price',
  cgc9:   'graded_price',
  sealed: 'loose_price',
}

const ALLOWED_COLS = new Set(['loose_price', 'manual_only_price', 'graded_price', 'new_price'])

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const dbUrl       = Deno.env.get('DATABASE_URL')!

    const sb = createClient(supabaseUrl, serviceKey)
    const pool = new Pool(dbUrl, 3)

    const today = new Date().toISOString().slice(0, 10)
    let refreshed = 0
    let errors = 0

    for (const table of ['collections', 'watchlists'] as const) {
      // Fetch all cards across all users
      const { data: cards, error } = await sb.from(table).select('id, user_id, condition, pricecharting_id, pricecharting_name, name, number, set_name')
      if (error) { console.error(`Failed to fetch ${table}:`, error.message); continue }

      for (const card of cards ?? []) {
        try {
          const col = CONDITION_COL[card.condition] ?? 'loose_price'
          if (!ALLOWED_COLS.has(col)) continue

          const pcId = await resolveId(pool, card)
          if (!pcId) continue

          const client = await pool.connect()
          let price: number | null = null
          try {
            const res = await client.queryObject<{ price: string }>(
              `SELECT pcp.${col} AS price
               FROM pokemon_card_prices pcp
               JOIN pokemon_cards pc ON pc.id = pcp.card_id
               WHERE pc.pricecharting_id = $1 AND pcp.${col} IS NOT NULL
               ORDER BY pcp.snapshot_date DESC
               LIMIT 1`,
              [pcId]
            )
            price = res.rows[0] ? parseFloat(res.rows[0].price) : null
          } finally {
            client.release()
          }

          if (price == null) continue

          await sb.from('card_price_history').upsert({
            card_id:    card.id,
            card_table: table,
            user_id:    card.user_id,
            date:       today,
            price,
            source:     'supabase',
          }, { onConflict: 'card_id,date' })

          refreshed++
        } catch (err) {
          console.error(`Price refresh failed for card ${card.id}:`, (err as Error).message)
          errors++
        }
      }
    }

    await pool.end()
    return new Response(JSON.stringify({ ok: true, refreshed, errors }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function resolveId(pool: Pool, card: { pricecharting_id?: string; pricecharting_name?: string; name?: string; number?: string; set_name?: string }): Promise<string | null> {
  if (card.pricecharting_id) return card.pricecharting_id

  const client = await pool.connect()
  try {
    if (card.pricecharting_name) {
      const res = await client.queryObject<{ pricecharting_id: string }>(
        `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 LIMIT 1`,
        [card.pricecharting_name]
      )
      if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
    }

    if (card.name && card.number) {
      const productName = `${card.name} #${card.number}`
      if (card.set_name) {
        const res = await client.queryObject<{ pricecharting_id: string }>(
          `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 AND console_name ILIKE $2 LIMIT 1`,
          [productName, `%${card.set_name}%`]
        )
        if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
      }
      const res = await client.queryObject<{ pricecharting_id: string }>(
        `SELECT pricecharting_id FROM pokemon_cards WHERE product_name ILIKE $1 LIMIT 1`,
        [productName]
      )
      if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
    }
  } finally {
    client.release()
  }
  return null
}
