'use strict'

const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join } = require('path')
const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')
const cron = require('node-cron')
const { listAvailableDates, downloadCsvForDate } = require('./services/firebaseStorage')

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
  fs.writeFileSync(cardsFile(), JSON.stringify(cards, null, 2))
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

// ── Pokemon TCG API ──────────────────────────────────────────────────────────

async function searchCards(query) {
  const params = {}
  if (/^\d+\/\d+$/.test(query) || /^[a-z]{2,6}\d*-\d+$/i.test(query)) {
    params.q = `number:"${query}"`
  } else {
    params.q = `name:"${query}*"`
    params.orderBy = '-set.releaseDate'
    params.pageSize = 30
  }
  const res = await axios.get('https://api.pokemontcg.io/v2/cards', { params, timeout: 10000 })
  return res.data.data || []
}

// ── eBay Scraping ────────────────────────────────────────────────────────────


// ── PriceCharting CSV ────────────────────────────────────────────────────────

// In-memory cache — valid for 1 hour so intra-session add/refresh reuses the same download
let _csvCache = null
let _csvCacheTime = 0

async function downloadPcCsv() {
  const { pricechartingToken } = readSettings()
  if (!pricechartingToken) return null
  const url = `https://www.pricecharting.com/price-guide/download-custom?t=${pricechartingToken}&category=pokemon-cards`
  const res = await axios.get(url, { timeout: 60000, responseType: 'text' })
  return typeof res.data === 'string' ? res.data : null
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
      } else {
        field += ch
      }
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

// Returns cached CSV map, downloading if needed. Returns null if unavailable.
// Prefers today's file from Firebase Storage; falls back to PriceCharting direct download.
async function getPcCsvMap(forceRefresh = false) {
  if (!forceRefresh && _csvCache && Date.now() - _csvCacheTime < 3600000) return _csvCache

  const today = new Date().toISOString().split('T')[0]
  const { firebaseStorageBucket } = readSettings()
  const cacheDir = csvCacheDir()

  if (firebaseStorageBucket) {
    try {
      const text = await downloadCsvForDate(today, firebaseStorageBucket, cacheDir)
      if (text) {
        _csvCache = parsePcCsvToMap(text)
        _csvCacheTime = Date.now()
        console.log(`PC CSV loaded from Firebase Storage: ${_csvCache.size} products`)
        return _csvCache
      }
    } catch (e) {
      console.warn('Firebase Storage CSV unavailable, falling back to PriceCharting:', e.message)
    }
  }

  // Fallback: download directly from PriceCharting and cache locally for today
  try {
    const text = await downloadPcCsv()
    if (text) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true })
        fs.writeFileSync(path.join(cacheDir, `${today}.csv`), text, 'utf8')
      } catch (e) { /* non-fatal */ }
      _csvCache = parsePcCsvToMap(text)
      _csvCacheTime = Date.now()
      console.log(`PC CSV loaded from PriceCharting: ${_csvCache.size} products`)
    }
  } catch (e) {
    console.warn('PC CSV download failed:', e.message)
  }
  return _csvCache
}

// Extract price in dollars from a CSV row for a given condition
function getPcCsvPrice(row, condition) {
  const fields = PC_CONDITION_FIELDS[condition] || ['loose-price']
  for (const field of fields) {
    const val = parseInt(row[field], 10)
    if (!isNaN(val) && val > 0) return Math.round(val) / 100
  }
  return null
}

// ── PriceCharting API ────────────────────────────────────────────────────────

const PC_BASE = 'https://www.pricecharting.com/api'

// PriceCharting condition IDs (from their docs):
//   1=Ungraded  2=Grade8  3=Grade7  5=Grade9  6=Grade9.5
//   7=Grade10   8=BGS10   17=CGC10
// Named API fields (friendly names map 1:1 to condition IDs):
//   loose-price=1  new-price=2  cib-price=3  graded-price=5
//   box-only-price=6  manual-only-price=7  bgs-10-price=8  condition-17-price=17
const PC_CONDITION_FIELDS = {
  raw:   ['loose-price'],
  // Grade 10 (condition 7): try both the named field and the ID-based field
  psa10: ['manual-only-price', 'condition-7-price'],
  psa9:  ['graded-price', 'condition-5-price'],
  psa8:  ['new-price', 'condition-2-price'],
  cgc10: ['condition-17-price'],
  cgc9:  ['graded-price', 'condition-5-price']
}

