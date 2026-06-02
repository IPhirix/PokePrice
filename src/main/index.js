'use strict'

const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')
const { randomUUID, pbkdf2, randomBytes } = require('crypto')
const { promisify } = require('util')
const pbkdf2Async = promisify(pbkdf2)
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cron = require('node-cron')
const { Resend } = require('resend')
const { Pool } = require('pg')
const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')
require('dotenv').config({ override: true })

const sbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  : null

let _persistSession = true

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      realtime: { transport: ws },
      auth: {
        storage: {
          getItem: (key) => {
            try { return JSON.parse(fs.readFileSync(path.join(getDataDir(), 'supabase-session.json'), 'utf8'))[key] ?? null } catch { return null }
          },
          setItem: (key, value) => {
            if (!_persistSession) return
            const f = path.join(getDataDir(), 'supabase-session.json')
            const s = (() => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} } })()
            s[key] = value
            fs.writeFileSync(f, JSON.stringify(s, null, 2))
          },
          removeItem: (key) => {
            const f = path.join(getDataDir(), 'supabase-session.json')
            try { const s = JSON.parse(fs.readFileSync(f, 'utf8')); delete s[key]; fs.writeFileSync(f, JSON.stringify(s, null, 2)) } catch {}
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      }
    })
  : null

// Force consistent userData path across dev and production builds (productName
// capitalisation differs, so pin it explicitly to 'pokeprice').
app.setPath('userData', path.join(app.getPath('appData'), 'pokeprice'))

// ── Storage ──────────────────────────────────────────────────────────────────

let dataDir = null
function getDataDir() {
  if (!dataDir) dataDir = app.getPath('userData')
  return dataDir
}

let _currentUser = null

function getUserDir() {
  if (!_currentUser) throw new Error('No authenticated user')
  const dir = path.join(getDataDir(), 'users', _currentUser)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function migrateUserData(username) {
  const userDir = path.join(getDataDir(), 'users', username)
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })
  if (fs.existsSync(path.join(userDir, 'cards.json'))) return
  for (const file of ['cards.json', 'cards.json.bak', 'trades.json', 'activity.json', 'settings.json', 'upcoming-shows.json']) {
    const src = path.join(getDataDir(), file)
    const dst = path.join(userDir, file)
    if (fs.existsSync(src) && !fs.existsSync(dst)) { try { fs.copyFileSync(src, dst) } catch {} }
  }
  try {
    for (const file of fs.readdirSync(getDataDir())) {
      if (file.startsWith('prices-') && file.endsWith('.json')) {
        const src = path.join(getDataDir(), file)
        const dst = path.join(userDir, file)
        if (!fs.existsSync(dst)) fs.copyFileSync(src, dst)
      }
    }
  } catch {}
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cardsFile() { return path.join(getUserDir(), 'cards.json') }
function priceFile(id) { return path.join(getUserDir(), `prices-${id}.json`) }
function settingsFile() { return path.join(getUserDir(), 'settings.json') }
function csvCacheDir() { return path.join(getDataDir(), 'csv-cache') }

function readCards() {
  const f = cardsFile()
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}
function writeCards(cards) {
  const f = cardsFile()
  const backup = f + '.bak'
  // Refuse to overwrite existing data with an empty array (guards against stale-read race)
  if (cards.length === 0) {
    const existing = readCards()
    if (existing.length > 0) {
      console.error('[writeCards] Blocked attempt to overwrite', existing.length, 'cards with empty array')
      return
    }
  }
  // Keep a rolling backup of the previous write
  if (fs.existsSync(f)) { try { fs.copyFileSync(f, backup) } catch {} }
  fs.writeFileSync(f, JSON.stringify(cards, null, 2))
}
function readPrices(cardId) {
  const f = priceFile(cardId)
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}
function appendPrice(cardId, entry) {
  const today = localDateStr()
  const history = readPrices(cardId).filter((p) => p.date !== today)
  history.push({ date: today, ...entry })
  history.sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(priceFile(cardId), JSON.stringify(history, null, 2))
}
// Merges historical entries without overwriting dates that already exist
function bulkLoadHistory(cardId, entries) {
  const existing = readPrices(cardId)
  const existingDates = new Set(existing.map((e) => e.date))
  const fresh = entries.filter((e) => e.price > 0 && !existingDates.has(e.date))
  if (!fresh.length) return
  const merged = [...existing, ...fresh].sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(priceFile(cardId), JSON.stringify(merged, null, 2))
}
function deleteCardData(cardId) {
  const f = priceFile(cardId)
  if (fs.existsSync(f)) fs.unlinkSync(f)
}
function readSettings() {
  const f = settingsFile()
  if (!fs.existsSync(f)) return {}
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} }
}
function writeSettings(s) {
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2))
}

function migratePortfolioToCollection() {
  const cards = readCards()
  const needsMigration = cards.some((c) => c.section === 'portfolio')
  if (!needsMigration) return
  const migrated = cards.map((c) => c.section === 'portfolio' ? { ...c, section: 'collection' } : c)
  writeCards(migrated)
}

function migrateAlertFields() {
  const cards = readCards()
  const needsMigration = cards.some((c) => 'targetBuyPrice' in c || 'targetSellPrice' in c)
  if (!needsMigration) return
  const migrated = cards.map((c) => {
    if (!('targetBuyPrice' in c) && !('targetSellPrice' in c)) return c
    let alertPrice = null, alertPct = null
    if (c.targetSellPrice != null) {
      alertPrice = c.targetSellPrice
      alertPct = c.targetSellPct ?? (c.currentPrice != null
        ? Math.round((c.targetSellPrice - c.currentPrice) / c.currentPrice * 1000) / 10 : null)
    } else if (c.targetBuyPrice != null) {
      alertPrice = c.targetBuyPrice
      alertPct = c.targetBuyPct ?? (c.currentPrice != null
        ? Math.round((c.targetBuyPrice - c.currentPrice) / c.currentPrice * 1000) / 10 : null)
    }
    const { targetBuyPrice, targetSellPrice, targetBuyPct, targetSellPct, ...rest } = c
    return { ...rest, alertPrice, alertPct }
  })
  writeCards(migrated)
}

function migrateAlertSettings() {
  const s = readSettings()
  const updates = {}
  let changed = false
  if ('alertBuyEnabled' in s || 'alertSellEnabled' in s) {
    updates.alertEnabled = s.alertBuyEnabled !== false || s.alertSellEnabled !== false
    changed = true
  }
  if ('emailAlertBuyEnabled' in s || 'emailAlertSellEnabled' in s) {
    updates.emailAlertEnabled = s.emailAlertBuyEnabled !== false || s.emailAlertSellEnabled !== false
    changed = true
  }
  if ('defaultTargetBuyPct' in s) {
    updates.defaultAlertDownPct = s.defaultTargetBuyPct != null ? Math.abs(s.defaultTargetBuyPct) : null
    changed = true
  }
  if ('defaultTargetSellPct' in s) {
    updates.defaultAlertUpPct = s.defaultTargetSellPct
    changed = true
  }
  if (changed) {
    const { alertBuyEnabled, alertSellEnabled, emailAlertBuyEnabled, emailAlertSellEnabled, defaultTargetBuyPct, defaultTargetSellPct, ...rest } = s
    writeSettings({ ...rest, ...updates })
  }
}

function runUserMigrations() {
  try { migratePortfolioToCollection() } catch {}
  try { migrateAlertFields() } catch {}
  try { migrateAlertSettings() } catch {}
  try {
    const s = readSettings()
    if (!s.dateJoined) writeSettings({ ...s, dateJoined: localDateStr() })
  } catch {}
}

function tradesFile() { return path.join(getUserDir(), 'trades.json') }
function readTrades() {
  const f = tradesFile()
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}
function writeTrades(trades) {
  fs.writeFileSync(tradesFile(), JSON.stringify(trades, null, 2))
}

function activityFile() { return path.join(getUserDir(), 'activity.json') }
function readActivity() {
  const f = activityFile()
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}
function appendActivity(entry) {
  const log = readActivity()
  log.unshift({ id: randomUUID(), date: new Date().toISOString(), ...entry })
  fs.writeFileSync(activityFile(), JSON.stringify(log.slice(0, 50), null, 2))
}

// ── TCGdex API ───────────────────────────────────────────────────────────────

const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en'
let _tcgdexSetCache = null
let _tcgdexSetCacheTime = 0

// Derive a human-readable series name from a TCGdex set ID prefix when the
// API doesn't return a `serie` object (common on list/search endpoints).
function seriesFromSetId(id) {
  if (!id) return ''
  if (id.startsWith('sv'))    return 'Scarlet & Violet'
  if (id.startsWith('swsh'))  return 'Sword & Shield'
  if (id.startsWith('sm'))    return 'Sun & Moon'
  if (id.startsWith('xy'))    return 'XY'
  if (id.startsWith('bw'))    return 'Black & White'
  if (id.startsWith('hgss'))  return 'HeartGold & SoulSilver'
  if (id.startsWith('dp'))    return 'Diamond & Pearl'
  if (id.startsWith('me'))    return 'Mega Evolution'
  if (id.startsWith('ecard')) return 'E-Card'
  if (id.startsWith('ex'))    return 'EX'
  if (id.startsWith('pop'))   return 'POP'
  if (id.startsWith('neo'))   return 'Neo'
  if (id.startsWith('gym'))   return 'Gym'
  if (id.startsWith('base'))  return 'Base'
  if (id.startsWith('col'))   return 'Call of Legends'
  if (id.startsWith('pl'))    return 'Platinum'
  if (id.startsWith('ru'))    return 'Rising Rivals'
  return ''
}

async function getTcgdexSetMap() {
  if (_tcgdexSetCache && Date.now() - _tcgdexSetCacheTime < 3600000) return _tcgdexSetCache

  // Prefer the rich setsCache (from sets:list) which has full serie.name from TCGdex
  const richSets = setsCache || (() => {
    try {
      const cacheFile = setsCacheFile()
      if (fs.existsSync(cacheFile)) {
        const { fetchedAt, sets } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
        if (Date.now() - fetchedAt < 86400000) return sets
      }
    } catch {}
    return null
  })()

  if (richSets) {
    _tcgdexSetCache = new Map(richSets.map((s) => [
      s.id,
      { name: s.name, series: s.series || seriesFromSetId(s.id), releaseDate: s.releaseDate || '' }
    ]))
    _tcgdexSetCacheTime = Date.now()
    return _tcgdexSetCache
  }

  // Fall back to the /sets list endpoint (no serie field — seriesFromSetId is the only fallback)
  const res = await axios.get(`${TCGDEX_BASE}/sets`, { timeout: 15000 })
  _tcgdexSetCache = new Map((res.data || []).map((s) => [
    s.id,
    { name: s.name, series: s.serie?.name || seriesFromSetId(s.id), releaseDate: s.releaseDate || '' }
  ]))
  _tcgdexSetCacheTime = Date.now()
  return _tcgdexSetCache
}

function extractTcgdexSetId(cardId, localId) {
  if (!cardId) return ''
  const lid = localId != null ? String(localId) : ''
  if (lid && cardId.endsWith('-' + lid)) return cardId.slice(0, cardId.length - lid.length - 1)
  const last = cardId.lastIndexOf('-')
  return last > 0 ? cardId.slice(0, last) : ''
}

function isPocketCard(card) {
  const series = (card.set?.series || card.setSeries || '').toLowerCase()
  if (series.includes('pocket')) return true
  const setId = card.set?.id || card.setId || ''
  // Pocket set IDs: A1, A1a, A2, B1, B1a, B2 ... and promos P-A, P-B
  return /^([A-Z]\d|P-[A-Z])/i.test(setId)
}

function mapTcgdexCard(d) {
  const image = d.image || ''
  const localId = d.localId != null ? String(d.localId) : ''
  const setId = d.set?.id || extractTcgdexSetId(d.id, localId)
  const subtypes = []
  if (d.stage) subtypes.push(d.stage)
  if (d.trainerType) subtypes.push(d.trainerType)
  return {
    id: d.id,
    name: d.name || '',
    number: localId,
    rarity: d.rarity || '',
    artist: d.illustrator || '',
    supertype: d.category || '',
    types: d.types || [],
    subtypes,
    variants: d.variants || null,
    set: { id: setId, name: d.set?.name || '', series: d.set?.serie?.name || d.set?.series || seriesFromSetId(setId), releaseDate: d.set?.releaseDate || '' },
    images: {
      small: image ? `${image}/low.webp` : '',
      large: image ? `${image}/high.webp` : ''
    }
  }
}

