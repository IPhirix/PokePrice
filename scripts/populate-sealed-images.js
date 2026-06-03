#!/usr/bin/env node
/**
 * Populates sealed_images with set logo images from pokemontcg.io.
 * Each sealed product gets the logo of its parent set — recognizable and reliable.
 *
 * Prerequisites:
 *   1. Run migrations/sealed_images.sql in Supabase
 *   2. Have DATABASE_URL set in .env
 *
 * Usage:
 *   node scripts/populate-sealed-images.js
 *   node scripts/populate-sealed-images.js --refetch   (re-processes already-cached entries)
 */

require('dotenv').config()
const { Pool } = require('pg')
const axios = require('axios')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const DELAY_MS = 300  // pokemontcg.io is generous with rate limits

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Cache set name → logo URL to avoid repeat API calls for the same set
const setLogoCache = {}

async function getSetLogo(consoleName) {
  // Strip "Pokemon " prefix to get the set name used by pokemontcg.io
  const setName = consoleName.replace(/^Pokemon\s+/i, '').trim()
  if (setLogoCache[setName]) return setLogoCache[setName]

  try {
    const res = await axios.get('https://api.pokemontcg.io/v2/sets', {
      params: { q: `name:"${setName}"` },
      timeout: 10000,
    })
    const set = res.data.data?.[0]
    const logo = set?.images?.logo || null
    setLogoCache[setName] = logo
    return logo
  } catch { return null }
}

async function main() {
  const refetch = process.argv.includes('--refetch')

  // All distinct sealed products: product_name holds the type keyword (e.g. "Elite Trainer Box"),
  // console_name holds the specific set (e.g. "Pokemon Shining Fates")
  const { rows: products } = await pool.query(`
    SELECT DISTINCT ON (pricecharting_id)
      pricecharting_id,
      product_name,
      console_name
    FROM pokemon_card_prices
    WHERE product_name ~* '(Elite Trainer Box|Booster Box|Booster Bundle|Booster Pack|Collection Box|Premium Collection|Gift Box|Mini Tin|\\yTin\\y|Theme Deck|Starter Deck|Blister Pack|Display Box)'
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
    const { pricecharting_id, product_name, console_name } = todo[i]
    const label = `${console_name} – ${product_name}`
    try {
      const imageUrl = await getSetLogo(console_name)
      if (imageUrl) {
        await pool.query(`
          INSERT INTO sealed_images (pricecharting_id, product_name, image_url)
          VALUES ($1, $2, $3)
          ON CONFLICT (pricecharting_id) DO UPDATE
            SET product_name = $2, image_url = $3, updated_at = NOW()
        `, [pricecharting_id, label, imageUrl])
        ok++
        if (ok <= 5 || i === todo.length - 1) console.log(`[${i + 1}/${todo.length}] ✓  ${label}`)
        else if (ok === 6) console.log('  ... (logging every 50 after this)')
        else if (ok % 50 === 0) console.log(`[${i + 1}/${todo.length}] ✓  ${ok} saved so far...`)
      } else {
        noImage++
        if (noImage <= 10) console.log(`[${i + 1}/${todo.length}] –  ${label} (no set logo found)`)
      }
    } catch (e) {
      failed++
      console.log(`[${i + 1}/${todo.length}] ✗  ${label}: ${e.message}`)
    }
    // Only delay when we actually hit the API (cache hits are instant)
    if (!setLogoCache[console_name.replace(/^Pokemon\s+/i, '').trim()]) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nDone: ${ok} saved, ${noImage} no set logo, ${failed} errors`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