// Human-readable labels for all known PriceCharting price fields
const PC_FIELD_LABELS = {
  'loose-price':        'Ungraded',
  'cib-price':          'Grade 7',
  'new-price':          'Grade 8',
  'graded-price':       'Grade 9',
  'box-only-price':     'Grade 9.5',
  'manual-only-price':  'Grade 10 / PSA 10',
  'condition-7-price':  'Grade 10 / PSA 10',
  'bgs-10-price':       'BGS 10',
  'condition-17-price': 'CGC 10'
}

let _lastPcCallAt = 0
async function pcRateLimit() {
  const gap = Date.now() - _lastPcCallAt
  if (gap < 1200) await new Promise((r) => setTimeout(r, 1200 - gap))
  _lastPcCallAt = Date.now()
}

async function searchPriceCharting(query) {
  const { pricechartingToken } = readSettings()
  if (!pricechartingToken) return []
  await pcRateLimit()
  const res = await axios.get(`${PC_BASE}/products`, {
    params: { t: pricechartingToken, q: query },
    timeout: 10000
  })
  if (res.data.status === 'error') throw new Error(res.data['error-message'] || 'PriceCharting API error')
  return (res.data.products || [])
    .filter((p) => /pokemon/i.test(p['console-name'] || ''))
    .slice(0, 25)
}

async function findPricechartingProduct(name, setName) {
  try {
    const products = await searchPriceCharting(`${name} ${setName}`)
    if (!products.length) return null
    const nameLower = name.toLowerCase()
    const exact = products.find((p) => p['product-name'].toLowerCase() === nameLower)
    return exact || products[0]
  } catch (e) {
    console.warn('PriceCharting auto-link failed:', e.message)
    return null
  }
}

async function fetchPricechartingProduct(pricechartingId) {
  const { pricechartingToken } = readSettings()
  if (!pricechartingToken) throw new Error('PriceCharting token not configured')
  await pcRateLimit()
  const res = await axios.get(`${PC_BASE}/product`, {
    params: { t: pricechartingToken, id: pricechartingId },
    timeout: 10000
  })
  if (res.data.status === 'error') throw new Error(res.data['error-message'] || 'PriceCharting API error')
  return res.data
}

async function fetchPricechartingPrice(card) {
  if (!card.pricechartingId) throw new Error('Card not linked to PriceCharting')
  const data = await fetchPricechartingProduct(card.pricechartingId)
  const fields = PC_CONDITION_FIELDS[card.condition] || ['loose-price']
  for (const field of fields) {
    const pennies = data[field]
    if (pennies && pennies > 0) {
      console.log(`PC [${card.name}/${card.condition}]: ${field} = $${(pennies / 100).toFixed(2)}`)
      return Math.round(pennies) / 100
    }
  }
  const available = Object.entries(data)
    .filter(([k, v]) => k.includes('price') && v > 0)
    .map(([k, v]) => `${k}=$${(v / 100).toFixed(2)}`).join(', ')
  console.warn(`PC: no price for [${card.name}/${card.condition}]. Available: ${available || 'none'}`)
  return null
}