function parsePtcgQuery(q) {
  const params = {}
  let directCardId = null
  const regex = /([\w.]+):"([^"]+)"/g
  let m
  while ((m = regex.exec(q)) !== null) {
    const value = m[2].replace(/\*$/, '')
    switch (m[1]) {
      case 'id':        directCardId = value; break
      case 'name':      params.name = value; break
      case 'set.id':    params['set.id'] = value; break
      case 'set.name':  params['set.name'] = value; break
      case 'rarity':    params.rarity = value; break
      case 'artist':    params.illustrator = value; break
      case 'number':    params['eq:localId'] = value; break
      case 'types':     params.types = value; break
      case 'supertype': params.category = value; break
      case 'subtypes':  params.trainerType = value; break
    }
  }
  return { directCardId, params }
}

async function searchCards(query) {
  const queryParams = {}
  if (/^\d+\/\d+$/.test(query)) {
    queryParams['eq:localId'] = query.split('/')[0]
  } else if (/^[a-z]{2,6}\d*-\d+$/i.test(query)) {
    queryParams['eq:localId'] = query.split('-').pop()
  } else {
    queryParams.name = query
    queryParams['sort:field'] = 'releaseDate'
    queryParams['sort:order'] = 'DESC'
  }
  queryParams['pagination:itemsPerPage'] = 30
  const [res, setMap] = await Promise.all([
    axios.get(`${TCGDEX_BASE}/cards`, { params: queryParams, timeout: 15000 }),
    getTcgdexSetMap().catch(() => new Map())
  ])
  return (res.data || []).map((card) => {
    const localId = card.localId != null ? String(card.localId) : ''
    const setId = extractTcgdexSetId(card.id, localId)
    const setData = setMap.get(setId) || { name: '', series: '', releaseDate: '' }
    return mapTcgdexCard({ ...card, set: { id: setId, name: setData.name, series: setData.series, releaseDate: setData.releaseDate } })
  }).filter((c) => !isPocketCard(c))
}

// ── PokemonPriceTracker API ──────────────────────────────────────────────────

const SUPABASE_CONDITION_COL = {
  raw:    'loose_price',
  psa10:  'manual_only_price',
  psa9:   'graded_price',
  psa8:   'new_price',
  cgc10:  'condition_17_price',
  cgc9:   'graded_price',
  sealed: 'loose_price',
}

// Resolves a card to its pricecharting_id in Supabase.
// Priority: pricechartingId (exact int) → pricechartingName (exact product_name string) →
// constructed name+number with set filter (for newly added cards with no PC fields yet).
// pricechartingId is the most reliable because it distinguishes variations (1st Ed vs Unlimited).
async function resolveSupabaseId(card) {
  if (!sbPool) return null
  if (card.pricechartingId) return card.pricechartingId
  if (card.pricechartingName) {
    const res = await sbPool.query(
      `SELECT pricecharting_id FROM pokemon_card_prices WHERE product_name ILIKE $1 LIMIT 1`,
      [card.pricechartingName]
    )
    if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
  }
  // For new cards: construct PriceCharting's product_name format "{Name} #{number}".
  // Use ILIKE so "Mega Lucario ex #179" matches "Mega Lucario EX #179" in PriceCharting.
  if (card.name && card.number) {
    const productName = `${card.name} #${card.number}`
    if (card.setName) {
      const res = await sbPool.query(
        `SELECT pricecharting_id FROM pokemon_card_prices WHERE product_name ILIKE $1 AND console_name ILIKE $2 LIMIT 1`,
        [productName, `%${card.setName}%`]
      )
      if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
    }
    // Fallback: match product_name only (no set filter)
    const res = await sbPool.query(
      `SELECT pricecharting_id FROM pokemon_card_prices WHERE product_name ILIKE $1 LIMIT 1`,
      [productName]
    )
    if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
  }
  // Sealed products: find product_name using the known keyword, then match console_name to the set.
  if (card.type === 'sealed' && card.name) {
    const keyword = SEALED_PRODUCT_KEYWORDS.find(k => card.name.toLowerCase().includes(k.toLowerCase()))
    if (keyword) {
      // The part of the card name before the keyword is the console_name (set name)
      const consolePart = card.name.toLowerCase().replace(keyword.toLowerCase(), '').trim()
      const res = await sbPool.query(
        `SELECT DISTINCT ON (pricecharting_id) pricecharting_id
         FROM pokemon_card_prices
         WHERE product_name ILIKE $1 AND LOWER(TRIM(console_name)) = $2
         ORDER BY pricecharting_id, snapshot_date DESC
         LIMIT 1`,
        [`%${keyword}%`, consolePart]
      )
      if (res.rows[0]?.pricecharting_id) return res.rows[0].pricecharting_id
    }
  }
  return null
}

async function fetchSupabaseHistory(card) {
  if (!sbPool) return []
  const col = SUPABASE_CONDITION_COL[card.condition] || 'loose_price'
  const pcId = await resolveSupabaseId(card)
  if (!pcId) return []
  // Query the condition-specific column (e.g. manual_only_price for PSA 10)
  const res = await sbPool.query(
    `SELECT snapshot_date::date AS date, ${col} AS price FROM pokemon_card_prices WHERE pricecharting_id = $1 AND ${col} IS NOT NULL ORDER BY snapshot_date`,
    [pcId]
  )
  if (res.rows.length > 0) {
    return res.rows.map(r => ({ date: r.date.toISOString().split('T')[0], price: parseFloat(r.price), source: 'supabase' }))
  }
  // Fallback: if this card has no data for the selected grade, use loose_price so
  // at least the sparkline and change % have something to display
  if (col !== 'loose_price') {
    const fallback = await sbPool.query(
      `SELECT snapshot_date::date AS date, loose_price AS price FROM pokemon_card_prices WHERE pricecharting_id = $1 AND loose_price IS NOT NULL ORDER BY snapshot_date`,
      [pcId]
    )
    return fallback.rows.map(r => ({ date: r.date.toISOString().split('T')[0], price: parseFloat(r.price), source: 'supabase' }))
  }
  return []
}

async function fetchSupabaseAllConditions(card) {
  if (!sbPool) return {}
  const pcId = await resolveSupabaseId(card)
  if (!pcId) return {}
  const res = await sbPool.query(
    `SELECT loose_price, manual_only_price, graded_price, new_price, condition_17_price FROM pokemon_card_prices WHERE pricecharting_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
    [pcId]
  )
  const row = res.rows[0]
  if (!row) return {}
  const p = v => (v != null ? parseFloat(v) : null)
  return {
    'Ungraded': p(row.loose_price),
    'PSA 10':   p(row.manual_only_price),
    'PSA 9':    p(row.graded_price),
    'PSA 8':    p(row.new_price),
    'CGC 10':   p(row.condition_17_price),
    'CGC 9':    p(row.graded_price),
  }
}


// ── Scheduler ────────────────────────────────────────────────────────────────

let cronTask = null

async function refreshAllPrices(onProgress) {
  if (!_currentUser) return
  const today = localDateStr()
  const cards = readCards()
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (onProgress) onProgress({ current: i + 1, total: cards.length, name: card.name })
    try {
      const history = await fetchSupabaseHistory(card)
      if (!history.length) continue
      bulkLoadHistory(card.id, history)
      const todayEntry = history.find(e => e.date === today)
      if (todayEntry) appendPrice(card.id, { price: todayEntry.price, source: 'supabase' })
    } catch (err) {
      console.error(`Supabase price fetch failed for ${card.name}: ${err.message}`)
    }
  }
}

async function sendAlertEmails() {
  const settings = readSettings()
  if (!settings.emailAlertsEnabled) return
  const resendApiKey = process.env.RESEND_KEY || ''
  const toEmail = (settings.profile?.email || '').trim().toLowerCase()
  if (!resendApiKey || !toEmail) return

  const emailAlertEnabled = settings.emailAlertEnabled !== false
  const emailedAlerts = settings.emailedAlerts || {}

  const cards = readCards()
  const newAlerts = []
  const updatedEmailed = { ...emailedAlerts }

  for (const card of cards) {
    const history = readPrices(card.id)
    const price = history[history.length - 1]?.price ?? null
    if (price == null) continue

    const state = { alert: updatedEmailed[card.id]?.alert ?? null }

    if (emailAlertEnabled && card.alertPrice != null) {
      const isUpAlert = card.alertPct != null ? card.alertPct > 0 : card.alertPrice > price
      const triggered = isUpAlert ? price >= card.alertPrice : price <= card.alertPrice
      if (triggered) {
        if (state.alert == null) {
          const dollarDiff = isUpAlert
            ? Math.round((price - card.alertPrice) * 100) / 100
            : Math.round((card.alertPrice - price) * 100) / 100
          const pctDiff = Math.round((dollarDiff / card.alertPrice) * 1000) / 10
          newAlerts.push({ type: isUpAlert ? 'up' : 'down', name: card.name, setName: card.setName, condition: card.condition, currentPrice: price, alertPrice: card.alertPrice, dollarDiff, pctDiff })
          state.alert = card.alertPrice
        }
      } else {
        state.alert = null
      }
    }

    updatedEmailed[card.id] = state
  }

  writeSettings({ ...readSettings(), emailedAlerts: updatedEmailed })
  if (newAlerts.length === 0) return

  try {
    const resend = new Resend(resendApiKey)
    const COND_LABEL = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9', sealed: 'Sealed' }
    const rows = newAlerts.map((a) => `
      <tr style="border-bottom:1px solid #2a2d36">
        <td style="padding:10px 12px;color:#e2e8f0">${a.name}${a.setName ? ` <span style="color:#94a3b8;font-size:12px">(${a.setName})</span>` : ''}</td>
        <td style="padding:10px 12px;color:#94a3b8;font-size:12px">${COND_LABEL[a.condition] || a.condition}</td>
        <td style="padding:10px 12px;color:${a.type === 'up' ? '#34d399' : '#f87171'};font-weight:600">${a.type === 'up' ? '↑ PRICE ALERT' : '↓ PRICE ALERT'}</td>
        <td style="padding:10px 12px;color:#e2e8f0">$${a.currentPrice.toFixed(2)}</td>
        <td style="padding:10px 12px;color:#e2e8f0">$${a.alertPrice.toFixed(2)}</td>
        <td style="padding:10px 12px;color:${a.type === 'buy' ? '#34d399' : '#f87171'}">$${a.dollarDiff.toFixed(2)} (${a.pctDiff}%)</td>
      </tr>`).join('')

    const html = `<div style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:32px;max-width:640px;margin:0 auto;border-radius:12px">
      <p style="font-size:11px;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;margin:0 0 8px">PokePrice</p>
      <h1 style="margin:0 0 8px;font-size:20px;color:#f8fafc">${newAlerts.length} price alert${newAlerts.length !== 1 ? 's' : ''} triggered</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">The following cards crossed your target prices in the latest refresh.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #2a2d36;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#1e2130">
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Card</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Condition</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Type</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Current</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Target</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em">Difference</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#475569;font-size:12px;margin:24px 0 0">Open PokePrice to view your portfolio and manage your alerts.</p>
    </div>`

    const { error: sendErr } = await resend.emails.send({
      from: 'PokePrice <onboarding@resend.dev>',
      to: toEmail,
      subject: `PokePrice — ${newAlerts.length} price alert${newAlerts.length !== 1 ? 's' : ''} triggered`,
      html
    })
    if (sendErr) console.warn('Resend alert email failed:', sendErr.message)
  } catch (err) {
    console.error('Email alert send failed:', err.message)
  }
}

// ── Electron Window ───────────────────────────────────────────────────────────

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#0f1117',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    checkAndRefreshPrices()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('context-menu', (_e, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut',       enabled: params.editFlags.canCut },
      { role: 'copy',      enabled: params.editFlags.canCopy },
      { role: 'paste',     enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    ])
    menu.popup({ window: mainWindow })
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/web/index.html'))
  }
}

async function checkAndRefreshPrices() {
  if (!_currentUser) return
  const cards = readCards()
  if (!cards.length) return
  const today = localDateStr()
  const needsRefresh = cards.some((c) => c.lastPriceUpdate !== today)
  if (!needsRefresh) return

  mainWindow?.webContents.send('prices:refreshing')
  await refreshAllPrices((p) => mainWindow?.webContents.send('prices:progress', p))
  const updated = readCards()
  updated.forEach((c) => { c.lastPriceUpdate = today })
  writeCards(updated)
  writeSettings({ ...readSettings(), lastRefreshed: new Date().toISOString() })
  await sendAlertEmails()
  mainWindow?.webContents.send('prices:refreshed')
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.pokeprice')
  createWindow()

  cronTask = cron.schedule('0 8 * * *', async () => {
    await refreshAllPrices((p) => mainWindow?.webContents.send('prices:progress', p))
    mainWindow?.webContents.send('prices:refreshed')
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  cronTask?.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  try {
    if (readAuthPrefs().stayLoggedIn === false) {
      try { fs.unlinkSync(path.join(getDataDir(), 'supabase-session.json')) } catch {}
    }
  } catch {}
})

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('window:close', () => mainWindow?.close())

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:locale', () => app.getLocale())

ipcMain.handle('settings:get', () => readSettings())
ipcMain.handle('profile:pickImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Profile Picture',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return null
  const buf = require('fs').readFileSync(filePaths[0])
  const ext = filePaths[0].split('.').pop().toLowerCase()
  const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
})
ipcMain.handle('settings:set', (_, s) => {
  writeSettings({ ...readSettings(), ...s })
  if (s.profile) {
    const auth = readAuth()
    if (auth && auth.sessionUsername) {
      const idx = auth.users.findIndex(u => u.username === auth.sessionUsername)
      if (idx >= 0) {
        auth.users[idx].profile = { ...auth.users[idx].profile, ...s.profile }
        writeAuth(auth)
      }
    }
  }
  return true
})

ipcMain.handle('account:getStats', () => {
  const cards = readCards().filter((c) => !isPocketCard(c))
  const trades = readTrades()
  const portfolioCards = cards.filter((c) => (c.section || 'watchlist') === 'collection')
  const watchlistCards = cards.filter((c) => (c.section || 'watchlist') === 'watchlist')
  let totalValue = 0, totalInvested = 0
  portfolioCards.forEach((c) => {
    const history = readPrices(c.id)
    const latest = history[history.length - 1]
    if (latest?.price) totalValue += latest.price
    if (c.purchasePrice && !c.isTrade) totalInvested += c.purchasePrice
  })
  const totalProfit = totalInvested > 0 ? totalValue - totalInvested : null
  return {
    portfolioCount: portfolioCards.length,
    watchlistCount: watchlistCards.length,
    pokemonCaught: readSettings().pokemonCollected ?? 0,
    tradeCount: trades.length,
    totalValue: Math.round(totalValue * 100) / 100,
    totalProfit: totalProfit != null ? Math.round(totalProfit * 100) / 100 : null,
  }
})

ipcMain.handle('account:appendActivity', (_, entry) => { appendActivity(entry); return true })

ipcMain.handle('account:clear', (_, target) => {
  if (!_currentUser) return true
  const cards = readCards()
  const sections = target === 'all' ? ['collection', 'watchlist'] : [target]
  if (target === 'trades' || target === 'all') writeTrades([])
  if (target === 'all') {
    try { fs.writeFileSync(activityFile(), JSON.stringify([], null, 2)) } catch {}
  }
  if (target !== 'trades') {
    const toRemove = cards.filter((c) => sections.includes(c.section || 'watchlist'))
    toRemove.forEach((c) => deleteCardData(c.id))
    writeCards(cards.filter((c) => !sections.includes(c.section || 'watchlist')))
  }
  return true
})

ipcMain.handle('account:delete', async () => {
  const username = _currentUser
  if (username) {
    const userDir = path.join(getDataDir(), 'users', username)
    try { fs.rmSync(userDir, { recursive: true, force: true }) } catch {}
    // Remove from known-users list
    writeKnownUsers(readKnownUsers().filter(u => u.username !== username))
  }
  // Sign out from Supabase (clears session file and remote session)
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Delete the user_profiles row (credentials remain in auth.users but are orphaned)
        await supabase.from('user_profiles').delete().eq('id', session.user.id)
      }
      await supabase.auth.signOut()
    } catch {}
  }
  try { fs.unlinkSync(path.join(getDataDir(), 'supabase-session.json')) } catch {}
  _currentUser = null
  return true
})

ipcMain.handle('account:getActivity', () => readActivity())

ipcMain.handle('account:removeActivity', (_, id) => {
  const log = readActivity().filter((e) => e.id !== id)
  fs.writeFileSync(activityFile(), JSON.stringify(log, null, 2))
})

ipcMain.handle('cards:search', async (_, query) => searchCards(query))

ipcMain.handle('cards:getVariations', async (_, name, number, setName) => {
  if (!sbPool || !name || !number) return []
  const base = `${name} #${number}`
  const variant = `${name} [%] #${number}`
  try {
    const res = await sbPool.query(
      `SELECT DISTINCT ON (pricecharting_id) pricecharting_id, product_name, console_name
       FROM pokemon_card_prices
       WHERE (product_name = $1 OR product_name ILIKE $2)
         AND console_name ILIKE $3
         AND console_name NOT ILIKE '%Pocket%'
       ORDER BY pricecharting_id, product_name`,
      [base, variant, `%${setName || ''}%`]
    )
    return res.rows
  } catch { return [] }
})

