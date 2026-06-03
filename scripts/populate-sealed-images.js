#!/usr/bin/env node
/**
 * Fetches product images for all sealed Pokémon products in the DB
 * and stores them in the sealed_images table.
 *
 * Prerequisites:
 *   1. Run migrations/sealed_images.sql in Supabase
 *   2. Have DATABASE_URL set in .env
 *
 * Usage:
 *   node scripts/populate-sealed-images.js
 *   node scripts/populate-sealed-images.js --refetch   (re-fetches already-cached entries)
 */

require('dotenv').config()
const { Pool } = require('pg')
const axios = require('axios')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const DELAY_MS = 700  // ~85 req/min — polite to PriceCharting

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPriceChartingImage(pricechartingId) {
  const url = `https://www.pricecharting.com/offers?id=${pricechartingId}`
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000,
  })
  // Try og:image first (most reliable), then fall back to the main product img tag
  const ogMatch = data.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
    || data.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
  if (ogMatch) return ogMatch[1]

  const imgMatch = data.match(/id="product_image"[^>]+src="([^"]+)"/)
    || data.match(/class="[^"]*product-image[^"]*"[^>]+src="([^"]+)"/)
  return imgMatch ? imgMatch[1] : null
}

async function main() {
  const refetch = process.argv.includes('--refetch')

  // All distinct sealed products in the DB
  const { rows: products } = await pool.query(`
    SELECT DISTINCT ON (pricecharting_id)
      pricecharting_id,
      product_name,
      console_name
    FROM pokemon_card_prices
    WHERE console_name ILIKE '%sealed%'
    ORDER BY pricecharting_id, snapshot_date DESC
  `)
  console.log(`Found ${products.length} sealed products in DB`)

  let todo = products
  if (!refetch) {
    const { rows: existing } = await pool.query(`SELECT pricecharting_id FROM sealed_images`)
    const done = new Set(existing.map(r => r.pricecharting_id))
    todo = products.filter(p => !done.has(p.pricecharting_id))
    console.log(`${done.size} already cached, fetching ${todo.length} new`)
  }

  if (todo.length === 0) {
    console.log('Nothing to do.')
    await pool.end()
    return
  }

  let ok = 0, noImage = 0, failed = 0
  for (let i = 0; i < todo.length; i++) {
    const { pricecharting_id, product_name } = todo[i]
    try {
      const imageUrl = await fetchPriceChartingImage(pricecharting_id)
      if (imageUrl) {
        await pool.query(`
          INSERT INTO sealed_images (pricecharting_id, product_name, image_url)
          VALUES ($1, $2, $3)
          ON CONFLICT (pricecharting_id) DO UPDATE
            SET product_name = $2, image_url = $3, updated_at = NOW()
        `, [pricecharting_id, product_name, imageUrl])
        ok++
        console.log(`[${i + 1}/${todo.length}] ✓  ${product_name}`)
      } else {
        noImage++
        console.log(`[${i + 1}/${todo.length}] –  ${product_name} (no image found)`)
      }
    } catch (e) {
      failed++
      console.log(`[${i + 1}/${todo.length}] ✗  ${product_name}: ${e.message}`)
    }
    if (i < todo.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\nDone: ${ok} saved, ${noImage} no image, ${failed} errors`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