async function getPrice(card) {
  try {
    const price = await fetchPricechartingPrice(card)
    if (price !== null) return { price, source: 'pricecharting' }
  } catch (err) {
    console.warn(`PC price failed for ${card.name}/${card.condition}: ${err.message}`)
  }
  return null
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let cronTask = null

async function refreshAllPrices(onProgress) {
  const cards = readCards()

  // Download CSV once for the whole batch — covers all raw cards with no per-card rate limiting
  const csvMap = await getPcCsvMap(true)

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (onProgress) onProgress({ current: i + 1, total: cards.length, name: card.name })
    try {
      let result = null

      // For raw cards, use CSV price if available (no API call needed)
      if (card.condition === 'raw' && csvMap && card.pricechartingId) {
        const row = csvMap.get(String(card.pricechartingId))
        if (row) {
          const price = getPcCsvPrice(row, 'raw')
          if (price) result = { price, source: 'pricecharting' }
        }
      }

      // Graded cards, or raw cards not found in CSV, fall back to existing logic
      if (!result) result = await getPrice(card)

      if (result) appendPrice(card.id, result)
    } catch (err) {
      console.error(`Price fetch failed for ${card.name}: ${err.message}`)
    }
    // Only add delay when an API/eBay call may have fired (CSV-only path needs none)
    if (i < cards.length - 1) await new Promise((r) => setTimeout(r, 300))
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
  mainWindow?.webContents.send('prices:refreshed')
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.pokeprice')
  migratePortfolioToCollection()
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
  const sealedCards = cards.filter((c) => c.type === 'sealed' || c.condition === 'sealed')
  let totalValue = 0, totalInvested = 0
  portfolioCards.forEach((c) => {
    const history = readPrices(c.id)
    const latest = history[history.length - 1]
    if (latest?.price) totalValue += latest.price
    if (c.purchasePrice) totalInvested += c.purchasePrice
  })
  const totalProfit = totalInvested > 0 ? totalValue - totalInvested : null
  return {
    portfolioCount: portfolioCards.length,
    watchlistCount: watchlistCards.length,
    sealedCount: sealedCards.length,
    tradeCount: trades.length,
    totalValue: Math.round(totalValue * 100) / 100,
    totalProfit: totalProfit != null ? Math.round(totalProfit * 100) / 100 : null,
  }
})

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

ipcMain.handle('pc:search', async (_, query) => searchPriceCharting(query))

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
  const pageSize = 250
  const maxPages = 2
  let page = 1
  let allCards = []
  while (page <= maxPages) {
    const res = await axios.get('https://api.pokemontcg.io/v2/cards', {
      params: { q, orderBy: 'number', pageSize, page },
      timeout: 15000
    })
    const data = res.data.data || []
    allCards = allCards.concat(data)
    if (data.length < pageSize) break
    page++
  }
  return allCards
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
  writeCards(cards)
  const pl = card.purchasePrice != null ? soldInfo.salePrice - card.purchasePrice : null
  const plStr = pl != null ? ` · P&L: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}` : ''
  appendActivity({
    type: 'card_sold',
    message: `Sold ${card.name}`,
    cardId: card.id,
    detail: `$${soldInfo.salePrice.toFixed(2)}${plStr}`
  })
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

ipcMain.handle('trades:execute', async (_, payload) => {
  const { youCollectionIds = [], receivedCards = [], tradePayload: tp = {} } = payload || {}
  console.log('[trades:execute] youCollectionIds:', youCollectionIds)
  try {
    // Remove traded-away collection cards
    let cards = readCards()
    console.log('[trades:execute] total cards in collection:', cards.length, '| IDs to remove:', youCollectionIds)
    const matched = cards.filter((c) => youCollectionIds.includes(c.id))
    console.log('[trades:execute] matched cards to remove:', matched.map((c) => ({ id: c.id, name: c.name, section: c.section })))
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
      pricechartingId: null,
      pricechartingName: null,
      addedDate: now,
      lastPriceUpdate: null,
    }))
    writeCards([...cards, ...added])

    // Save trade record (store addedCardIds so undo can reverse this)
    const existingTrades = readTrades()
    const entry = { ...tp, id: randomUUID(), savedAt: now, executed: true, addedCardIds: added.map((c) => c.id) }
    writeTrades([entry, ...existingTrades])

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