ipcMain.handle('cards:export', async (_, { rows, format, section }) => {
  const ext = format === 'xlsx' ? 'xlsx' : 'csv'
  const labelMap = { collection: 'Collection', watchlist: 'Watchlist', trades: 'Trades' }
  const label = labelMap[section] || 'Cards'
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export ${label}`,
    defaultPath: `pokeprice-${section}-${localDateStr()}.${ext}`,
    filters: format === 'xlsx'
      ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      : [{ name: 'CSV File', extensions: ['csv'] }]
  })
  if (result.canceled || !result.filePath) return false

  if (format === 'xlsx') {
    const XLSX = require('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    Object.keys(ws).filter((k) => !k.startsWith('!')).forEach((addr) => {
      const cell = ws[addr]
      if (cell && cell.v != null) { cell.t = 's'; cell.v = String(cell.v) }
    })
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, result.filePath)
  } else {
    function csvCell(val) {
      if (val == null || val === '') return ''
      const s = String(val)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    fs.writeFileSync(result.filePath, csv, 'utf8')
  }
  return true
})

ipcMain.handle('cards:search-advanced', async (_, q) => {
  const { directCardId, params } = parsePtcgQuery(q)

  // Single card by ID (used by card detail / flip-card modal)
  if (directCardId) {
    try {
      const res = await axios.get(`${TCGDEX_BASE}/cards/${directCardId}`, { timeout: 15000 })
      const card = res.data ? mapTcgdexCard(res.data) : null
      return card && !isPocketCard(card) ? [card] : []
    } catch { return [] }
  }

  // Set browse: fetch the set detail directly so we only get cards that actually belong to this set.
  // The generic /cards?set.id=... filter is not reliably honoured by TCGdex and can return cards
  // from unrelated sets; /sets/{setId} always returns the exact card list for that set.
  if (params['set.id'] && Object.keys(params).length === 1) {
    const setId = params['set.id']
    try {
      const setMap = await getTcgdexSetMap().catch(() => new Map())
      const res = await axios.get(`${TCGDEX_BASE}/sets/${setId}`, { timeout: 30000 })
      const detail = res.data || {}
      const cards = detail.cards || []
      const setData = setMap.get(setId) || {}
      const setInfo = {
        id: setId,
        name: setData.name || detail.name || '',
        series: setData.series || detail.serie?.name || '',
        releaseDate: setData.releaseDate || detail.releaseDate || ''
      }
      return cards
        .map((card) => mapTcgdexCard({ ...card, set: setInfo }))
        .filter((c) => !isPocketCard(c))
        .sort((a, b) => {
          const na = parseInt(a.number, 10)
          const nb = parseInt(b.number, 10)
          if (!isNaN(na) && !isNaN(nb)) return na - nb
          return (a.number || '').localeCompare(b.number || '')
        })
    } catch { return [] }
  }

  // General multi-filter search — paginate to capture secret rares beyond the first 250
  const PAGE_SIZE_GEN = 250
  const setMap = await getTcgdexSetMap().catch(() => new Map())
  const allCards = []
  let page = 1
  while (true) {
    const res = await axios.get(`${TCGDEX_BASE}/cards`, {
      params: { ...params, 'pagination:itemsPerPage': PAGE_SIZE_GEN, 'pagination:page': page },
      timeout: 30000
    })
    const batch = res.data || []
    allCards.push(...batch)
    if (batch.length < PAGE_SIZE_GEN) break
    page++
  }
  return allCards.map((card) => {
    const localId = card.localId != null ? String(card.localId) : ''
    const setId = extractTcgdexSetId(card.id, localId)
    const setData = setMap.get(setId) || { name: '', series: '', releaseDate: '' }
    return mapTcgdexCard({ ...card, set: { id: setId, name: setData.name, series: setData.series, releaseDate: setData.releaseDate } })
  }).filter((c) => !isPocketCard(c))
})

ipcMain.handle('cards:list', () => {
  const d90 = new Date(); d90.setDate(d90.getDate() - 90)
  const cutoff90 = localDateStr(d90)
  return readCards().filter((card) => card.section !== 'sold' && !isPocketCard(card)).map((card) => {
    const history = readPrices(card.id)
    const latest = history[history.length - 1] || null
    const yesterday = history[history.length - 2] || null
    const dWeek = new Date(); dWeek.setDate(dWeek.getDate() - 7)
    const dMonth = new Date(); dMonth.setDate(dMonth.getDate() - 30)
    const weekAgo = history.find((p) => p.date >= localDateStr(dWeek)) || null
    const monthAgo = history.find((p) => p.date >= localDateStr(dMonth)) || null
    return {
      ...card,
      section: card.section || 'watchlist',
      currentPrice: latest?.price ?? null,
      priceSource: latest?.source ?? null,
      changeDay: calcChange(latest?.price, yesterday?.price),
      changeWeek: calcChange(latest?.price, weekAgo?.price),
      changeMonth: calcChange(latest?.price, monthAgo?.price),
      recentHistory: history.filter((p) => p.date >= cutoff90)
    }
  })
})

ipcMain.handle('cards:sell', (_, cardId, soldInfo) => {
  const cards = readCards()
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx === -1) return false
  const card = cards[idx]
  cards[idx] = {
    ...card,
    section: 'sold',
    soldInfo: {
      salePrice: Math.round(soldInfo.salePrice * 100) / 100,
      saleDate: soldInfo.saleDate,
      isTrade: soldInfo.isTrade || false,
      tradeCardsReceived: soldInfo.tradeCardsReceived || []
    }
  }

  const today = localDateStr()

  // Add received trade cards directly to the collection
  const received = (soldInfo.tradeCardsReceived || []).filter(tc => tc.name?.trim())
  const newTradeCards = received.map(tc => {
    const mp = tc.marketPrice != null ? Math.round(tc.marketPrice * 100) / 100 : null
    return {
      id: randomUUID(),
      tcgId: tc.tcgId || null,
      name: tc.name,
      setName: tc.setName || '',
      setId: tc.setId || '',
      number: tc.number || '',
      rarity: tc.rarity || '',
      condition: tc.condition || 'raw',
      quantity: 1,
      section: 'collection',
      folder: null,
      isTrade: true,
      purchasePrice: mp,
      currentPrice: mp,
      priceSource: mp ? 'ppt' : null,
      pptId: null,
      pptName: null,
      imageUrl: tc.imageUrl || '',
      imageUrlLarge: tc.imageUrlLarge || '',
      addedDate: today,
      lastPriceUpdate: mp ? today : null,
      alertPrice: null,
      alertPct: null,
    }
  })

  cards.push(...newTradeCards)
  writeCards(cards)

  const pl = card.purchasePrice != null ? soldInfo.salePrice - card.purchasePrice : null
  const plStr = pl != null ? ` · P&L: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}` : ''
  appendActivity({
    type: soldInfo.isTrade ? 'card_traded' : 'card_sold',
    message: soldInfo.isTrade ? `Traded ${card.name}` : `Sold ${card.name}`,
    cardId: card.id,
    detail: soldInfo.salePrice > 0 ? `$${soldInfo.salePrice.toFixed(2)}${plStr}` : 'Pure trade'
  })

  for (const nc of newTradeCards) {
    const condLabel = !nc.condition || nc.condition === 'raw' ? 'Raw'
      : nc.condition.replace(/^([a-z]+)(\d+)$/i, (_, g, n) => `${g.toUpperCase()} ${n}`)
    appendActivity({
      type: 'card_added_collection',
      message: `Added ${nc.name} to collection`,
      cardId: nc.id,
      detail: `${condLabel}${nc.setName ? ' · ' + nc.setName : ''} · received in trade`
    })
    if (nc.currentPrice) {
      appendPrice(nc.id, { price: nc.currentPrice, source: 'supabase' })
    }
  }

  if (newTradeCards.length > 0) mainWindow?.webContents.send('cards:changed')
  return true
})

ipcMain.handle('cards:listSold', () => {
  const d90 = new Date(); d90.setDate(d90.getDate() - 90)
  const cutoff90 = localDateStr(d90)
  return readCards().filter((card) => card.section === 'sold' && !isPocketCard(card)).map((card) => {
    const history = readPrices(card.id)
    const latest = history[history.length - 1] || null
    return {
      ...card,
      currentPrice: latest?.price ?? null,
      priceSource: latest?.source ?? null,
      recentHistory: history.filter((p) => p.date >= cutoff90)
    }
  })
})

ipcMain.handle('binders:list', (_, section) => {
  const s = readSettings()
  const key = section === 'collection' ? 'portfolioBinders' : 'watchlistBinders'
  const fallbackKey = section === 'collection' ? 'portfolioFolders' : 'watchlistFolders'
  const stored = s[key] || s[fallbackKey] || []
  // Recover any binder names referenced by cards but missing from settings
  const fromCards = readCards()
    .filter((c) => c.section === section && c.folder)
    .map((c) => c.folder)
  const merged = [...new Set([...stored, ...fromCards])].sort()
  if (merged.length > stored.length) writeSettings({ ...s, [key]: merged })
  return merged
})

ipcMain.handle('binders:add', (_, section, name) => {
  const s = readSettings()
  const key = section === 'collection' ? 'portfolioBinders' : 'watchlistBinders'
  const binders = s[key] || s[section === 'collection' ? 'portfolioFolders' : 'watchlistFolders'] || []
  if (!binders.includes(name)) {
    writeSettings({ ...s, [key]: [...binders, name].sort() })
    appendActivity({ type: 'binder_created', message: `Created ${section} binder "${name}"` })
  }
  return true
})

ipcMain.handle('binders:delete', (_, section, name) => {
  const s = readSettings()
  const key = section === 'collection' ? 'portfolioBinders' : 'watchlistBinders'
  const current = s[key] || s[section === 'collection' ? 'portfolioFolders' : 'watchlistFolders'] || []
  writeSettings({ ...s, [key]: current.filter((f) => f !== name) })
  const cards = readCards()
  let changed = false
  for (const card of cards) {
    const cardSection = card.section || 'watchlist'
    if ((card.binder || card.folder) === name && cardSection === section) {
      card.binder = null
      changed = true
    }
  }
  if (changed) writeCards(cards)
  return true
})

ipcMain.handle('binders:rename', (_, section, oldName, newName) => {
  const s = readSettings()
  const key = section === 'collection' ? 'portfolioBinders' : 'watchlistBinders'
  const current = s[key] || s[section === 'collection' ? 'portfolioFolders' : 'watchlistFolders'] || []
  writeSettings({ ...s, [key]: current.map((f) => f === oldName ? newName : f).sort() })
  const cards = readCards()
  let changed = false
  for (const card of cards) {
    if ((card.binder || card.folder) === oldName && (card.section || 'watchlist') === section) {
      card.binder = newName
      changed = true
    }
  }
  if (changed) writeCards(cards)
  return true
})

ipcMain.handle('trades:list', () => readTrades())

ipcMain.handle('trades:save', (_, trade) => {
  const trades = readTrades()
  const entry = { ...trade, id: randomUUID(), savedAt: new Date().toISOString() }
  writeTrades([entry, ...trades])
  const sent = (trade.youCards || []).length
  const recv = (trade.themCards || []).length
  appendActivity({
    type: 'trade_logged',
    message: trade.themName ? `Trade with ${trade.themName}` : 'Logged a trade',
    detail: `${sent} card${sent !== 1 ? 's' : ''} sent · ${recv} received`,
  })
  return entry
})

ipcMain.handle('trades:delete', (_, id) => {
  writeTrades(readTrades().filter((t) => t.id !== id))
  return true
})

ipcMain.handle('trades:update', (_, id, trade) => {
  const trades = readTrades()
  const idx = trades.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const updated = { ...trades[idx], ...trade, id, savedAt: trades[idx].savedAt }
  trades[idx] = updated
  writeTrades(trades)
  return updated
})

ipcMain.handle('trades:execute', async (event, payload) => {
  const { youCollectionIds = [], receivedCards = [], tradePayload: tp = {}, existingTradeId = null } = payload || {}
  console.log('[trades:execute] youCollectionIds:', youCollectionIds)
  try {
    // Remove traded-away collection cards
    let cards = readCards()
    console.log('[trades:execute] total cards in collection:', cards.length, '| IDs to remove:', youCollectionIds)
    const matched = cards.filter((c) => youCollectionIds.includes(c.id))
    console.log('[trades:execute] matched cards to remove:', matched.map((c) => ({ id: c.id, name: c.name, section: c.section })))
    // Snapshot full card data + price history before deletion so undo can fully restore them
    const removedCardsData = matched.map((card) => ({
      ...card,
      _savedPriceHistory: readPrices(card.id),
    }))
    for (const id of youCollectionIds) deleteCardData(id)
    cards = cards.filter((c) => !youCollectionIds.includes(c.id))

    // Add received cards to collection
    const now = new Date().toISOString()
    const added = receivedCards.map((rc) => ({
      id: randomUUID(),
      tcgId: rc.tcgId || null,
      name: rc.name,
      setName: rc.setName || 'Unknown Set',
      setId: '',
      number: rc.number || '',
      rarity: '',
      condition: rc.condition || 'raw',
      quantity: 1,
      section: 'collection',
      binder: null,
      purchasePrice: rc.price > 0 ? Math.round(rc.price * 100) / 100 : null,
      imageUrl: rc.imageUrl || '',
      imageUrlLarge: rc.imageUrl || '',
      pptId: null,
      pptName: null,
      addedDate: now,
      lastPriceUpdate: null,
    }))
    writeCards([...cards, ...added])
    event.sender.send('cards:changed')

    // Save or update trade record
    const existingTrades = readTrades()
    let entry
    if (existingTradeId) {
      const idx = existingTrades.findIndex((t) => t.id === existingTradeId)
      entry = {
        ...(idx !== -1 ? existingTrades[idx] : {}),
        ...tp,
        id: existingTradeId,
        executed: true,
        addedCardIds: added.map((c) => c.id),
        removedCardsData,
      }
      writeTrades(idx !== -1
        ? existingTrades.map((t, i) => i === idx ? entry : t)
        : [entry, ...existingTrades])
    } else {
      entry = { ...tp, id: randomUUID(), savedAt: now, executed: true, addedCardIds: added.map((c) => c.id), removedCardsData }
      writeTrades([entry, ...existingTrades])
    }

    const sent = youCollectionIds.length
    const recv = added.length
    try {
      appendActivity({
        type: 'trade_executed',
        message: `Executed trade with ${tp.themName || 'someone'}`,
        detail: `${sent} card${sent !== 1 ? 's' : ''} removed · ${recv} card${recv !== 1 ? 's' : ''} added`,
      })
    } catch (actErr) { console.warn('trades:execute activity log failed:', actErr.message) }

    return { entry, removed: sent, added: recv }
  } catch (err) {
    console.error('trades:execute failed:', err)
    throw err
  }
})

ipcMain.handle('trades:undo', async (event, tradeId) => {
  const trades = readTrades()
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade || !trade.executed) throw new Error('Trade not found or not executed')

  let cards = readCards()

  // Remove cards that were received during the trade
  const addedCardIds = trade.addedCardIds || []
  for (const id of addedCardIds) deleteCardData(id)
  cards = cards.filter((c) => !addedCardIds.includes(c.id))

  // Restore cards — full snapshot when available, legacy fallback otherwise
  let restored
  if (trade.removedCardsData && trade.removedCardsData.length > 0) {
    restored = trade.removedCardsData.map(({ _savedPriceHistory, ...card }) => {
      if (_savedPriceHistory && _savedPriceHistory.length > 0) {
        fs.writeFileSync(priceFile(card.id), JSON.stringify(_savedPriceHistory, null, 2))
      }
      return card
    })
  } else {
    restored = (trade.youCards || [])
      .filter((c) => c.collectionId)
      .map((c) => ({
        id: randomUUID(),
        tcgId: c.tcgId || null,
        name: c.name,
        setName: c.setName || 'Unknown Set',
        setId: '',
        number: c.number || '',
        rarity: '',
        condition: c.condition || 'raw',
        quantity: 1,
        section: 'collection',
        binder: null,
        purchasePrice: c.price > 0 ? Math.round(c.price * 100) / 100 : null,
        imageUrl: c.imageUrl || '',
        imageUrlLarge: c.imageUrl || '',
        addedDate: new Date().toISOString(),
        lastPriceUpdate: null,
      }))
  }

  writeCards([...cards, ...restored])
  event.sender.send('cards:changed')

  // Revert trade to saved/draft — strip execution metadata
  const updatedTrades = trades.map((t) => {
    if (t.id !== tradeId) return t
    const { executed: _e, addedCardIds: _a, removedCardsData: _r, ...rest } = t
    return { ...rest, executed: false }
  })
  writeTrades(updatedTrades)

  try {
    appendActivity({
      type: 'trade_undone',
      message: `Undid trade with ${trade.themName || 'someone'}`,
      detail: `${addedCardIds.length} received card${addedCardIds.length !== 1 ? 's' : ''} removed · ${restored.length} traded card${restored.length !== 1 ? 's' : ''} restored`,
    })
  } catch {}

  return { restored: restored.length, removed: addedCardIds.length }
})

ipcMain.handle('cards:add', async (_, tcgCard, condition, quantity, section, purchasePrice, binder, addedDate) => {
  const cards = readCards()

  // Fetch full TCGdex card to supplement brief search result (adds rarity, artist, types)
  if (tcgCard.id && (!tcgCard.rarity || !tcgCard.artist || !tcgCard.types?.length)) {
    try {
      const res = await axios.get(`${TCGDEX_BASE}/cards/${tcgCard.id}`, { timeout: 10000 })
      if (res.data) tcgCard = { ...tcgCard, ...mapTcgdexCard(res.data) }
    } catch { /* use original data */ }
  }

  const newCard = {
    id: randomUUID(),
    tcgId: tcgCard.id,
    name: tcgCard.name,
    setName: tcgCard.set?.name || 'Unknown Set',
    setSeries: tcgCard.set?.series || seriesFromSetId(tcgCard.set?.id || ''),
    setId: tcgCard.set?.id || '',
    number: tcgCard.number || '',
    rarity: tcgCard.rarity || '',
    artist: tcgCard.artist || '',
    types: tcgCard.types || [],
    subtypes: tcgCard.subtypes || [],
    condition,
    quantity: quantity || 1,
    section: section || 'watchlist',
    binder: binder || null,
    purchasePrice: purchasePrice != null && purchasePrice > 0 ? Math.round(purchasePrice * 100) / 100 : null,
    imageUrl: tcgCard.images?.small || '',
    imageUrlLarge: tcgCard.images?.large || '',
    pricechartingId: tcgCard.pricechartingId || null,
    pricechartingName: tcgCard.pricechartingName || null,
    addedDate: addedDate ? new Date(addedDate).toISOString() : new Date().toISOString(),
    lastPriceUpdate: null
  }
  // Re-read before writing to avoid clobbering concurrent additions during the async API calls above
  const freshCards = readCards()
  freshCards.push(newCard)
  writeCards(freshCards)

  const sectionLabel = (section || 'watchlist') === 'collection' ? 'collection' : 'watchlist'
  const condLabel = !condition || condition === 'raw' ? 'Raw' : condition.replace(/^([a-z]+)(\d+)$/i, (_, g, n) => `${g.toUpperCase()} ${n}`)
  const activityDetail = `${condLabel} · ${newCard.setName || ''}${newCard.number ? ` #${newCard.number}` : ''}`
  appendActivity({ type: `card_added_${sectionLabel}`, message: `Added ${tcgCard.name} to ${sectionLabel}`, cardId: newCard.id, detail: activityDetail })
  if (binder) appendActivity({ type: 'card_added_binder', message: `Added ${tcgCard.name} to binder "${binder}"`, cardId: newCard.id, detail: activityDetail })

  // Resolve pricechartingId first so all subsequent Supabase calls are pinned to one card
  if (!newCard.pricechartingId && sbPool) {
    try {
      const pcId = await resolveSupabaseId(newCard)
      if (pcId) {
        const nameRes = await sbPool.query(
          `SELECT product_name FROM pokemon_card_prices WHERE pricecharting_id = $1 LIMIT 1`,
          [pcId]
        )
        newCard.pricechartingId = pcId
        newCard.pricechartingName = nameRes.rows[0]?.product_name || null
      }
    } catch (e) { console.warn('[cards:add] Supabase ID resolve failed:', e.message) }
  }

  // Fetch current price from Supabase
  try {
    const sbConditions = await fetchSupabaseAllConditions(newCard)
    const gradeLabel = COND_TO_GRADE_LABEL[newCard.condition]
    const ownPrice = gradeLabel ? sbConditions[gradeLabel] : null

    if (ownPrice != null) {
      appendPrice(newCard.id, { price: ownPrice, source: 'supabase' })
      newCard.lastPriceUpdate = localDateStr()

      const allCards = readCards()
      const isReAdd = allCards.some((c) =>
        c.id !== newCard.id &&
        c.section === 'sold' &&
        (newCard.tcgId && c.tcgId === newCard.tcgId)
      )
      const settings = readSettings()
      const changes = {
        lastPriceUpdate: newCard.lastPriceUpdate,
        pricechartingId: newCard.pricechartingId,
        pricechartingName: newCard.pricechartingName
      }
      if (!isReAdd) {
        if (settings.defaultAlertUpPct != null) {
          changes.alertPrice = Math.round(ownPrice * (1 + settings.defaultAlertUpPct / 100) * 100) / 100
          changes.alertPct = settings.defaultAlertUpPct
        } else if (settings.defaultAlertDownPct != null) {
          changes.alertPrice = Math.round(ownPrice * (1 - settings.defaultAlertDownPct / 100) * 100) / 100
          changes.alertPct = -settings.defaultAlertDownPct
        }
      }
      const idx = allCards.findIndex((c) => c.id === newCard.id)
      if (idx !== -1) { Object.assign(allCards[idx], changes); writeCards(allCards) }
      Object.assign(newCard, changes)
    }
  } catch (err) { console.error('Initial Supabase price fetch failed:', err.message) }

  // Fire-and-forget: backfill full Supabase price history so chart and sparkline populate immediately
  ;(async () => {
    try {
      const history = await fetchSupabaseHistory(newCard)
      if (history.length > 0) {
        bulkLoadHistory(newCard.id, history)
        mainWindow?.webContents.send('cards:changed')
      }
    } catch {}
  })()

  return newCard
})

ipcMain.handle('cards:remove', (_, cardId) => {
  writeCards(readCards().filter((c) => c.id !== cardId))
  deleteCardData(cardId)
  return true
})

ipcMain.handle('cards:update', (_, cardId, updates) => {
  const cards = readCards()
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx === -1) return false
  if (updates.alertPrice === null) updates.alertPct = null
  const prevCard = cards[idx]
  cards[idx] = { ...prevCard, ...updates }
  writeCards(cards)
  if (updates.alertPrice != null) appendActivity({ type: 'alert_set', message: `Price alert on ${prevCard.name}`, cardId: prevCard.id, detail: `Target: $${Number(updates.alertPrice).toFixed(2)} · ${prevCard.setName || ''}` })
  return cards[idx]
})

ipcMain.handle('prices:history', async (_, cardId) => {
  const local = readPrices(cardId)
  const card = readCards().find(c => c.id === cardId)
  if (!card) return local
  let sbHistory = []
  try { sbHistory = await fetchSupabaseHistory(card) } catch (e) { console.warn('[prices:history] Supabase error', e.message) }
  const localDates = new Set(local.map(e => e.date))
  const fresh = sbHistory.filter(e => !localDates.has(e.date))
  // Write new Supabase entries to local JSON so cards:list also sees them
  // (sparkline and 1D/1W/1M changes in the card row read from local JSON)
  if (fresh.length > 0) {
    bulkLoadHistory(cardId, sbHistory)
    mainWindow?.webContents.send('cards:changed')
  }
  return [...local, ...fresh].sort((a, b) => a.date.localeCompare(b.date))
})

ipcMain.handle('prices:refresh', async (_, cardId, section) => {
  const cards = readCards()
  let toRefresh
  if (cardId) {
    toRefresh = cards.filter((c) => c.id === cardId)
  } else if (section && section !== 'all') {
    toRefresh = cards.filter((c) => (c.section || 'watchlist') === section)
  } else {
    toRefresh = cards
  }

  const today = localDateStr()
  let refreshed = 0
  const sealedIdCache = {} // cardId → resolved pricechartingId (written back below)
  for (const card of toRefresh) {
    try {
      const history = await fetchSupabaseHistory(card)
      if (!history.length) continue
      bulkLoadHistory(card.id, history)
      const todayEntry = history.find(e => e.date === today)
      if (todayEntry) appendPrice(card.id, { price: todayEntry.price, source: 'supabase' })
      // Cache the resolved DB id for sealed cards that don't have one yet
      if (card.type === 'sealed' && !card.pricechartingId) {
        const pcId = await resolveSupabaseId(card)
        if (pcId) sealedIdCache[card.id] = pcId
      }
      refreshed++
    } catch (e) { console.warn(`[prices:refresh] Supabase error for ${card.name}:`, e.message) }
  }
  const updated = readCards()
  toRefresh.forEach((c) => {
    const i = updated.findIndex((u) => u.id === c.id)
    if (i !== -1) {
      updated[i].lastPriceUpdate = today
      if (sealedIdCache[c.id]) updated[i].pricechartingId = sealedIdCache[c.id]
    }
  })
  writeCards(updated)
  writeSettings({ ...readSettings(), lastRefreshed: new Date().toISOString() })
  await sendAlertEmails()
  mainWindow?.webContents.send('prices:refreshed')
  return true
})

// Condition key → grade tile label mapping (matches GRADE_SLOTS in CardDetail)
const COND_TO_GRADE_LABEL = { raw: 'Ungraded', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }

// Returns current prices for all grades from Supabase (label → price mapping).
// Also saves the card's own condition price to local history so "Current Price" tile populates.
ipcMain.handle('prices:allConditions', async (_, cardId) => {
  const card = readCards().find((c) => c.id === cardId)
  if (!card) return null
  try {
    const result = await fetchSupabaseAllConditions(card)
    if (!Object.keys(result).length) return null
    // Save the card's own condition price to local history so "Current Price" tile populates
    const gradeLabel = COND_TO_GRADE_LABEL[card.condition]
    const ownPrice = gradeLabel ? result[gradeLabel] : null
    if (ownPrice != null) {
      const today = localDateStr()
      const existing = readPrices(cardId)
      if (!existing.some(e => e.date === today)) {
        appendPrice(cardId, { price: ownPrice, source: 'supabase' })
        const all = readCards(); const idx = all.findIndex(c => c.id === cardId)
        if (idx !== -1) { all[idx].lastPriceUpdate = today; writeCards(all) }
        mainWindow?.webContents.send('cards:changed')
      }
    }
    return result
  } catch (err) {
    console.error('[prices:allConditions] Supabase fetch failed:', err.message)
    return null
  }
})

// Fetch Supabase price + history for a card not yet in the user's collection (browse mode)
ipcMain.handle('prices:forTcgCard', async (_, { name, number, setName }) => {
  const mockCard = { name, number, setName, condition: 'raw' }
  try {
    const [current, history] = await Promise.all([
      fetchSupabaseAllConditions(mockCard).catch(() => ({})),
      fetchSupabaseHistory(mockCard).catch(() => []),
    ])
    return { current, history }
  } catch { return { current: {}, history: [] } }
})

ipcMain.handle('prices:portfolio', (_, binder) => {
  const allCards = readCards().filter((c) => !isPocketCard(c))
  const portfolioCards = allCards.filter((c) => {
    if ((c.section || 'watchlist') !== 'collection') return false
    if (binder) return (c.binder || c.folder) === binder
    return true
  })

  // Read all price histories once
  const portfolioData = portfolioCards.map((card) => ({
    card,
    history: readPrices(card.id)
  }))

  let totalValue = 0, totalDayChange = 0, totalInvested = 0, cardsWithPrice = 0, cardsWithCost = 0
  let upAlertCount = 0, downAlertCount = 0
  portfolioData.forEach(({ card, history }) => {
    const latest = history[history.length - 1], yesterday = history[history.length - 2]
    if (latest?.price) {
      totalValue += latest.price
      cardsWithPrice++
      if (yesterday?.price) totalDayChange += latest.price - yesterday.price
    }
    if (card.purchasePrice != null && card.purchasePrice > 0) {
      totalInvested += card.purchasePrice
      cardsWithCost++
    }
    const price = latest?.price ?? null
    if (price != null && card.alertPrice != null) {
      const isUpAlert = card.alertPct != null ? card.alertPct > 0 : card.alertPrice > price
      if (isUpAlert && price >= card.alertPrice) upAlertCount++
      else if (!isUpAlert && price <= card.alertPrice) downAlertCount++
    }
  })

  const totalProfit = cardsWithCost > 0 ? totalValue - totalInvested : null
  const totalROI = cardsWithCost > 0 && totalInvested > 0 ? (totalProfit / totalInvested) * 100 : null

  // Realized P&L from sold cards
  const soldCards = allCards.filter((c) => c.section === 'sold')
  let realizedPnL = null
  soldCards.forEach((card) => {
    if (card.soldInfo?.salePrice != null && card.purchasePrice != null) {
      if (realizedPnL === null) realizedPnL = 0
      realizedPnL += card.soldInfo.salePrice - card.purchasePrice
    }
  })
  if (realizedPnL !== null) realizedPnL = Math.round(realizedPnL * 100) / 100

  // 90-day portfolio value history
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = localDateStr(cutoff)
  const dateSet = new Set()
  portfolioData.forEach(({ history }) => {
    history.forEach((p) => { if (p.date >= cutoffStr) dateSet.add(p.date) })
  })
  const valueHistory = [...dateSet].sort().map((date) => {
    let val = 0
    portfolioData.forEach(({ history }) => {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].date <= date) { val += history[i].price; break }
      }
    })
    return { date, value: Math.round(val * 100) / 100 }
  })

  // Cumulative invested history: running sum of purchasePrice ordered by addedDate
  const investedByDate = {}
  portfolioCards.forEach((card) => {
    if (card.purchasePrice == null || card.purchasePrice <= 0 || !card.addedDate) return
    const date = card.addedDate.split('T')[0]
    investedByDate[date] = (investedByDate[date] || 0) + card.purchasePrice
  })
  let runningInvested = 0
  const investedHistory = Object.keys(investedByDate).sort().map((date) => {
    runningInvested += investedByDate[date]
    return { date, value: Math.round(runningInvested * 100) / 100 }
  })

  // Cumulative card-add history for the bar chart (one bar per card, sorted by addedDate)
  const sortedByAdded = [...portfolioCards].sort((a, b) => {
    const da = a.addedDate || '9999'
    const db = b.addedDate || '9999'
    return da.localeCompare(db)
  })
  const cardDataCounts = sortedByAdded.map((card, i) => {
    const d = card.addedDate ? new Date(card.addedDate) : new Date()
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { name: label, count: i + 1 }
  })

  // For each card's addedDate, snap to the first date in valueHistory on or after it.
  // Returns a map of snapped date → card names so the UI can show which cards were added.
  const vhDates = valueHistory.map((p) => p.date)
  const cardAddedDates = {}
  for (const c of portfolioCards) {
    if (!c.addedDate) continue
    const rawDate = c.addedDate.split('T')[0]
    const snappedDate = vhDates.find((vd) => vd >= rawDate) ?? null
    if (!snappedDate) continue
    if (!cardAddedDates[snappedDate]) cardAddedDates[snappedDate] = []
    cardAddedDates[snappedDate].push(c.name)
  }
  const investedAddedCards = {}
  for (const c of portfolioCards) {
    if (!c.addedDate || c.purchasePrice == null) continue
    const date = c.addedDate.split('T')[0]
    if (!investedAddedCards[date]) investedAddedCards[date] = []
    investedAddedCards[date].push(c.name)
  }

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalDayChange: Math.round(totalDayChange * 100) / 100,
    totalInvested: cardsWithCost > 0 ? Math.round(totalInvested * 100) / 100 : null,
    totalProfit: totalProfit != null ? Math.round(totalProfit * 100) / 100 : null,
    totalROI: totalROI != null ? Math.round(totalROI * 100) / 100 : null,
    realizedPnL,
    watchlistCount: allCards.filter((c) => (c.section || 'watchlist') === 'watchlist').length,
    portfolioCount: portfolioCards.length,
    cardsWithPrice,
    cardsWithCost,
    upAlertCount,
    downAlertCount,
    valueHistory,
    investedHistory,
    cardDataCounts,
    cardAddedDates,
    investedAddedCards,
  }
})


ipcMain.handle('prices:setManual', (_, cardId, price) => {
  appendPrice(cardId, { price, source: 'manual' })
  const today = localDateStr()
  const cards = readCards()
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx !== -1) { cards[idx].lastPriceUpdate = today; writeCards(cards) }
  return true
})

ipcMain.handle('cards:applyDefaultTargets', (_, { upPct, downPct, force }) => {
  const cards = readCards()
  let updated = 0
  for (const card of cards) {
    if (card.section === 'sold') continue
    if (!force && card.alertPrice != null) continue
    const history = readPrices(card.id)
    const latestPrice = history[history.length - 1]?.price
    if (latestPrice == null) continue
    if (upPct != null) {
      card.alertPrice = Math.round(latestPrice * (1 + upPct / 100) * 100) / 100
      card.alertPct = upPct
      updated++
    } else if (downPct != null) {
      card.alertPrice = Math.round(latestPrice * (1 - downPct / 100) * 100) / 100
      card.alertPct = -downPct
      updated++
    }
  }
  if (updated > 0) writeCards(cards)
  return { updated }
})

ipcMain.handle('cards:clearAllTargets', () => {
  const cards = readCards()
  let cleared = 0
  for (const card of cards) {
    if (card.section === 'sold') continue
    if (card.alertPrice != null) {
      card.alertPrice = null
      card.alertPct = null
      cleared++
    }
  }
  if (cleared > 0) writeCards(cards)
  return { cleared }
})

ipcMain.handle('alerts:getTriggered', () => {
  const settings = readSettings()
  const alertEnabled = settings.alertEnabled !== false
  const cards = readCards()
  const alerts = []
  for (const card of cards) {
    if (!alertEnabled || card.alertPrice == null) continue
    const history = readPrices(card.id)
    const price = history[history.length - 1]?.price ?? null
    if (price == null) continue
    const isUpAlert = card.alertPct != null ? card.alertPct > 0 : card.alertPrice > price
    const triggered = isUpAlert ? price >= card.alertPrice : price <= card.alertPrice
    if (!triggered) continue
    const dollarDiff = isUpAlert
      ? Math.round((price - card.alertPrice) * 100) / 100
      : Math.round((card.alertPrice - price) * 100) / 100
    const pctDiff = Math.round((dollarDiff / card.alertPrice) * 1000) / 10
    alerts.push({
      type: isUpAlert ? 'up' : 'down',
      id: card.id,
      name: card.name,
      setName: card.setName,
      number: card.number,
      condition: card.condition,
      imageUrl: card.imageUrl,
      currentPrice: price,
      alertPrice: card.alertPrice,
      dollarDiff,
      pctDiff
    })
  }
  return alerts
})

ipcMain.handle('email:test', async () => {
  const settings = readSettings()
  const resendApiKey = process.env.RESEND_KEY || ''
  const toEmail = (settings.profile?.email || '').trim().toLowerCase()
  if (!resendApiKey) return { ok: false, error: 'No Resend API key configured.' }
  if (!toEmail) return { ok: false, error: 'No email address set in your account profile.' }
  try {
    const resend = new Resend(resendApiKey)
    const { error: sendErr } = await resend.emails.send({
      from: 'PokePrice <onboarding@resend.dev>',
      to: toEmail,
      subject: 'PokePrice — Email alerts are working!',
      html: `<div style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:32px;max-width:480px;margin:0 auto;border-radius:12px">
        <p style="font-size:11px;letter-spacing:0.15em;color:#64748b;text-transform:uppercase;margin:0 0 8px">PokePrice</p>
        <h1 style="margin:0 0 8px;font-size:20px;color:#f8fafc">Email alerts are working!</h1>
        <p style="color:#94a3b8;font-size:14px;margin:0">You'll receive an email like this whenever a card crosses your buy or sell price target.</p>
      </div>`
    })
    if (sendErr) return { ok: false, error: sendErr.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

function setsCacheFile() { return path.join(getDataDir(), 'sets-cache.json') }

let setsCache = null
ipcMain.handle('sets:list', async () => {
  const filterPocketSets = (sets) => sets.filter((s) => {
    const series = (s.series || '').toLowerCase()
    if (series.includes('pocket')) return false
    if (/^([A-Z]\d|P-[A-Z])/i.test(s.id || '')) return false
    return true
  })

  if (setsCache) return setsCache

  // Use persisted cache if it's less than 24 hours old
  const cacheFile = setsCacheFile()
  if (fs.existsSync(cacheFile)) {
    try {
      const { fetchedAt, sets } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (Date.now() - fetchedAt < 86400000) {
        setsCache = filterPocketSets(sets)
        return setsCache
      }
    } catch { /* stale or corrupt — re-fetch below */ }
  }

  // Fetch full set details from TCGdex (~200 calls, batched)
  const listRes = await axios.get(`${TCGDEX_BASE}/sets`, { timeout: 15000 })
  const briefSets = listRes.data || []
  const BATCH = 20
  const fullSets = []
  for (let i = 0; i < briefSets.length; i += BATCH) {
    const batch = briefSets.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map((s) =>
        axios.get(`${TCGDEX_BASE}/sets/${s.id}`, { timeout: 10000 })
          .then((r) => r.data)
          .catch(() => s)
      )
    )
    fullSets.push(...results)
  }
  setsCache = fullSets
    .map((s) => ({
      id: s.id,
      name: s.name,
      series: s.serie?.name || '',
      releaseDate: s.releaseDate || '',
      printedTotal: s.cardCount?.official || 0,
      total: s.cardCount?.total || 0,
      images: {
        symbol: s.symbol ? `${s.symbol}.webp` : '',
        logo: s.logo ? `${s.logo}.webp` : '',
      },
      ptcgoCode: s.tcgOnline || s.abbreviation?.official || '',
    }))
    .filter((s) => {
      const series = (s.series || '').toLowerCase()
      if (series.includes('pocket')) return false
      if (/^([A-Z]\d|P-[A-Z])/i.test(s.id || '')) return false
      return true
    })
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))

  // Persist to disk so restarts within 24 hours skip the ~200 API calls
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now(), sets: setsCache }))
  } catch { /* non-fatal */ }

  return setsCache
})

const SEALED_PRODUCT_KEYWORDS = [
  'Elite Trainer Box', 'Booster Box', 'Booster Bundle', 'Booster Pack',
  'Collection Box', 'Premium Collection', 'Gift Box', 'Mini Tin',
  'Tin', 'Theme Deck', 'Starter Deck', 'Blister', 'Bundle', 'Display Box',
]

ipcMain.handle('sealed:search', async (_, query) => {
  if (!sbPool || !query?.trim()) return { products: [] }
  const q = query.trim()
  const keyword = SEALED_PRODUCT_KEYWORDS.find(k => q.toLowerCase().includes(k.toLowerCase()))
  if (!keyword) return { products: [] }
  try {
    const res = await sbPool.query(
      `SELECT DISTINCT ON (pricecharting_id)
         pricecharting_id, console_name, product_name, loose_price
       FROM pokemon_card_prices
       WHERE product_name ILIKE $1
       ORDER BY pricecharting_id, snapshot_date DESC
       LIMIT 50`,
      [`%${keyword}%`]
    )
    const products = res.rows.map(r => ({
      id: r.pricecharting_id,
      pricechartingId: r.pricecharting_id,
      name: `${r.console_name} ${r.product_name}`.trim(),
      'console-name': r.console_name,
      setName: r.console_name,
      prices: { market: r.loose_price != null ? parseFloat(r.loose_price) : null },
    }))
    return { products }
  } catch (e) {
    console.error('[sealed:search] error:', e.message)
    return { products: [] }
  }
})

ipcMain.handle('sealed:add', async (_, product, section, purchasePrice, binder) => {
  const cards = readCards()
  const productName = product.name || product['product-name'] || 'Unknown Product'
  const setName = product.setName || product['console-name'] || 'Sealed Product'
  const newItem = {
    id: randomUUID(),
    tcgId: null,
    name: productName,
    setName,
    setId: '',
    number: '',
    rarity: '',
    condition: 'sealed',
    quantity: 1,
    type: 'sealed',
    section: section || 'watchlist',
    binder: binder || null,
    pricechartingId: product.pricechartingId || null,
    purchasePrice: purchasePrice != null && purchasePrice > 0 ? Math.round(purchasePrice * 100) / 100 : null,
    imageUrl: product.imageUrl || product.image || product.img || product['image-url'] || product.imageSmall || product.thumbnail || '',
    imageUrlLarge: product.imageUrl || product.image || product.img || product['image-url'] || product.imageSmall || product.thumbnail || '',
    addedDate: localDateStr(),
    lastPriceUpdate: null,
  }
  cards.push(newItem)
  writeCards(cards)

  return newItem
})

ipcMain.handle('prices:clearHistory', () => {
  const today = localDateStr()
  const cards = readCards()
  let cleared = 0
  for (const card of cards) {
    const history = readPrices(card.id)
    const kept = history.filter((p) => p.date >= today)
    if (kept.length < history.length) {
      fs.writeFileSync(priceFile(card.id), JSON.stringify(kept, null, 2))
      cleared++
    }
  }
  return { cleared }
})

ipcMain.handle('prices:updateEntry', (_, cardId, date, price) => {
  const history = readPrices(cardId)
  const rounded = Math.round(price * 100) / 100
  const idx = history.findIndex((p) => p.date === date)
  if (idx !== -1) {
    history[idx] = { date, price: rounded, source: 'manual' }
  } else {
    history.push({ date, price: rounded, source: 'manual' })
    history.sort((a, b) => a.date.localeCompare(b.date))
  }
  fs.writeFileSync(priceFile(cardId), JSON.stringify(history, null, 2))
  return true
})

ipcMain.handle('prices:deleteEntry', (_, cardId, date) => {
  const history = readPrices(cardId).filter((p) => p.date !== date)
  fs.writeFileSync(priceFile(cardId), JSON.stringify(history, null, 2))
  return true
})




function calcChange(current, previous) {
  if (!current || !previous) return null
  return Math.round(((current - previous) / previous) * 10000) / 100
}

// ── Card Shows scraper ────────────────────────────────────────────────────────

function cardShowsCacheFile(stateCode) {
  return path.join(getDataDir(), `cardshows-${stateCode}.json`)
}

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// In-memory cache: avoid hammering Supabase on repeated tab switches
const cardShowsMemCache = {}
const CARD_SHOWS_MEM_TTL = 10 * 60 * 1000 // 10 minutes

function cardShowSyntheticId(stateCode, show) {
  // TCDB numeric ID when available, otherwise a stable key from show fields
  if (show.id) return show.id
  return `${stateCode}|${show.date}|${show.name}|${show.venue}`.slice(0, 250)
}

async function scrapeCardShows(stateCode, stateName) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn, val) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try { win.destroy() } catch {}
      fn(val)
    }

    const win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    win.webContents.setUserAgent(CHROME_UA)

    const timeout = setTimeout(() => {
      settle(reject, new Error('Timeout loading card shows'))
    }, 45000)

    win.webContents.on('did-finish-load', async () => {
      try {
        const data = await win.webContents.executeJavaScript(`
          (function() {
            const results = []
            const strongs = Array.from(document.querySelectorAll('p strong'))
              .filter(s => /\\w+, \\w+ \\d+, \\d{4}/.test(s.textContent.trim()))
            for (const strong of strongs) {
              const dateText = strong.textContent.trim()
              const datePara = strong.parentElement
              let next = datePara.nextElementSibling
              while (next && next.tagName !== 'UL') next = next.nextElementSibling
              if (!next) continue
              for (const li of Array.from(next.querySelectorAll('li'))) {
                const link = li.querySelector('a')
                const name = link ? link.textContent.trim() : ''
                const href = link ? link.getAttribute('href') : ''
                const idMatch = href ? href.match(/ID=(\\d+)/) : null
                const parts = li.innerHTML.split(/<br\\s*\\/?>/i)
                const strip = s => s ? s.replace(/<[^>]+>/g, '').trim() : ''
                const allParts = parts.slice(1).map(strip).filter(Boolean)
                const timeIdx = allParts.findIndex(p => /\\d+:\\d+\\s*(am|pm)/i.test(p))
                const venue = allParts[0] || ''
                let address = '', cityState = '', time = ''
                if (timeIdx >= 3) {
                  address = allParts[1] || ''
                  cityState = allParts[2] || ''
                  time = allParts[timeIdx] || ''
                } else if (timeIdx === 2) {
                  cityState = allParts[1] || ''
                  time = allParts[2] || ''
                } else {
                  cityState = allParts[1] || ''
                  time = timeIdx >= 0 ? allParts[timeIdx] : ''
                }
                results.push({
                  id: idMatch ? idMatch[1] : '',
                  name,
                  date: dateText,
                  venue,
                  address,
                  cityState,
                  time,
                })
              }
            }
            return results
          })()
        `)
        if (data.length > 0) console.log('[cardshows] sample show:', JSON.stringify(data[0]))
        settle(resolve, data)
      } catch (err) {
        settle(reject, err)
      }
    })

    win.webContents.on('did-fail-load', (_, code, desc, _url, isMainFrame) => {
      if (!isMainFrame) return
      console.error('[cardshows] did-fail-load:', code, desc)
      settle(reject, new Error(`Failed to load TCDB: ${desc} (${code})`))
    })

    const url = `https://www.tcdb.com/CardShows.cfm?MODE=Location&State=${stateCode}&Display=${encodeURIComponent(stateName)}&Country=United%20States`
    win.loadURL(url)
  })
}

