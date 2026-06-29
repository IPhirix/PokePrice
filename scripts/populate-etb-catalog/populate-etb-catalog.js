#!/usr/bin/env node
/**
 * Scrapes the Elite Trainer Box list from elitefourum.com and populates
 * the etb_catalog table. Optionally downloads images to Supabase Storage.
 *
 * Prerequisites:
 *   1. Run migrations/etb_catalog.sql in Supabase
 *   2. DATABASE_URL in .env
 *   3. For image upload: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *      and create the 'etb-images' bucket in your Supabase Storage dashboard
 *
 * Usage:
 *   node scripts/populate-etb-catalog.js                  # store CDN URLs only
 *   node scripts/populate-etb-catalog.js --upload-images  # download + upload to Supabase Storage
 *   node scripts/populate-etb-catalog.js --refetch        # re-scrape even if already cached
 */

require('dotenv').config()
const { Pool } = require('pg')
const axios = require('axios')
const cheerio = require('cheerio')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const DELAY_MS = 400
const FORUM_URL = 'https://www.elitefourum.com/t/list-of-all-elite-trainer-boxes-etbs-cameo-list/40562.json'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseDate(str) {
  if (!str) return null
  const d = new Date(str.trim())
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

function parseMsrp(str) {
  if (!str) return null
  const m = str.match(/\$?([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

function parseCameos(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

// Extract ETB entries from the cooked HTML of the forum post
function parseEtbs(html) {
  const $ = cheerio.load(html)
  const entries = []

  // Each ETB block: a heading followed by a details paragraph and image(s)
  $('h2, h3').each((_, heading) => {
    const name = $(heading).text().trim()
    if (!name || name.length < 5) return

    let releaseDate = null, msrp = null, cameos = []
    const imageUrls = []

    // Walk siblings until next heading
    let el = $(heading).next()
    while (el.length && !el.is('h2, h3')) {
      const text = el.text()

      if (el.is('p')) {
        // Look for Release Date / MSRP / Cameos in paragraph text
        const rdMatch = text.match(/Release Date[:\s]+([^\n|]+)/i)
        if (rdMatch) releaseDate = parseDate(rdMatch[1])

        const msrpMatch = text.match(/MSRP[:\s]+([^\n|]+)/i)
        if (msrpMatch) msrp = parseMsrp(msrpMatch[1])

        const cameoMatch = text.match(/Cameos?[:\s]+([^\n]+)/i)
        if (cameoMatch) cameos = parseCameos(cameoMatch[1])
      }

      // Collect image URLs (original quality from CDN)
      el.find('img[src]').each((_, img) => {
        let src = $(img).attr('src')
        if (!src) return
        // Prefer original over optimized thumbnails; strip Discourse version suffixes (_2, _2_457x485, etc.)
        src = src.replace(/\/optimized\/[^/]+\//, '/original/3X/')
          .replace(/_\d+x\d+(\.\w+)$/, '$1')
          .replace(/_\d+(\.\w+)$/, '$1')
        if (src.includes('efour.b-cdn.net') && !imageUrls.includes(src)) {
          imageUrls.push(src)
        }
      })

      el = el.next()
    }

    // One entry per image (each image = a distinct ETB variant)
    if (imageUrls.length === 0) return
    if (imageUrls.length === 1) {
      entries.push({ name, releaseDate, msrp, cameos, sourceUrl: imageUrls[0] })
    } else {
      imageUrls.forEach((url, i) => {
        entries.push({
          name: `${name} (variant ${i + 1})`,
          releaseDate, msrp, cameos,
          sourceUrl: url,
        })
      })
    }
  })

  return entries
}

async function uploadToSupabase(name, imageBuffer, contentType) {
  const { createClient } = require('@supabase/supabase-js')
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const fileName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-') + '.png'
  const { error } = await supa.storage.from('etb-images').upload(fileName, imageBuffer, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data } = supa.storage.from('etb-images').getPublicUrl(fileName)
  return data.publicUrl
}

async function main() {
  const uploadImages = process.argv.includes('--upload-images')
  const refetch = process.argv.includes('--refetch')

  if (uploadImages && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('--upload-images requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  // Fetch and parse the forum post
  console.log('Fetching ETB list from elitefourum.com...')
  const res = await axios.get(FORUM_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    timeout: 15000,
  })
  const firstPost = res.data.post_stream?.posts?.[0]
  if (!firstPost?.cooked) throw new Error('Could not find post content in API response')

  const etbs = parseEtbs(firstPost.cooked)
  console.log(`Parsed ${etbs.length} ETB entries from forum post`)

  // Skip already-cached entries unless --refetch
  let todo = etbs
  if (!refetch) {
    const { rows } = await pool.query('SELECT name FROM etb_catalog')
    const existing = new Set(rows.map(r => r.name))
    todo = etbs.filter(e => !existing.has(e.name))
    console.log(`${existing.size} already in DB, processing ${todo.length} new/changed entries`)
  }

  if (todo.length === 0) {
    console.log('Nothing to do.')
    await pool.end()
    return
  }

  let ok = 0, failed = 0
  for (let i = 0; i < todo.length; i++) {
    const { name, releaseDate, msrp, cameos, sourceUrl } = todo[i]
    let imageUrl = sourceUrl  // default to CDN URL

    try {
      if (uploadImages) {
        const imgRes = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 15000 })
        imageUrl = await uploadToSupabase(name, Buffer.from(imgRes.data), imgRes.headers['content-type'] || 'image/png')
        await sleep(DELAY_MS)
      }

      await pool.query(`
        INSERT INTO etb_catalog (name, release_date, msrp_usd, cameos, image_url, source_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO UPDATE SET
          release_date = $2, msrp_usd = $3, cameos = $4,
          image_url = $5, source_url = $6, updated_at = NOW()
      `, [name, releaseDate, msrp, cameos, imageUrl, sourceUrl])

      ok++
      console.log(`[${i + 1}/${todo.length}] ✓  ${name}`)
    } catch (e) {
      failed++
      console.log(`[${i + 1}/${todo.length}] ✗  ${name}: ${e.message}`)
    }
  }

  console.log(`\nDone: ${ok} saved, ${failed} errors`)
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