ipcMain.handle('trades:undo', async (_, tradeId) => {
  const trades = readTrades()
  const trade = trades.find((t) => t.id === tradeId)
  if (!trade || !trade.executed) throw new Error('Trade not found or not executed')

  let cards = readCards()

  // Remove cards that were received during the trade
  const addedCardIds = trade.addedCardIds || []
  for (const id of addedCardIds) deleteCardData(id)
  cards = cards.filter((c) => !addedCardIds.includes(c.id))

  // Restore cards the user traded away (only those flagged as being from their collection)
  const now = new Date().toISOString()
  const restored = (trade.youCards || [])
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
      pricechartingId: null,
      pricechartingName: null,
      addedDate: now,
      lastPriceUpdate: null,
    }))

  writeCards([...cards, ...restored])

  // Revert trade to saved/draft — strip execution data and set executed: false
  const updatedTrades = trades.map((t) => {
    if (t.id !== tradeId) return t
    const { executed: _e, addedCardIds: _a, ...rest } = t
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

  // Auto-link to PriceCharting
  const pcProduct = await findPricechartingProduct(tcgCard.name, tcgCard.set?.name || '')

  const newCard = {
    id: randomUUID(),
    tcgId: tcgCard.id,
    name: tcgCard.name,
    setName: tcgCard.set?.name || 'Unknown Set',
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
    pricechartingId: pcProduct?.id || null,
    pricechartingName: pcProduct?.['product-name'] || null,
    addedDate: new Date().toISOString(),
    lastPriceUpdate: null
  }
  cards.push(newCard)
  writeCards(cards)

  const sectionLabel = (section || 'watchlist') === 'collection' ? 'collection' : 'watchlist'
  const condLabel = !condition || condition === 'raw' ? 'Raw' : condition.replace(/^([a-z]+)(\d+)$/i, (_, g, n) => `${g.toUpperCase()} ${n}`)
  const activityDetail = `${condLabel} · ${newCard.setName || ''}${newCard.number ? ` #${newCard.number}` : ''}`
  appendActivity({ type: `card_added_${sectionLabel}`, message: `Added ${tcgCard.name} to ${sectionLabel}`, cardId: newCard.id, detail: activityDetail })
  if (binder) appendActivity({ type: 'card_added_binder', message: `Added ${tcgCard.name} to binder "${binder}"`, cardId: newCard.id, detail: activityDetail })

  // Fetch current price, then eBay history (90 days)
  try {
    let currentResult = null

    // Raw cards: try CSV cache first (already in memory if recently downloaded)
    if (newCard.condition === 'raw' && newCard.pricechartingId) {
      try {
        const csvMap = await getPcCsvMap()
        if (csvMap) {
          const row = csvMap.get(String(newCard.pricechartingId))
          if (row) {
            const price = getPcCsvPrice(row, 'raw')
            if (price) currentResult = { price, source: 'pricecharting' }
          }
        }
      } catch (e) { console.warn('CSV price lookup failed on add:', e.message) }
    }

    // Fallback: PC API (graded cards or CSV miss)
    if (!currentResult) {
      try {
        const pcPrice = await fetchPricechartingPrice(newCard)
        if (pcPrice !== null) currentResult = { price: pcPrice, source: 'pricecharting' }
      } catch (e) { console.warn('PC price failed on add:', e.message) }
    }

    if (currentResult) {
      appendPrice(newCard.id, currentResult)
      newCard.lastPriceUpdate = new Date().toISOString().split('T')[0]
      const updated = readCards()
      const idx = updated.findIndex((c) => c.id === newCard.id)
      if (idx !== -1) { updated[idx].lastPriceUpdate = newCard.lastPriceUpdate; writeCards(updated) }
    }
  } catch (err) { console.error('Initial price/history fetch failed:', err.message) }

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
  if (updates.targetBuyPrice === null) updates.targetBuyPct = null
  if (updates.targetSellPrice === null) updates.targetSellPct = null
  const prevCard = cards[idx]
  cards[idx] = { ...prevCard, ...updates }
  writeCards(cards)
  if (updates.targetBuyPrice != null) appendActivity({ type: 'alert_set', message: `Buy alert on ${prevCard.name}`, cardId: prevCard.id, detail: `Target: $${Number(updates.targetBuyPrice).toFixed(2)} · ${prevCard.setName || ''}` })
  if (updates.targetSellPrice != null) appendActivity({ type: 'alert_set', message: `Sell alert on ${prevCard.name}`, cardId: prevCard.id, detail: `Target: $${Number(updates.targetSellPrice).toFixed(2)} · ${prevCard.setName || ''}` })
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

  // For bulk refresh, download CSV once so raw cards don't need individual API calls
  let csvMap = null
  if (!cardId) csvMap = await getPcCsvMap(true)

  for (const card of toRefresh) {
    try {
      let result = null

      // Raw cards: use CSV when available (bulk refresh path)
      if (csvMap && card.condition === 'raw' && card.pricechartingId) {
        const row = csvMap.get(String(card.pricechartingId))
        if (row) {
          const price = getPcCsvPrice(row, 'raw')
          if (price) result = { price, source: 'pricecharting' }
        }
      }

      // Graded cards or CSV miss: use existing per-card logic
      if (!result) result = await getPrice(card)
      if (result) appendPrice(card.id, result)
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
  mainWindow?.webContents.send('prices:refreshed')
  return true
})

// Returns current prices for all grades from PriceCharting API (label → price mapping)
ipcMain.handle('prices:allConditions', async (_, cardId) => {
  const card = readCards().find((c) => c.id === cardId)
  if (!card?.pricechartingId) return null
  try {
    const data = await fetchPricechartingProduct(card.pricechartingId)

    // Log all non-zero price fields to help diagnose mapping issues
    const debug = Object.entries(data)
      .filter(([k, v]) => k.includes('price') && v > 0)
      .map(([k, v]) => `${k}=$${(v / 100).toFixed(2)}`)
      .join(', ')
    console.log(`PC fields [${card.name}]: ${debug || 'none with value'}`)

    // Build label → price map from every known field that has a value
    const result = {}
    Object.entries(PC_FIELD_LABELS).forEach(([field, label]) => {
      const pennies = data[field]
      if (pennies && pennies > 0) result[label] = Math.round(pennies) / 100
    })
    return Object.keys(result).length > 0 ? result : null
  } catch (err) {
    console.error('allConditions fetch failed:', err.message)
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
  let buyAlertCount = 0, sellAlertCount = 0
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
    if (price != null && card.targetBuyPrice != null && price <= card.targetBuyPrice) buyAlertCount++
    if (price != null && card.targetSellPrice != null && price >= card.targetSellPrice) sellAlertCount++
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
    buyAlertCount,
    sellAlertCount,
    valueHistory,
    investedHistory,
    cardDataCounts
  }
})

// Force-download the latest CSV and update all raw-card prices in one shot
ipcMain.handle('prices:refreshCsv', async () => {
  const csvMap = await getPcCsvMap(true)
  if (!csvMap) return { updated: 0, error: 'CSV download failed or token not set' }
  const cards = readCards()
  const today = new Date().toISOString().split('T')[0]
  let updated = 0
  for (const card of cards) {
    if (card.condition !== 'raw' || !card.pricechartingId) continue
    const row = csvMap.get(String(card.pricechartingId))
    if (!row) continue
    const price = getPcCsvPrice(row, 'raw')
    if (price) { appendPrice(card.id, { price, source: 'pricecharting' }); updated++ }
  }
  const allCards = readCards()
  allCards.forEach((c) => { if (c.condition === 'raw') c.lastPriceUpdate = today })
  writeCards(allCards)
  writeSettings({ ...readSettings(), lastRefreshed: new Date().toISOString() })
  mainWindow?.webContents.send('prices:refreshed')
  return { updated }
})

ipcMain.handle('prices:setManual', (_, cardId, price) => {
  appendPrice(cardId, { price, source: 'manual' })
  const today = new Date().toISOString().split('T')[0]
  const cards = readCards()
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx !== -1) { cards[idx].lastPriceUpdate = today; writeCards(cards) }
  return true
})

ipcMain.handle('cards:applyDefaultTargets', (_, { buyPct, sellPct, force }) => {
  const cards = readCards()
  let updated = 0
  for (const card of cards) {
    const history = readPrices(card.id)
    const latestPrice = history[history.length - 1]?.price
    if (latestPrice == null) continue
    const changes = {}
    if (buyPct != null && (force || card.targetBuyPrice == null)) {
      changes.targetBuyPrice = Math.round(latestPrice * (1 + buyPct / 100) * 100) / 100
      changes.targetBuyPct = buyPct
    }
    if (sellPct != null && (force || card.targetSellPrice == null)) {
      changes.targetSellPrice = Math.round(latestPrice * (1 + sellPct / 100) * 100) / 100
      changes.targetSellPct = sellPct
    }
    if (Object.keys(changes).length > 0) {
      Object.assign(card, changes)
      updated++
    }
  }
  if (updated > 0) writeCards(cards)
  return { updated }
})

ipcMain.handle('cards:clearAllTargets', (_, field) => {
  const cards = readCards()
  const pctField = field === 'targetBuyPrice' ? 'targetBuyPct' : field === 'targetSellPrice' ? 'targetSellPct' : null
  let cleared = 0
  for (const card of cards) {
    if (card[field] != null) {
      card[field] = null
      if (pctField) card[pctField] = null
      cleared++
    }
  }
  if (cleared > 0) writeCards(cards)
  return { cleared }
})

ipcMain.handle('alerts:getTriggered', () => {
  const settings = readSettings()
  const alertBuyEnabled = settings.alertBuyEnabled !== false
  const alertSellEnabled = settings.alertSellEnabled !== false
  const cards = readCards()
  const alerts = []
  for (const card of cards) {
    const history = readPrices(card.id)
    const price = history[history.length - 1]?.price ?? null
    if (price == null) continue
    if (alertBuyEnabled && card.targetBuyPrice != null && price <= card.targetBuyPrice) {
      const dollarDiff = Math.round((card.targetBuyPrice - price) * 100) / 100
      const pctDiff = Math.round((dollarDiff / card.targetBuyPrice) * 1000) / 10
      alerts.push({
        type: 'buy',
        id: card.id,
        name: card.name,
        setName: card.setName,
        number: card.number,
        condition: card.condition,
        imageUrl: card.imageUrl,
        currentPrice: price,
        alertPrice: card.targetBuyPrice,
        dollarDiff,
        pctDiff
      })
    }
    if (alertSellEnabled && card.targetSellPrice != null && price >= card.targetSellPrice) {
      const dollarDiff = Math.round((price - card.targetSellPrice) * 100) / 100
      const pctDiff = Math.round((dollarDiff / card.targetSellPrice) * 1000) / 10
      alerts.push({
        type: 'sell',
        id: card.id,
        name: card.name,
        setName: card.setName,
        number: card.number,
        condition: card.condition,
        imageUrl: card.imageUrl,
        currentPrice: price,
        alertPrice: card.targetSellPrice,
        dollarDiff,
        pctDiff
      })
    }
  }
  return alerts
})

let setsCache = null
ipcMain.handle('sets:list', async () => {
  if (setsCache) return setsCache
  const settings = readSettings()
  const headers = settings.pokemonTcgApiKey ? { 'X-Api-Key': settings.pokemonTcgApiKey } : {}
  const resp = await axios.get('https://api.pokemontcg.io/v2/sets', {
    params: { orderBy: '-releaseDate', pageSize: 250 },
    headers,
  })
  setsCache = resp.data.data.map((s) => ({
    id: s.id,
    name: s.name,
    series: s.series || '',
    releaseDate: s.releaseDate || '',
    printedTotal: s.printedTotal || 0,
    total: s.total || 0,
    images: s.images || {},
    ptcgoCode: s.ptcgoCode || '',
  }))
  return setsCache
})

ipcMain.handle('sealed:search', async (_, query) => {
  const { pricechartingToken } = readSettings()
  if (!pricechartingToken) return { error: 'no_token', products: [] }
  await pcRateLimit()
  try {
    const res = await axios.get(`${PC_BASE}/products`, {
      params: { t: pricechartingToken, q: query },
      timeout: 10000,
    })
    if (res.data.status === 'error') return { error: res.data['error-message'] || 'PriceCharting API error', products: [] }
    const SEALED_KEYWORDS = ['box', 'tin', 'collection', 'bundle', 'blister', 'display', 'booster pack', 'binder', 'album']
    const products = (res.data.products || [])
      .filter((p) => {
        if (!/pokemon/i.test(p['console-name'] || '')) return false
        const name = (p['product-name'] || p.name || '').toLowerCase()
        return SEALED_KEYWORDS.some((kw) => name.includes(kw))
      })
      .slice(0, 30)
    return { products }
  } catch (err) {
    return { error: err.message, products: [] }
  }
})

ipcMain.handle('sealed:add', async (_, product, section, purchasePrice, binder) => {
  const cards = readCards()
  const newItem = {
    id: randomUUID(),
    tcgId: null,
    name: product['product-name'] || product.name || 'Unknown Product',
    setName: product['console-name'] || 'Sealed Product',
    setId: '',
    number: '',
    rarity: '',
    condition: 'sealed',
    quantity: 1,
    type: 'sealed',
    section: section || 'watchlist',
    binder: binder || null,
    purchasePrice: purchasePrice != null && purchasePrice > 0 ? Math.round(purchasePrice * 100) / 100 : null,
    imageUrl: product.image || '',
    imageUrlLarge: product.image || '',
    pricechartingId: product.id || null,
    pricechartingName: product['product-name'] || null,
    addedDate: new Date().toISOString(),
    lastPriceUpdate: null,
  }
  cards.push(newItem)
  writeCards(cards)

  try {
    const data = await fetchPricechartingProduct(newItem.pricechartingId)
    const pennies = data['loose-price'] || data['new-price']
    const detailImage = data.image || ''
    const updated = readCards()
    const idx = updated.findIndex((c) => c.id === newItem.id)
    if (idx !== -1) {
      if (pennies && pennies > 0) {
        appendPrice(newItem.id, { price: Math.round(pennies) / 100, source: 'pricecharting' })
        newItem.lastPriceUpdate = new Date().toISOString().split('T')[0]
        updated[idx].lastPriceUpdate = newItem.lastPriceUpdate
      }
      if (!updated[idx].imageUrl && detailImage) {
        updated[idx].imageUrl = detailImage
        updated[idx].imageUrlLarge = detailImage
        newItem.imageUrl = detailImage
        newItem.imageUrlLarge = detailImage
      }
      writeCards(updated)
    }
  } catch (err) {
    console.error('Sealed product price fetch failed:', err.message)
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

// Lists dated CSV files available in Firebase Storage
ipcMain.handle('prices:cloudDates', async () => {
  const { firebaseStorageBucket } = readSettings()
  if (!firebaseStorageBucket) return []
  try {
    return await listAvailableDates(firebaseStorageBucket)
  } catch (e) {
    console.warn('Could not list cloud dates:', e.message)
    return []
  }
})

// Downloads historical CSVs from Firebase Storage and backfills a card's price history
ipcMain.handle('prices:backfillCard', async (_, cardId) => {
  const { firebaseStorageBucket } = readSettings()
  if (!firebaseStorageBucket) return { filled: 0, error: 'Firebase Storage not configured' }

  const card = readCards().find((c) => c.id === cardId)
  if (!card?.pricechartingId) return { filled: 0, error: 'Card not linked to PriceCharting' }

  let dates
  try {
    dates = await listAvailableDates(firebaseStorageBucket)
  } catch (e) {
    return { filled: 0, error: e.message }
  }

  const existingDates = new Set(readPrices(cardId).map((h) => h.date))
  const cacheDir = csvCacheDir()
  let filled = 0

  for (const date of dates) {
    if (existingDates.has(date)) continue
    try {
      const text = await downloadCsvForDate(date, firebaseStorageBucket, cacheDir)
      if (!text) continue
      const csvMap = parsePcCsvToMap(text)
      const row = csvMap.get(String(card.pricechartingId))
      if (row) {
        const price = getPcCsvPrice(row, card.condition)
        if (price) {
          bulkLoadHistory(cardId, [{ date, price, source: 'pricecharting' }])
          existingDates.add(date)
          filled++
        }
      }
    } catch (e) {
      console.warn(`Backfill failed for ${date}:`, e.message)
    }
  }
  return { filled }
})

function calcChange(current, previous) {
  if (!current || !previous) return null
  return Math.round(((current - previous) / previous) * 10000) / 100
}