async function upsertCardShows(stateCode, stateName, shows) {
  if (!sbPool || shows.length === 0) return
  for (const show of shows) {
    const id = cardShowSyntheticId(stateCode, show)
    await sbPool.query(
      `INSERT INTO card_shows (id, state_code, state_name, name, date_text, venue, address, city_state, show_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         last_seen_at = now(),
         venue        = EXCLUDED.venue,
         address      = EXCLUDED.address,
         city_state   = EXCLUDED.city_state,
         show_time    = EXCLUDED.show_time`,
      [id, stateCode, stateName, show.name, show.date, show.venue || '', show.address || '', show.cityState || '', show.time || '']
    )
  }
}

ipcMain.handle('cardshows:fetch', async (_, stateCode, stateName) => {
  console.log('[cardshows] fetch requested:', stateCode, stateName)

  // Return in-memory cache if fresh
  const mem = cardShowsMemCache[stateCode]
  if (mem && Date.now() - mem.fetchedAt < CARD_SHOWS_MEM_TTL) {
    console.log('[cardshows] returning memory-cached data:', mem.shows.length, 'shows')
    return { shows: mem.shows, cached: true }
  }

  if (sbPool) {
    // Check Supabase first — if it already has rows we may be able to skip scraping
    let sbShows = []
    let sbOk = true
    try {
      const res = await sbPool.query(
        `SELECT id, name, date_text, venue, address, city_state, show_time
         FROM card_shows WHERE state_code = $1`,
        [stateCode]
      )
      sbShows = res.rows.map(r => ({
        id: r.id, name: r.name, date: r.date_text,
        venue: r.venue, address: r.address, cityState: r.city_state, time: r.show_time,
      }))
    } catch (err) {
      console.error('[cardshows] Supabase query failed, falling back to local cache:', err.message)
      sbOk = false
    }

    if (sbOk) {
      // Scrape TCDB only if: file cache is stale OR Supabase has no rows yet
      const cacheFile = cardShowsCacheFile(stateCode)
      let needsScrape = sbShows.length === 0  // always scrape if Supabase is empty
      if (!needsScrape && fs.existsSync(cacheFile)) {
        try {
          const { fetchedAt } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
          if (Date.now() - fetchedAt >= 86400000) needsScrape = true
        } catch { needsScrape = true }
      }

      if (needsScrape) {
        try {
          // Migrate any existing file cache shows to Supabase before overwriting the file.
          // This preserves historical data (e.g. past shows) from the old local-cache format.
          if (fs.existsSync(cacheFile)) {
            try {
              const { shows: cachedShows } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
              if (Array.isArray(cachedShows) && cachedShows.length > 0) {
                console.log('[cardshows] migrating', cachedShows.length, 'cached shows to Supabase for', stateCode)
                await upsertCardShows(stateCode, stateName, cachedShows)
              }
            } catch { /* corrupt file — skip migration */ }
          }

          console.log('[cardshows] scraping TCDB for', stateCode)
          const fresh = await scrapeCardShows(stateCode, stateName)
          await upsertCardShows(stateCode, stateName, fresh)
          try { fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now() })) } catch {}
          // Re-query so we get the freshly upserted rows (fresh + migrated history)
          const res2 = await sbPool.query(
            `SELECT id, name, date_text, venue, address, city_state, show_time
             FROM card_shows WHERE state_code = $1`,
            [stateCode]
          )
          sbShows = res2.rows.map(r => ({
            id: r.id, name: r.name, date: r.date_text,
            venue: r.venue, address: r.address, cityState: r.city_state, time: r.show_time,
          }))
        } catch (err) {
          console.error('[cardshows] scrape/upsert failed, using existing Supabase data:', err.message)
        }
      }

      console.log('[cardshows] loaded', sbShows.length, 'shows from Supabase')
      cardShowsMemCache[stateCode] = { fetchedAt: Date.now(), shows: sbShows }
      return { shows: sbShows, cached: false }
    }
  }

  // Fallback: local file cache + TCDB scrape (no Supabase)
  const cacheFile = cardShowsCacheFile(stateCode)
  if (fs.existsSync(cacheFile)) {
    try {
      const { fetchedAt, shows } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (Date.now() - fetchedAt < 86400000 && shows) {
        console.log('[cardshows] returning file-cached data:', shows.length, 'shows')
        cardShowsMemCache[stateCode] = { fetchedAt: Date.now(), shows }
        return { shows, cached: true }
      }
    } catch { /* stale or corrupt */ }
  }

  console.log('[cardshows] no cache — scraping TCDB for', stateCode)
  const shows = await scrapeCardShows(stateCode, stateName)
  try { fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now(), shows })) } catch {}
  cardShowsMemCache[stateCode] = { fetchedAt: Date.now(), shows }
  return { shows, cached: false }
})

