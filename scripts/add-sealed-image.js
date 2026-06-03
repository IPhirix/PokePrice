#!/usr/bin/env node
/**
 * Manually add or update a sealed product image in the catalog.
 * Downloads the image from the provided URL and uploads it to Supabase Storage.
 *
 * Usage:
 *   node scripts/add-sealed-image.js \
 *     --name "Scarlet & Violet Surging Sparks Booster Bundle" \
 *     --type booster-bundle \
 *     --set "Surging Sparks" \
 *     --url "https://example.com/image.png" \
 *     --date "2024-11-08" \
 *     --cameos "Pikachu"
 *
 * Product types: etb | booster-bundle | booster-display | build-battle-box | other
 */

require('dotenv').config()
const { Pool } = require('pg')
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`)
  return idx !== -1 ? process.argv[idx + 1] : null
}

async function main() {
  const name      = arg('name')
  const type      = arg('type') || 'etb'
  const setName   = arg('set')
  const sourceUrl = arg('url')
  const date      = arg('date')
  const cameos    = arg('cameos') ? arg('cameos').split(',').map(s => s.trim()) : []

  if (!name || !sourceUrl) {
    console.error('Usage: node scripts/add-sealed-image.js --name "..." --url "https://..." [--type etb|booster-bundle|booster-display|build-battle-box] [--set "..."] [--date YYYY-MM-DD] [--cameos "A,B"]')
    process.exit(1)
  }

  console.log(`Adding: ${name} (${type})`)

  let imageUrl = sourceUrl
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Downloading image...')
    const imgRes = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 20000 })
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const fileName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-') + '.png'
    const { error } = await supa.storage.from('etb-images').upload(fileName, Buffer.from(imgRes.data), { contentType: imgRes.headers['content-type'] || 'image/png', upsert: true })
    if (error) throw new Error('Storage upload failed: ' + error.message)
    const { data } = supa.storage.from('etb-images').getPublicUrl(fileName)
    imageUrl = data.publicUrl
    console.log('Uploaded to Supabase Storage:', imageUrl)
  } else {
    console.log('No Supabase Storage keys — storing source URL directly')
  }

  await pool.query(`
    INSERT INTO etb_catalog (name, product_type, set_name, release_date, cameos, image_url, source_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (name) DO UPDATE SET
      product_type = $2, set_name = $3, release_date = $4,
      cameos = $5, image_url = $6, source_url = $7, updated_at = NOW()
  `, [name, type, setName, date || null, cameos, imageUrl, sourceUrl])

  console.log(`✓ Saved: ${name}`)
  await pool.end()
}

main().catch(err => { console.error(err.message); process.exit(1) })
