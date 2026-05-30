'use strict'

const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')
const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cron = require('node-cron')
const { Resend } = require('resend')
require('dotenv').config()

// Force consistent userData path across dev and production builds (productName
// capitalisation differs, so pin it explicitly to 'pokeprice').
app.setPath('userData', path.join(app.getPath('appData'), 'pokeprice'))

// ── Storage ──────────────────────────────────────────────────────────────────

let dataDir = null
function getDataDir() {
  if (!dataDir) dataDir = app.getPath('userData')
  return dataDir
}

function cardsFile() { return path.join(getDataDir(), 'cards.json') }
function priceFile(id) { return path.join(getDataDir(), `prices-${id}.json`) }
function settingsFile() { return path.join(getDataDir(), 'settings.json') }
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
  const today = new Date().toISOString().split('T')[0]
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

function tradesFile() { return path.join(getDataDir(), 'trades.json') }
function readTrades() {
  const f = tradesFile()
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}
function writeTrades(trades) {
  fs.writeFileSync(tradesFile(), JSON.stringify(trades, null, 2))
}

function activityFile() { return path.join(getDataDir(), 'activity.json') }
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
  })
}

// ── PokemonPriceTracker API ──────────────────────────────────────────────────

const PPT_BASE = 'https://www.pokemonpricetracker.com/api/v2'

// Kept for Firebase CSV backfill (historical CSVs use PriceCharting product IDs)
const PC_CONDITION_FIELDS = {
  raw:   ['loose-price'],
  psa10: ['manual-only-price', 'condition-7-price'],
  psa9:  ['graded-price', 'condition-5-price'],
  psa8:  ['new-price', 'condition-2-price'],
  cgc10: ['condition-17-price'],
  cgc9:  ['graded-price', 'condition-5-price']
}

function parsePcCsvToMap(text) {
  const lines = text.split('\n')
  if (lines.length < 2) return new Map()
  function parseRow(line) {
    const fields = []
    let field = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { field += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(field.trim()); field = ''
      } else { field += ch }
    }
    fields.push(field.trim())
    return fields
  }
  const headers = parseRow(lines[0])
  const idIdx = headers.indexOf('id')
  if (idIdx === -1) return new Map()
  const map = new Map()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseRow(line)
    const id = vals[idIdx]
    if (!id) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    map.set(id, row)
  }
  return map
}

function getPcCsvPrice(row, condition) {
  const fields = PC_CONDITION_FIELDS[condition] || ['loose-price']
  for (const field of fields) {
    const val = parseInt(row[field], 10)
    if (!isNaN(val) && val > 0) return Math.round(val) / 100
  }
  return null
}

let _lastPptCallAt = 0
async function pptRateLimit() {
  const gap = Date.now() - _lastPptCallAt
  if (gap < 1100) await new Promise((r) => setTimeout(r, 1100 - gap))
  _lastPptCallAt = Date.now()
}

async function searchPPT(name, setName, number) {
  const pptToken = process.env.POKEPRICE_KEY || ''
  if (!pptToken) return []
  await pptRateLimit()
  const query = [name, setName, number].filter(Boolean).join(' ')
  const res = await axios.get(`${PPT_BASE}/cards`, {
    params: { search: query, limit: 10 },
    headers: { Authorization: `Bearer ${pptToken}` },
    timeout: 10000
  })
  return res.data?.data || []
}

// Normalize a set name for fuzzy comparison: strip "SWSH[N]: " / "SV[N]: " prefixes, remove colons
function normSetName(s) {
  return (s || '').toLowerCase().replace(/^(swsh\d*|sv\d*):\s*/i, '').replace(/:/g, '').replace(/\s+/g, ' ').trim()
}