// ── Geocoding ─────────────────────────────────────────────────────────────────

let _geocache = null
function geocacheFile() { return path.join(getDataDir(), 'geocache.json') }
function getGeoCache() {
  if (!_geocache) {
    try { _geocache = JSON.parse(fs.readFileSync(geocacheFile(), 'utf8')) } catch { _geocache = {} }
  }
  return _geocache
}
function saveGeoCache() {
  try { fs.writeFileSync(geocacheFile(), JSON.stringify(_geocache)) } catch {}
}

// Global single-lane queue for Nominatim so concurrent batch calls never overlap
let _nominatimLastCall = 0
let _nominatimBusy = false
const _nominatimQueue = []

async function _drainNominatimQueue() {
  if (_nominatimBusy) return
  _nominatimBusy = true
  while (_nominatimQueue.length > 0) {
    const task = _nominatimQueue.shift()
    // Enforce ≥1.5 s between requests
    const wait = Math.max(0, 1500 - (Date.now() - _nominatimLastCall))
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    _nominatimLastCall = Date.now()

    let result = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const q = task.city.split(',').map(s => s.trim()).join(', ') + ', USA'
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'json', limit: 1, countrycodes: 'us' },
          headers: { 'User-Agent': 'PokePrice/1.0 (pokeprice-card-shows)' },
          timeout: 10000,
        })
        result = res.data?.[0] || null
        break
      } catch (e) {
        if (e.response?.status === 429) {
          const retryAfter = parseInt(e.response.headers?.['retry-after'] || '10')
          await new Promise(r => setTimeout(r, (retryAfter + 2) * 1000))
          _nominatimLastCall = Date.now()
        } else {
          break
        }
      }
    }
    task.resolve(result)
  }
  _nominatimBusy = false
}

function queueNominatim(city) {
  return new Promise(resolve => {
    _nominatimQueue.push({ city, resolve })
    _drainNominatimQueue()
  })
}

ipcMain.handle('geocode:batch', async (event, { zip, cities }) => {
  const cache = getGeoCache()
  const result = { userLocation: null, cities: {} }
  const uncachedCities = []

  if (zip && /^\d{5}$/.test(zip)) {
    const key = `zip:${zip}`
    if (cache[key]) {
      result.userLocation = cache[key]
    } else {
      try {
        const res = await axios.get(`https://api.zippopotam.us/us/${zip}`, { timeout: 8000 })
        const place = res.data?.places?.[0]
        if (place) {
          const loc = { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) }
          cache[key] = loc
          result.userLocation = loc
          saveGeoCache()
        }
      } catch { /* non-fatal */ }
    }
  }

  for (const city of (cities || [])) {
    const key = `city:${city}`
    if (cache[key]) {
      result.cities[city] = cache[key]
    } else {
      uncachedCities.push(city)
    }
  }

  // Geocode uncached cities in background via global single-lane queue
  if (uncachedCities.length > 0) {
    ;(async () => {
      for (const city of uncachedCities) {
        if (event.sender.isDestroyed()) break
        const place = await queueNominatim(city)
        if (place) {
          const loc = { lat: parseFloat(place.lat), lon: parseFloat(place.lon) }
          cache[`city:${city}`] = loc
          saveGeoCache()
          if (!event.sender.isDestroyed()) {
            event.sender.send('geocode:update', { city, location: loc })
          }
        }
      }
    })()
  }

  return result
})