// Returns true if two normalized set names are a confident match using word overlap
function setsMatch(ourSet, pptSet) {
  const a = normSetName(ourSet)
  const b = normSetName(pptSet)
  if (!a || !b) return false
  if (a === b) return true
  const wordsA = a.split(' ').filter(w => w.length > 2)
  const wordsB = b.split(' ').filter(w => w.length > 2)
  // Fall back to substring for very short set names (e.g. "Base", "151")
  if (!wordsA.length || !wordsB.length) return b.includes(a) || a.includes(b)
  const setB = new Set(wordsB)
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB
  const overlap = shorter.filter(w => setB.has(w) || b.includes(w)).length
  return overlap / shorter.length >= 0.6
}

// Checks whether a PPT card name is a plausible match for our card name
function nameMatches(pptName, ourName) {
  const a = (pptName || '').toLowerCase()
  const b = (ourName || '').toLowerCase()
  return a === b || a.startsWith(b) || b.startsWith(a) || a.includes(b)
}

// Resolves an app card to a PPT card object via name+set+number search.
async function resolveCardToPPT(card) {
  const pptToken = process.env.POKEPRICE_KEY || ''
  if (!pptToken || !card.name) return null

  // Name search, disambiguate by set + card number
  try {
    await pptRateLimit()
    const res = await axios.get(`${PPT_BASE}/cards`, {
      params: { search: card.name, limit: 20 },
      headers: { Authorization: `Bearer ${pptToken}` },
      timeout: 10000
    })
    const results = res.data?.data || []
    if (!results.length) return null

    const nameLower = (card.name || '').toLowerCase()
    const numLower = (card.number || '').toLowerCase()

    // Score each result: exact name = 3pts, set match = 2pts, number-in-name = 1pt.
    // Exact name strongly preferred so e.g. "Eevee" beats "Eevee [Pokemon Center]".
    function score(p) {
      const pName = (p.name || '').toLowerCase()
      if (pName !== nameLower && !pName.startsWith(nameLower)) return -1 // name must match
      let s = 0
      if (pName === nameLower) s += 3
      if (setsMatch(card.setName, p.setName)) s += 2
      if (numLower && pName.includes(numLower)) s += 1
      return s
    }

    const scored = results.map(p => ({ p, s: score(p) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s)
    if (!scored.length) return null

    // Require at least a set match (score ≥ 2); if top result has no set match, refuse to guess
    if (scored[0].s < 2) {
      // Exception: only one result total with the exact name → safe to use
      const exactOnly = results.filter(p => (p.name || '').toLowerCase() === nameLower)
      if (exactOnly.length === 1) return exactOnly[0]
      console.warn(`PPT: no confident set match for "${card.name}" from "${card.setName}" — skipping`)
      return null
    }
    return scored[0].p
  } catch (e) {
    console.warn('PPT name search failed:', e.message)
    return null
  }
}

async function findPPTCard(name, setName, number) {
  return resolveCardToPPT({ name, setName, number })
}

async function fetchPPTCardById(pptId, includeEbay = false) {
  const pptToken = process.env.POKEPRICE_KEY || ''
  if (!pptToken) throw new Error('PPT token not configured')
  await pptRateLimit()
  const params = { tcgPlayerId: pptId }
  if (includeEbay) params.includeEbay = 'true'
  const res = await axios.get(`${PPT_BASE}/cards`, {
    params,
    headers: { Authorization: `Bearer ${pptToken}` },
    timeout: 10000
  })
  const data = res.data?.data
  if (!data) throw new Error('PPT: no data returned')
  return data
}

function extractPPTPrice(cardData, condition) {
  if (!cardData) return null
  if (condition === 'raw') {
    const p = cardData.prices?.market
    return p != null && p > 0 ? p : null
  }
  const grade = cardData.ebay?.salesByGrade?.[condition]
  if (!grade) return null
  const price = grade.smartMarketPrice?.price ?? grade.marketPrice7Day ?? grade.averagePrice ?? null
  return price != null && price > 0 ? price : null
}

// Searches for + fetches price in one step; persists pptId link if not already set
async function linkAndPricePPT(card) {
  try {
    let pptId = card.pptId
    let pptName = card.pptName
    if (!pptId) {
      const found = await resolveCardToPPT(card)
      if (!found) return null
      pptId = found.tcgPlayerId
      pptName = found.name
    }
    const data = await fetchPPTCardById(pptId, card.condition !== 'raw')
    const price = extractPPTPrice(data, card.condition)
    if (price != null) console.log(`PPT [${card.name}/${card.condition}]: $${price.toFixed(2)}`)
    else console.warn(`PPT: no price for [${card.name}/${card.condition}]`)
    return { pptId, pptName, price }
  } catch (e) {
    console.warn(`PPT price failed for ${card.name}/${card.condition}: ${e.message}`)
    return null
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let cronTask = null

async function refreshAllPrices(onProgress) {
  const cards = readCards()
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (onProgress) onProgress({ current: i + 1, total: cards.length, name: card.name })
    try {
      const result = await linkAndPricePPT(card)
      if (result) {
        if (result.price != null) appendPrice(card.id, { price: result.price, source: 'ppt' })
        if (!card.pptId && result.pptId) {
          const all = readCards()
          const idx = all.findIndex((c) => c.id === card.id)
          if (idx !== -1) { all[idx].pptId = result.pptId; all[idx].pptName = result.pptName || null; writeCards(all) }
        }
      }
    } catch (err) {
      console.error(`Price fetch failed for ${card.name}: ${err.message}`)
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
  const cards = readCards()
  if (!cards.length) return
  const today = new Date().toISOString().split('T')[0]
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
  migratePortfolioToCollection()
  migrateAlertFields()
  migrateAlertSettings()
  const initS = readSettings()
  if (!initS.dateJoined) writeSettings({ ...initS, dateJoined: new Date().toISOString().split('T')[0] })
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

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('window:close', () => mainWindow?.close())

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:locale', () => app.getLocale())

ipcMain.handle('settings:get', () => readSettings())
ipcMain.handle('settings:set', (_, s) => { writeSettings({ ...readSettings(), ...s }); return true })

ipcMain.handle('account:getStats', () => {
  const cards = readCards()
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

ipcMain.handle('account:delete', () => {
  const dir = getDataDir()
  try {
    fs.readdirSync(dir)
      .filter((f) => f.startsWith('prices-') && f.endsWith('.json'))
      .forEach((f) => { try { fs.unlinkSync(path.join(dir, f)) } catch {} })
  } catch {}
  writeCards([])
  writeTrades([])
  writeSettings({})
  try { fs.writeFileSync(activityFile(), JSON.stringify([], null, 2)) } catch {}
  return true
})

ipcMain.handle('account:getActivity', () => readActivity())

ipcMain.handle('account:removeActivity', (_, id) => {
  const log = readActivity().filter((e) => e.id !== id)
  fs.writeFileSync(activityFile(), JSON.stringify(log, null, 2))
})

ipcMain.handle('pc:search', async (_, query) => searchPPT(query, '', ''))
ipcMain.handle('ppt:search', async (_, query) => searchPPT(query, '', ''))

ipcMain.handle('prices:searchAndFetchRaw', async (_, name, setName) => {
  try {
    const results = await searchPPT(name, setName, '')
    if (!results?.length) return null
    const nameLower = name.toLowerCase()
    const setLower = (setName || '').toLowerCase()
    const best = results.find((p) =>
      (p.name || '').toLowerCase() === nameLower &&
      (p.setName || '').toLowerCase().includes(setLower)
    ) || results.find((p) => (p.name || '').toLowerCase() === nameLower)
    if (!best?.tcgPlayerId) return null
    const data = await fetchPPTCardById(best.tcgPlayerId, false)
    return extractPPTPrice(data, 'raw')
  } catch (e) {
    console.warn('searchAndFetchRaw failed:', e.message)
    return null
  }
})

ipcMain.handle('cards:search', async (_, query) => searchCards(query))

ipcMain.handle('cards:export', async (_, { rows, format, section }) => {
  const ext = format === 'xlsx' ? 'xlsx' : 'csv'
  const labelMap = { collection: 'Collection', watchlist: 'Watchlist', trades: 'Trades' }
  const label = labelMap[section] || 'Cards'
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export ${label}`,
    defaultPath: `pokeprice-${section}-${new Date().toISOString().split('T')[0]}.${ext}`,
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
      return res.data ? [mapTcgdexCard(res.data)] : []
    } catch { return [] }
  }

  // Set browse: fetch all cards in a set ordered by card number
  if (params['set.id'] && Object.keys(params).length === 1) {
    const setId = params['set.id']
    try {
      const [res, setMap] = await Promise.all([
        axios.get(`${TCGDEX_BASE}/cards`, {
          params: { 'set.id': setId, 'pagination:itemsPerPage': 250, 'sort:field': 'localId', 'sort:order': 'ASC' },
          timeout: 30000
        }),
        getTcgdexSetMap().catch(() => new Map())
      ])
      const setData = setMap.get(setId) || { name: '', series: '', releaseDate: '' }
      return (res.data || []).map((card) =>
        mapTcgdexCard({ ...card, set: { id: setId, name: setData.name, series: setData.series, releaseDate: setData.releaseDate } })
      )
    } catch { return [] }
  }

  // General multi-filter search
  params['pagination:itemsPerPage'] = 250
  const [res, setMap] = await Promise.all([
    axios.get(`${TCGDEX_BASE}/cards`, { params, timeout: 30000 }),
    getTcgdexSetMap().catch(() => new Map())
  ])
  return (res.data || []).map((card) => {
    const localId = card.localId != null ? String(card.localId) : ''
    const setId = extractTcgdexSetId(card.id, localId)
    const setData = setMap.get(setId) || { name: '', series: '', releaseDate: '' }
    return mapTcgdexCard({ ...card, set: { id: setId, name: setData.name, series: setData.series, releaseDate: setData.releaseDate } })
  })
})

ipcMain.handle('cards:list', () => {
  const d90 = new Date(); d90.setDate(d90.getDate() - 90)
  const cutoff90 = d90.toISOString().split('T')[0]
  return readCards().filter((card) => card.section !== 'sold').map((card) => {
    const history = readPrices(card.id)
    const latest = history[history.length - 1] || null
    const yesterday = history[history.length - 2] || null
    const dWeek = new Date(); dWeek.setDate(dWeek.getDate() - 7)
    const dMonth = new Date(); dMonth.setDate(dMonth.getDate() - 30)
    const weekAgo = history.find((p) => p.date >= dWeek.toISOString().split('T')[0]) || null
    const monthAgo = history.find((p) => p.date >= dMonth.toISOString().split('T')[0]) || null
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

  const today = new Date().toISOString().split('T')[0]

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
      appendPrice(nc.id, { price: nc.currentPrice, source: 'ppt' })
    }

    // Async: link to PPT for future price refreshes
    ;(async () => {
      try {
        const result = await linkAndPricePPT(nc)
        if (!result) return
        const updated = readCards()
        const i = updated.findIndex(c => c.id === nc.id)
        if (i === -1) return
        updated[i].pptId = result.pptId
        updated[i].pptName = result.pptName || nc.name
        if (result.price != null) {
          updated[i].currentPrice = result.price
          updated[i].priceSource = 'ppt'
          updated[i].lastPriceUpdate = today
          appendPrice(nc.id, { price: result.price, source: 'ppt' })
        }
        writeCards(updated)
        mainWindow?.webContents.send('cards:changed')
      } catch (err) {
        console.error(`Trade card PPT link failed for ${nc.name}:`, err.message)
      }
    })()
  }

  if (newTradeCards.length > 0) mainWindow?.webContents.send('cards:changed')
  return true
})

ipcMain.handle('cards:listSold', () => {
  const d90 = new Date(); d90.setDate(d90.getDate() - 90)
  const cutoff90 = d90.toISOString().split('T')[0]
  return readCards().filter((card) => card.section === 'sold').map((card) => {
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
  return section === 'collection' ? (s.portfolioBinders || s.portfolioFolders || []) : (s.watchlistBinders || s.watchlistFolders || [])
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
        pptId: null,
        pptName: null,
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

ipcMain.handle('cards:add', async (_, tcgCard, condition, quantity, section, purchasePrice, binder) => {
  const cards = readCards()

  // Fetch full TCGdex card to supplement brief search result (adds rarity, artist, types)
  if (tcgCard.id && (!tcgCard.rarity || !tcgCard.artist || !tcgCard.types?.length)) {
    try {
      const res = await axios.get(`${TCGDEX_BASE}/cards/${tcgCard.id}`, { timeout: 10000 })
      if (res.data) tcgCard = { ...tcgCard, ...mapTcgdexCard(res.data) }
    } catch { /* use original data */ }
  }

  const pptProduct = await resolveCardToPPT({
    name: tcgCard.name,
    setName: tcgCard.set?.name || '',
    number: tcgCard.number || ''
  })

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
    pptId: pptProduct?.tcgPlayerId || null,
    pptName: pptProduct?.name || null,
    addedDate: new Date().toISOString(),
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

  // Fetch current price via PPT
  try {
    let currentResult = null

    if (newCard.pptId) {
      try {
        const pptData = await fetchPPTCardById(newCard.pptId, newCard.condition !== 'raw')
        const price = extractPPTPrice(pptData, newCard.condition)
        if (price != null) currentResult = { price, source: 'ppt' }
      } catch (e) { console.warn('PPT price failed on add:', e.message) }
    }

    if (currentResult) {
      appendPrice(newCard.id, currentResult)
      newCard.lastPriceUpdate = new Date().toISOString().split('T')[0]

      const allCards = readCards()
      const isReAdd = allCards.some((c) =>
        c.id !== newCard.id &&
        c.section === 'sold' &&
        ((newCard.pptId && c.pptId === newCard.pptId) ||
         (newCard.tcgId && c.tcgId === newCard.tcgId))
      )
      const settings = readSettings()
      const changes = { lastPriceUpdate: newCard.lastPriceUpdate }
      if (!isReAdd) {
        if (settings.defaultAlertUpPct != null) {
          changes.alertPrice = Math.round(currentResult.price * (1 + settings.defaultAlertUpPct / 100) * 100) / 100
          changes.alertPct = settings.defaultAlertUpPct
        } else if (settings.defaultAlertDownPct != null) {
          changes.alertPrice = Math.round(currentResult.price * (1 - settings.defaultAlertDownPct / 100) * 100) / 100
          changes.alertPct = -settings.defaultAlertDownPct
        }
      }
      const idx = allCards.findIndex((c) => c.id === newCard.id)
      if (idx !== -1) { Object.assign(allCards[idx], changes); writeCards(allCards) }
      Object.assign(newCard, changes)
    }
  } catch (err) { console.error('Initial price fetch failed:', err.message) }

  // Fire-and-forget: backfill 6-month PPT history so the price chart populates immediately
  if (newCard.pptId) {
    ;(async () => {
      try {
        const pptToken = process.env.POKEPRICE_KEY || ''
        if (!pptToken) return
        await pptRateLimit()
        const res = await axios.get(`${PPT_BASE}/cards`, {
          params: { tcgPlayerId: newCard.pptId, includeHistory: 'true' },
          headers: { Authorization: `Bearer ${pptToken}` },
          timeout: 20000
        })
        const ph = res.data?.data?.priceHistory
        const pptConditionKey = Object.entries(PPT_CONDITION_MAP).find(([, v]) => v === newCard.condition)?.[0]
        const condHistory = pptConditionKey ? ph?.conditions?.[pptConditionKey]?.history || [] : []
        const entries = condHistory
          .map((h) => ({ date: (h.date || '').split('T')[0], price: h.market, source: 'ppt' }))
          .filter((h) => h.date && h.price > 0)
        if (entries.length > 0) {
          bulkLoadHistory(newCard.id, entries)
          mainWindow?.webContents.send('cards:changed')
        }
      } catch {}
    })()
  }

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

ipcMain.handle('prices:history', (_, cardId) => readPrices(cardId))

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

  for (const card of toRefresh) {
    try {
      const result = await linkAndPricePPT(card)
      if (result) {
        if (result.price != null) appendPrice(card.id, { price: result.price, source: 'ppt' })
        if (!card.pptId && result.pptId) {
          const all = readCards()
          const idx = all.findIndex((c) => c.id === card.id)
          if (idx !== -1) { all[idx].pptId = result.pptId; all[idx].pptName = result.pptName || null; writeCards(all) }
        }
      }
    } catch (err) { console.error(`Refresh failed for ${card.name}: ${err.message}`) }
  }
  const today = new Date().toISOString().split('T')[0]
  const updated = readCards()
  toRefresh.forEach((c) => {
    const i = updated.findIndex((u) => u.id === c.id)
    if (i !== -1) updated[i].lastPriceUpdate = today
  })
  writeCards(updated)
  writeSettings({ ...readSettings(), lastRefreshed: new Date().toISOString() })
  await sendAlertEmails()
  mainWindow?.webContents.send('prices:refreshed')
  return true
})

// Condition key → grade tile label mapping (matches GRADE_SLOTS in CardDetail)
const COND_TO_GRADE_LABEL = { raw: 'Ungraded', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }

// Returns current prices for all grades from PPT API (label → price mapping).
// Also saves the card's own condition price to local history so "Current Price" tile populates.
ipcMain.handle('prices:allConditions', async (_, cardId) => {
  let card = readCards().find((c) => c.id === cardId)
  if (!card) return null
  if (!card.pptId) {
    try {
      const found = await resolveCardToPPT(card)
      if (!found) return null
      const all = readCards()
      const idx = all.findIndex((c) => c.id === cardId)
      if (idx !== -1) { all[idx].pptId = found.tcgPlayerId; all[idx].pptName = found.name; writeCards(all) }
      card = { ...card, pptId: found.tcgPlayerId }
    } catch (e) {
      console.warn('allConditions auto-link failed:', e.message)
      return null
    }
  }
  try {
    const data = await fetchPPTCardById(card.pptId, true)
    // Validate: PPT card name must loosely match our card name — catches stale wrong links
    const fetchedName = (data.name || '').toLowerCase()
    const ourName = (card.name || '').toLowerCase()
    if (!fetchedName.startsWith(ourName) && !ourName.startsWith(fetchedName) && !fetchedName.includes(ourName)) {
      console.warn(`PPT link mismatch: card "${card.name}" linked to PPT "${data.name}" (id ${card.pptId}) — clearing`)
      const all = readCards(); const idx = all.findIndex(c => c.id === cardId)
      if (idx !== -1) { all[idx].pptId = null; all[idx].pptName = null; writeCards(all) }
      return null
    }
    const result = {}
    const rawPrice = data.prices?.market
    if (rawPrice != null && rawPrice > 0) result['Ungraded'] = rawPrice
    const GRADE_LABELS = { psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }
    for (const [key, label] of Object.entries(GRADE_LABELS)) {
      const price = extractPPTPrice(data, key)
      if (price != null) result[label] = price
    }
    if (!Object.keys(result).length) return null
    // Save the card's own condition price to local history so "Current Price" tile populates
    const gradeLabel = COND_TO_GRADE_LABEL[card.condition]
    const ownPrice = gradeLabel ? result[gradeLabel] : null
    if (ownPrice != null) {
      const today = new Date().toISOString().split('T')[0]
      const existing = readPrices(cardId)
      if (!existing.some(e => e.date === today)) {
        appendPrice(cardId, { price: ownPrice, source: 'ppt' })
        const all = readCards(); const idx = all.findIndex(c => c.id === cardId)
        if (idx !== -1) {
          all[idx].currentPrice = ownPrice
          all[idx].lastPriceUpdate = today
          writeCards(all)
        }
        mainWindow?.webContents.send('cards:changed')
      }
    }
    return result
  } catch (err) {
    console.error('allConditions PPT fetch failed:', err.message)
    return null
  }
})

ipcMain.handle('prices:portfolio', (_, binder) => {
  const allCards = readCards()
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
  const cutoffStr = cutoff.toISOString().split('T')[0]
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

// CSV refresh is no longer used — prices come from PPT per-card API
ipcMain.handle('prices:refreshCsv', async () => {
  return { updated: 0, error: 'CSV refresh removed; use refreshPrices instead' }
})

ipcMain.handle('prices:setManual', (_, cardId, price) => {
  appendPrice(cardId, { price, source: 'manual' })
  const today = new Date().toISOString().split('T')[0]
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
  if (setsCache) return setsCache

  // Use persisted cache if it's less than 24 hours old
  const cacheFile = setsCacheFile()
  if (fs.existsSync(cacheFile)) {
    try {
      const { fetchedAt, sets } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (Date.now() - fetchedAt < 86400000) {
        setsCache = sets
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
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))

  // Persist to disk so restarts within 24 hours skip the ~200 API calls
  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now(), sets: setsCache }))
  } catch { /* non-fatal */ }

  return setsCache
})

ipcMain.handle('sealed:search', async (_, query) => {
  const pptToken = process.env.POKEPRICE_KEY || ''
  if (!pptToken) return { error: 'no_token', products: [] }
  await pptRateLimit()
  try {
    const res = await axios.get(`${PPT_BASE}/sealed-products`, {
      params: { search: query },
      headers: { Authorization: `Bearer ${pptToken}` },
      timeout: 10000,
    })
    const products = (res.data?.data || []).slice(0, 30)
    return { products }
  } catch (err) {
    return { error: err.message, products: [] }
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
    purchasePrice: purchasePrice != null && purchasePrice > 0 ? Math.round(purchasePrice * 100) / 100 : null,
    imageUrl: product.imageUrl || product.image || product.img || product['image-url'] || product.imageSmall || product.thumbnail || '',
    imageUrlLarge: product.imageUrl || product.image || product.img || product['image-url'] || product.imageSmall || product.thumbnail || '',
    pptId: product.tcgPlayerId || null,
    pptName: productName,
    addedDate: new Date().toISOString(),
    lastPriceUpdate: null,
  }
  cards.push(newItem)
  writeCards(cards)

  if (newItem.pptId) {
    try {
      const pptToken = process.env.POKEPRICE_KEY || ''
      await pptRateLimit()
      const res = await axios.get(`${PPT_BASE}/sealed-products`, {
        params: { tcgPlayerId: newItem.pptId },
        headers: { Authorization: `Bearer ${pptToken}` },
        timeout: 10000,
      })
      const data = Array.isArray(res.data?.data) ? res.data.data[0] : res.data?.data
      const price = data?.prices?.market ?? null
      const imgFromData = data?.imageUrl || data?.image || data?.img || data?.['image-url'] || null
      const updated = readCards()
      const idx = updated.findIndex((c) => c.id === newItem.id)
      if (idx !== -1) {
        if (price != null && price > 0) {
          appendPrice(newItem.id, { price, source: 'ppt' })
          newItem.lastPriceUpdate = new Date().toISOString().split('T')[0]
          updated[idx].lastPriceUpdate = newItem.lastPriceUpdate
        }
        if (imgFromData && !updated[idx].imageUrl) {
          updated[idx].imageUrl = imgFromData
          updated[idx].imageUrlLarge = imgFromData
          newItem.imageUrl = imgFromData
          newItem.imageUrlLarge = imgFromData
        }
        writeCards(updated)
      }
    } catch (err) {
      console.error('Sealed product PPT price fetch failed:', err.message)
    }
  }

  return newItem
})

ipcMain.handle('prices:clearHistory', () => {
  const today = new Date().toISOString().split('T')[0]
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


// PPT condition name → app condition key mapping for graded history
const PPT_CONDITION_MAP = {
  'PSA 10': 'psa10',
  'PSA 9': 'psa9',
  'PSA 8': 'psa8',
  'CGC 10': 'cgc10',
  'CGC 9': 'cgc9',
  'Near Mint': 'raw'
}

// Fetches 6-month price history from PPT for a card and merges into local storage.
// Works for raw (Near Mint) and potentially graded conditions if PPT exposes them.
ipcMain.handle('prices:fetchPPTHistory', async (_, cardId) => {
  const card = readCards().find((c) => c.id === cardId)
  if (!card?.pptId) return readPrices(cardId)
  const pptToken = process.env.POKEPRICE_KEY || ''
  if (!pptToken) return readPrices(cardId)
  try {
    await pptRateLimit()
    const res = await axios.get(`${PPT_BASE}/cards`, {
      params: { tcgPlayerId: card.pptId, includeHistory: 'true' },
      headers: { Authorization: `Bearer ${pptToken}` },
      timeout: 20000
    })
    const data = res.data?.data
    const ph = data?.priceHistory
    const tracked = ph?.conditions_tracked || Object.keys(ph?.conditions || {})
    console.log(`PPT history conditions_tracked for ${card.name}:`, tracked)
    // Temp: write debug info to file so we can inspect what PPT actually returns
    const debugPath = path.join(app.getPath('userData'), 'ppt-history-debug.json')
    fs.writeFileSync(debugPath, JSON.stringify({ conditions_tracked: tracked, conditionKeys: Object.keys(ph?.conditions || {}), sampleConditions: Object.fromEntries(Object.entries(ph?.conditions || {}).map(([k, v]) => [k, { dataPoints: v?.history?.length ?? 0, firstDate: v?.history?.[0]?.date, lastDate: v?.history?.[v?.history?.length - 1]?.date }])) }, null, 2))

    // Find the condition key in PPT response that matches this card's condition
    const pptConditionKey = Object.entries(PPT_CONDITION_MAP).find(
      ([, appKey]) => appKey === card.condition
    )?.[0]
    const conditionHistory = pptConditionKey
      ? ph?.conditions?.[pptConditionKey]?.history || []
      : []
    const entries = conditionHistory
      .map((h) => ({ date: (h.date || '').split('T')[0], price: h.market, source: 'ppt' }))
      .filter((h) => h.date && h.price > 0)
    if (entries.length > 0) bulkLoadHistory(cardId, entries)
    console.log(`PPT history: merged ${entries.length} days for ${card.name} (${card.condition}) via key "${pptConditionKey}"`)
  } catch (e) {
    console.warn('PPT history fetch failed:', e.message)
  }
  return readPrices(cardId)
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

ipcMain.handle('cardshows:fetch', async (_, stateCode, stateName) => {
  console.log('[cardshows] fetch requested:', stateCode, stateName)
  const cacheFile = cardShowsCacheFile(stateCode)
  if (fs.existsSync(cacheFile)) {
    try {
      const { fetchedAt, shows } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
      if (Date.now() - fetchedAt < 86400000) {
        console.log('[cardshows] returning cached data:', shows.length, 'shows')
        return { shows, cached: true }
      }
    } catch { /* stale or corrupt — re-fetch below */ }
  }

  console.log('[cardshows] no cache — launching hidden browser for', stateCode)
  const shows = await new Promise((resolve, reject) => {
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

    // Spoof a real Chrome UA so TCDB doesn't block the Electron agent
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

    // Only reject on main-frame failures — ad/tracking subframes fail routinely
    win.webContents.on('did-fail-load', (_, code, desc, _url, isMainFrame) => {
      if (!isMainFrame) return
      console.error('[cardshows] did-fail-load:', code, desc)
      settle(reject, new Error(`Failed to load TCDB: ${desc} (${code})`))
    })

    const url = `https://www.tcdb.com/CardShows.cfm?MODE=Location&State=${stateCode}&Display=${encodeURIComponent(stateName)}&Country=United%20States`
    win.loadURL(url)
  })

  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now(), shows }))
  } catch { /* non-fatal */ }

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

function upcomingShowsFile() { return path.join(getDataDir(), 'upcoming-shows.json') }
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

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url))