// ── Upcoming shows ────────────────────────────────────────────────────────────

function upcomingShowsFile() { return path.join(getUserDir(), 'upcoming-shows.json') }
function readUpcomingShows() {
  try { return JSON.parse(fs.readFileSync(upcomingShowsFile(), 'utf8')) } catch { return [] }
}
function writeUpcomingShows(shows) {
  fs.writeFileSync(upcomingShowsFile(), JSON.stringify(shows, null, 2))
}

ipcMain.handle('upcoming:list', () => readUpcomingShows())
ipcMain.handle('upcoming:add', (_, show) => {
  const shows = readUpcomingShows()
  if (!shows.find(s => s.id === show.id)) {
    shows.push({ ...show, addedAt: new Date().toISOString() })
    writeUpcomingShows(shows)
  }
  return true
})
ipcMain.handle('upcoming:remove', (_, showId) => {
  writeUpcomingShows(readUpcomingShows().filter(s => s.id !== showId))
  return true
})

// ── Auth ─────────────────────────────────────────────────────────────────────

function authFile() { return path.join(getDataDir(), 'auth.json') }
function authPrefsFile() { return path.join(getDataDir(), 'auth-prefs.json') }
function knownUsersFile() { return path.join(getDataDir(), 'known-users.json') }

function generateSalt() { return randomBytes(32).toString('hex') }
async function hashPassword(password, salt) {
  const buf = await pbkdf2Async(password, salt, 100000, 64, 'sha512')
  return buf.toString('hex')
}

function readAuthPrefs() {
  try { return JSON.parse(fs.readFileSync(authPrefsFile(), 'utf8')) } catch { return {} }
}
function writeAuthPrefs(prefs) {
  fs.writeFileSync(authPrefsFile(), JSON.stringify(prefs, null, 2))
}

function readKnownUsers() {
  try { return JSON.parse(fs.readFileSync(knownUsersFile(), 'utf8')) } catch { return [] }
}
function writeKnownUsers(list) {
  fs.writeFileSync(knownUsersFile(), JSON.stringify(list, null, 2))
}
function upsertKnownUser(entry) {
  const list = readKnownUsers()
  const idx = list.findIndex(u => u.username === entry.username)
  if (idx >= 0) list[idx] = { ...list[idx], ...entry }
  else list.push(entry)
  writeKnownUsers(list)
}

// Legacy auth.json helpers — used only during one-time migration
function migrateAuth(data) {
  if (!data || data.users) return data
  return {
    users: [{ username: data.username, passwordHash: data.passwordHash, salt: data.salt, securityQuestion: data.securityQuestion || '', securityAnswerHash: data.securityAnswerHash || '', securityAnswerSalt: data.securityAnswerSalt || '', profile: {} }],
    sessionUsername: data.username, sessionToken: data.sessionToken || null, stayLoggedIn: data.stayLoggedIn !== false,
  }
}
function readAuth() {
  const f = authFile()
  if (!fs.existsSync(f)) return null
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'))
    const migrated = migrateAuth(data)
    if (!data.users && migrated) fs.writeFileSync(f, JSON.stringify(migrated, null, 2))
    return migrated
  } catch { return null }
}

// In-memory state for password reset flows
let _otpResetEmail = null
const _resetTokens = new Map()

// Ensures user_profiles row exists. If missing (e.g. migration interrupted),
// rebuilds it from known-users.json, settings.json, and auth.json.migrated.
async function ensureUserProfile(userId) {
  const { data: existing } = await supabase.from('user_profiles').select('username').eq('id', userId).single()
  if (existing) return existing.username

  const knownUsers = readKnownUsers()
  const knownUser = knownUsers[0] || {}
  const username = knownUser.username || ''
  if (!username) return null

  _currentUser = username
  const settings = readSettings()
  const prof = settings.profile || {}

  let secData = {}
  try {
    const archived = JSON.parse(fs.readFileSync(authFile() + '.migrated', 'utf8'))
    const lu = archived?.users?.find(u => u.username === username)
    if (lu) secData = { security_question: lu.securityQuestion || '', security_answer_hash: lu.securityAnswerHash || '', security_answer_salt: lu.securityAnswerSalt || '' }
  } catch {}

  await supabase.from('user_profiles').insert({
    id: userId,
    username,
    first_name: knownUser.firstName || prof.firstName || '',
    currency: prof.currency || 'USD',
    state: prof.state || null,
    zip_code: prof.zipCode || null,
    profile_picture: prof.profilePicture || null,
    ...secData,
  })

  return username
}

ipcMain.handle('auth:isSetup', () => {
  if (readKnownUsers().length > 0) return true
  const auth = readAuth()
  return !!(auth?.users?.length > 0)
})

ipcMain.handle('auth:isSessionValid', async () => {
  if (!supabase) return false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return false
    if (readAuthPrefs().stayLoggedIn === false) {
      await supabase.auth.signOut()
      return false
    }
    const username = await ensureUserProfile(session.user.id)
    if (!username) return false
    _currentUser = username
    migrateUserData(username)
    runUserMigrations()
    return true
  } catch { return false }
})

ipcMain.handle('auth:createUser', async (_, { username, password, securityQuestion, securityAnswer, stayLoggedIn, profile }) => {
  if (!supabase) return { ok: false, error: 'Cloud auth not configured.' }
  const email = (profile?.email || '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'An email address is required to create an account.' }
  const normalizedUsername = username.trim().toLowerCase()
  const { data: existing } = await supabase.from('user_profiles').select('username').eq('username', normalizedUsername).maybeSingle()
  if (existing) return { ok: false, error: 'That username is already taken.' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, error: error.message }
  const secAnswerSalt = generateSalt()
  const securityAnswerHash = await hashPassword((securityAnswer || '').trim().toLowerCase(), secAnswerSalt)
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    id: data.user.id,
    username: normalizedUsername,
    first_name: profile?.firstName || '',
    currency: profile?.currency || 'USD',
    state: profile?.state || null,
    zip_code: profile?.zipCode || null,
    profile_picture: profile?.profilePicture || null,
    security_question: securityQuestion || '',
    security_answer_hash: securityAnswerHash,
    security_answer_salt: secAnswerSalt,
  })
  if (profileErr) return { ok: false, error: 'Failed to save profile: ' + profileErr.message }
  const stay = stayLoggedIn !== false
  writeAuthPrefs({ ...readAuthPrefs(), stayLoggedIn: stay })
  _persistSession = stay
  upsertKnownUser({ username: normalizedUsername, firstName: profile?.firstName || '', email })
  _currentUser = normalizedUsername
  runUserMigrations()
  const userProfile = { ...(profile || {}), username: normalizedUsername, dateJoined: new Date().toISOString() }
  const settings = readSettings()
  writeSettings({ ...settings, profile: userProfile, currency: userProfile.currency || settings.currency || 'USD', dateJoined: userProfile.dateJoined })
  return { ok: true }
})

ipcMain.handle('auth:login', async (_, { username, password, email: providedEmail }) => {
  if (!supabase) return { ok: false, error: 'Cloud auth not configured.' }
  const normalizedUsername = username.trim().toLowerCase()

  // ── Seamless one-time migration: auth.json still exists ──────────────────
  const legacyAuth = readAuth()
  if (legacyAuth?.users?.length > 0) {
    const legacyUser = legacyAuth.users.find(u => u.username === normalizedUsername)
    if (legacyUser) {
      const hash = await hashPassword(password, legacyUser.salt)
      if (hash !== legacyUser.passwordHash) return { ok: false, error: 'Invalid username or password.' }
      const email = ((legacyUser.profile?.email || providedEmail) || '').trim().toLowerCase()
      if (!email) return { ok: false, needsEmail: true, error: 'Enter your email address to activate your cloud account.' }
      let userId
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (!signInErr && signInData.user) {
        userId = signInData.user.id
      } else {
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) return { ok: false, error: 'Migration failed: ' + signUpErr.message }
        userId = signUpData.user.id
      }
      await supabase.from('user_profiles').upsert({
        id: userId, username: normalizedUsername,
        first_name: legacyUser.profile?.firstName || '',
        currency: legacyUser.profile?.currency || 'USD',
        state: legacyUser.profile?.state || null,
        zip_code: legacyUser.profile?.zipCode || null,
        profile_picture: legacyUser.profile?.profilePicture || null,
        security_question: legacyUser.securityQuestion || '',
        security_answer_hash: legacyUser.securityAnswerHash || '',
        security_answer_salt: legacyUser.securityAnswerSalt || '',
      })
      upsertKnownUser({ username: normalizedUsername, firstName: legacyUser.profile?.firstName || '', email })
      _currentUser = normalizedUsername
      migrateUserData(normalizedUsername)
      runUserMigrations()
      try { fs.renameSync(authFile(), authFile() + '.migrated') } catch {}
      const settings = readSettings()
      const mergedProfile = { ...(settings.profile || {}), ...(legacyUser.profile || {}), username: normalizedUsername }
      writeSettings({ ...settings, profile: mergedProfile, currency: mergedProfile.currency || settings.currency || 'USD' })
      return { ok: true, migrated: true }
    }
  }

  // ── Normal Supabase login ─────────────────────────────────────────────────
  const knownUser = readKnownUsers().find(u => u.username === normalizedUsername)
  if (!knownUser) return { ok: false, error: 'Invalid username or password.' }
  const { data, error } = await supabase.auth.signInWithPassword({ email: knownUser.email, password })
  if (error) return { ok: false, error: 'Invalid username or password.' }
  _currentUser = normalizedUsername
  migrateUserData(normalizedUsername)
  runUserMigrations()
  const settings = readSettings()
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', data.user.id).single()
  if (profile) {
    const mergedProfile = { ...(settings.profile || {}), username: normalizedUsername, firstName: profile.first_name, email: knownUser.email, currency: profile.currency, state: profile.state, zipCode: profile.zip_code, profilePicture: profile.profile_picture }
    writeSettings({ ...settings, profile: mergedProfile, currency: mergedProfile.currency || settings.currency || 'USD' })
  }
  return { ok: true }
})

ipcMain.handle('auth:logout', async () => {
  if (supabase) await supabase.auth.signOut()
  _currentUser = null
})

ipcMain.handle('auth:getUsername', () => _currentUser)

ipcMain.handle('auth:getUserList', () => {
  const ku = readKnownUsers()
  if (ku.length > 0) return ku.map(u => ({ username: u.username, firstName: u.firstName || '' }))
  const auth = readAuth()
  if (!auth?.users) return []
  return auth.users.map(u => ({ username: u.username, firstName: u.profile?.firstName || '' }))
})

ipcMain.handle('auth:getSecurityQuestionForUser', async (_, { username }) => {
  if (!supabase) return null
  const { data } = await supabase.rpc('get_security_question', { p_username: username.trim().toLowerCase() })
  return data || null
})

ipcMain.handle('auth:getSecurityQuestion', async () => {
  if (!supabase || !_currentUser) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('user_profiles').select('security_question').eq('id', session.user.id).single()
  return data?.security_question ?? null
})

ipcMain.handle('auth:verifySecurityAnswerForUser', async (_, { username, answer }) => {
  if (!supabase) return { ok: false }
  const normalizedUsername = username.trim().toLowerCase()
  const { data: salt } = await supabase.rpc('get_security_salt', { p_username: normalizedUsername })
  if (!salt) return { ok: false, error: 'User not found.' }
  const hash = await hashPassword(answer.trim().toLowerCase(), salt)
  const { data: isValid } = await supabase.rpc('verify_security_answer_hash', { p_username: normalizedUsername, p_hash: hash })
  if (!isValid) return { ok: false, error: 'Incorrect answer.' }
  const token = randomBytes(32).toString('hex')
  _resetTokens.set(token, normalizedUsername)
  setTimeout(() => _resetTokens.delete(token), 15 * 60 * 1000)
  return { ok: true, resetToken: token }
})

ipcMain.handle('auth:verifySecurityAnswer', async (_, { answer }) => {
  if (!supabase || !_currentUser) return { ok: false }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false }
  const { data } = await supabase.from('user_profiles').select('security_answer_hash, security_answer_salt').eq('id', session.user.id).single()
  if (!data) return { ok: false }
  const hash = await hashPassword(answer.trim().toLowerCase(), data.security_answer_salt)
  if (hash !== data.security_answer_hash) return { ok: false, error: 'Incorrect answer.' }
  const token = randomBytes(32).toString('hex')
  _resetTokens.set(token, _currentUser)
  setTimeout(() => _resetTokens.delete(token), 15 * 60 * 1000)
  return { ok: true, resetToken: token }
})

ipcMain.handle('auth:sendResetEmail', async (_, { username, email: providedEmail }) => {
  if (!supabase) return { ok: false, error: 'Cloud auth not configured.' }
  const knownUser = username ? readKnownUsers().find(u => u.username === username.trim().toLowerCase()) : null
  const email = (knownUser?.email || providedEmail || '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'No email address on file. Use the security question instead.' }
  _otpResetEmail = { email, username: knownUser?.username || username }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  if (error) return { ok: false, error: 'Failed to send reset code. Check the email address.' }
  return { ok: true }
})

ipcMain.handle('auth:verifyEmailCode', async (_, { code }) => {
  if (!supabase || !_otpResetEmail) return { ok: false, error: 'No reset email on record. Request a new code.' }
  const { error } = await supabase.auth.verifyOtp({ email: _otpResetEmail.email, token: code.trim(), type: 'email' })
  if (error) return { ok: false, error: 'Incorrect or expired code.' }
  const token = randomBytes(32).toString('hex')
  _resetTokens.set(token, _otpResetEmail.username)
  setTimeout(() => _resetTokens.delete(token), 15 * 60 * 1000)
  _otpResetEmail = null
  return { ok: true, resetToken: token }
})

ipcMain.handle('auth:resetPassword', async (_, { resetToken, newPassword }) => {
  const username = _resetTokens.get(resetToken)
  if (!username) return { ok: false, error: 'Invalid or expired reset token.' }
  _resetTokens.delete(resetToken)
  if (!supabase) return { ok: false, error: 'Cloud auth not configured.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: 'Failed to update password: ' + error.message }
  return { ok: true }
})

ipcMain.handle('auth:changePassword', async (_, { currentPassword, newPassword }) => {
  if (!supabase || !_currentUser) return { ok: false, error: 'Not authenticated.' }
  const knownUser = readKnownUsers().find(u => u.username === _currentUser)
  if (!knownUser) return { ok: false, error: 'No account found.' }
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: knownUser.email, password: currentPassword })
  if (verifyErr) return { ok: false, error: 'Current password is incorrect.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: 'Failed to update password.' }
  return { ok: true }
})

ipcMain.handle('auth:updateSecurityQuestion', async (_, { currentPassword, securityQuestion, securityAnswer }) => {
  if (!supabase || !_currentUser) return { ok: false, error: 'Not authenticated.' }
  const knownUser = readKnownUsers().find(u => u.username === _currentUser)
  if (!knownUser) return { ok: false, error: 'No account found.' }
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: knownUser.email, password: currentPassword })
  if (verifyErr) return { ok: false, error: 'Current password is incorrect.' }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Session lost during verification.' }
  const secAnswerSalt = generateSalt()
  const securityAnswerHash = await hashPassword(securityAnswer.trim().toLowerCase(), secAnswerSalt)
  const { error } = await supabase.from('user_profiles').update({
    security_question: securityQuestion,
    security_answer_hash: securityAnswerHash,
    security_answer_salt: secAnswerSalt,
  }).eq('id', session.user.id)
  if (error) return { ok: false, error: 'Failed to update security question.' }
  return { ok: true }
})

ipcMain.handle('auth:setStayLoggedIn', (_, stayLoggedIn) => {
  writeAuthPrefs({ ...readAuthPrefs(), stayLoggedIn })
  _persistSession = stayLoggedIn !== false
  return true
})

ipcMain.handle('auth:getStayLoggedIn', () => {
  return readAuthPrefs().stayLoggedIn !== false
})

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
