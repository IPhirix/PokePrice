import { useState, useEffect, useRef } from 'react'

const tcgCache = {} // tcgId → full TCG card object, shared across CardDetail instances

function seriesFromSetId(id) {
  if (!id) return ''
  if (id.startsWith('sv'))   return 'Scarlet & Violet'
  if (id.startsWith('swsh')) return 'Sword & Shield'
  if (id.startsWith('sm'))   return 'Sun & Moon'
  if (id.startsWith('xy'))   return 'XY'
  if (id.startsWith('bw'))   return 'Black & White'
  if (id.startsWith('hgss')) return 'HeartGold & SoulSilver'
  if (id.startsWith('dp'))   return 'Diamond & Pearl'
  if (id.startsWith('ex'))   return 'EX'
  if (id.startsWith('pop'))  return 'POP'
  if (id.startsWith('neo'))  return 'Neo'
  if (id.startsWith('gym'))  return 'Gym'
  if (id.startsWith('base')) return 'Base'
  return ''
}

function PriceSpinner({ size = 'md' }) {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  return (
    <svg className={`${cls} animate-spin text-slate-500`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

import { useParams, useNavigate, useLocation } from 'react-router-dom'
import PriceChart from '../components/PriceChart'
import PriceChangeIndicator from '../components/PriceChangeIndicator'
import AppFooter from '../components/AppFooter'
import BinderSelector from '../components/BinderSelector'
import { useCurrency } from '../context/CurrencyContext'
import { CardDetailModal } from './SearchPage'
import AccountModal from '../components/AccountModal'
import NotificationPanel from '../components/NotificationPanel'
import { useAlerts } from '../context/AlertsContext'

const CONDITION_LABEL = {
  raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9',
  psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9'
}
const CONDITIONS = [
  { value: 'raw',   label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9',  label: 'PSA 9' },
  { value: 'psa8',  label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9',  label: 'CGC 9' }
]

const CHART_RANGES = [
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'YTD', days: 'ytd' },
  { label: 'All', days: Infinity },
]

const GRADE_SLOTS = [
  { display: 'Ungraded', keys: ['Ungraded'], condKey: 'raw' },
  { display: 'PSA 8',    keys: ['PSA 8'],    condKey: 'psa8' },
  { display: 'PSA 9',    keys: ['PSA 9'],    condKey: 'psa9' },
  { display: 'PSA 10',   keys: ['PSA 10'],   condKey: 'psa10' },
]

const COND_TO_GRADE = { raw: 'Ungraded', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8' }

const TABS = [
  { id: 'collection', label: 'Collection',         color: 'text-emerald-400', activeBg: 'bg-emerald-900/30 border-emerald-500' },
  { id: 'watchlist', label: 'Watchlist',         color: 'text-sky-400',     activeBg: 'bg-sky-900/30 border-sky-500' },
  { id: 'trade',     label: 'Trade Analyzer',    color: 'text-yellow-300',  activeBg: 'bg-yellow-900/20 border-yellow-400' },
  { id: 'cardshows', label: 'Card Shows',        color: 'text-violet-400',  activeBg: 'bg-violet-900/30 border-violet-500' },
  { id: 'pokedex',   label: 'Pokédex',           color: 'text-red-400',     activeBg: 'bg-red-900/20 border-red-500' },
  { id: 'search',    label: 'Advanced Search',   color: 'text-accent',      activeBg: 'bg-amber-900/20 border-accent' },
]

const TAB_ICONS = {
  collection: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="15" height="20" rx="2" />
      <line x1="9" y1="2" x2="9" y2="22" />
      <circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  watchlist: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  trade: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
  pokedex: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="9" x2="20" y2="9" />
      <circle cx="7.5" cy="5.5" r="1.5" />
      <rect x="7" y="12" width="10" height="6" rx="1" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  cardshows: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
}

const PCT_OPTIONS = Array.from({ length: 20 }, (_, i) => (i < 10 ? -(10 - i) * 5 : (i - 9) * 5))

const CONDITION_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}

function PricesByGrade({ cardId, dayChangeMap = {}, fillHeight = false, onPricesLoaded }) {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const { format } = useCurrency()

  useEffect(() => {
    setLoading(true)
    window.api.getAllConditionPrices(cardId)
      .then(data => { setPrices(data); onPricesLoaded?.() })
      .finally(() => setLoading(false))
  }, [cardId])

  // Build grade label → daily dollar change from the condition-keyed map
  const gradeChanges = {}
  Object.entries(dayChangeMap).forEach(([cond, change]) => {
    const label = COND_TO_GRADE[cond]
    if (label) gradeChanges[label] = change
  })

  const entries = GRADE_SLOTS.map(({ display, keys, condKey }) => ({
    label: display,
    condKey,
    price: prices ? (keys.reduce((v, k) => v ?? prices[k] ?? null, null)) : null
  }))

  return (
    <div className={`bg-surface-800 border border-surface-600 rounded-xl p-4 flex flex-col ${fillHeight ? 'flex-1' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Current Prices by Grade</h3>
        <span className="text-slate-600 text-xs">
          {loading ? 'Loading...' : 'pokemonpricetracker.com'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map(({ label, condKey, price }) => {
          const change = gradeChanges[label]
          const dollar = change?.dollar ?? 0
          const pct = change?.pct ?? 0
          const isPos = pct >= 0
          const isDollarPos = dollar >= 0
          return (
            <div key={label} className="bg-surface-900 rounded-lg p-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mb-2 inline-block ${CONDITION_COLOR[condKey] || 'bg-slate-700 text-slate-300'}`}>{label}</span>
              <div className="flex items-center gap-2 min-h-[2.25rem]">
                {loading ? (
                  <PriceSpinner />
                ) : (
                  <>
                    <p className={`font-bold text-3xl leading-tight ${price != null ? 'text-white' : 'text-slate-600'}`}>
                      {price != null ? format(price) : '—'}
                    </p>
                    {price != null && (
                      <div className="flex flex-col leading-tight">
                        <span className={`text-xs font-medium ${isDollarPos ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isDollarPos ? '+' : '−'}{format(Math.abs(dollar))}
                        </span>
                        <span className={`text-xs font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPos ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PPTLinker({ card, onLinked }) {
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const r = await window.api.searchPPT(query.trim())
      setResults(r)
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(product) {
    setSaving(true)
    await window.api.updateCard(card.id, {
      pptId: product.tcgPlayerId,
      pptName: product.name
    })
    onLinked()
    setEditing(false)
    setSaving(false)
  }

  if (!editing) {
    return (
      <div>
        <label className="text-slate-500 text-xs block mb-1">Pokémon Card</label>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm min-w-0">
            {card.pptId ? (
              <span className="text-slate-300 truncate block">{card.pptName || card.pptId}</span>
            ) : (
              <span className="text-slate-600 italic">Not linked</span>
            )}
          </div>
          <button
            onClick={() => { setEditing(true); setQuery(card.pptName || card.name || '') }}
            className="text-sm py-1.5 rounded bg-accent hover:bg-accent-hover text-black font-semibold transition-colors flex-shrink-0 w-20 text-center"
          >
            {card.pptId ? 'Change' : 'Link'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-slate-500 text-xs">Search Pokemon Price Tracker</label>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-white">Cancel</button>
      </div>
      <form onSubmit={handleSearch} className="flex gap-1 mb-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Charizard Base Set"
          className="flex-1 bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
        />
        <button type="submit" disabled={searching}
          className="bg-surface-600 hover:bg-surface-500 text-white text-xs px-2 rounded disabled:opacity-50">
          {searching ? '…' : 'Search'}
        </button>
      </form>
      {results.length > 0 && (
        <div className="max-h-36 overflow-y-auto border border-surface-600 rounded bg-surface-900">
          {results.map((p) => (
            <button key={p.tcgPlayerId || p.id} onClick={() => handleSelect(p)} disabled={saving}
              className="w-full text-left px-2 py-1.5 hover:bg-surface-700 transition-colors disabled:opacity-50">
              <p className="text-white text-xs">{p.name}</p>
              <p className="text-slate-500 text-xs">{p.setName}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const fromTab = location.state?.fromTab || 'watchlist'
  const { format } = useCurrency()
  const [card, setCard] = useState(null)
  const [history, setHistory] = useState([])
  const [priceLoading, setPriceLoading] = useState(true)
  const [range, setRange] = useState(30)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [addedDateInput, setAddedDateInput] = useState('')
  const [purchasePriceInput, setPurchasePriceInput] = useState('')
  const [priceSaved, setPriceSaved] = useState(false)
  const [alertInput, setAlertInput] = useState('')
  const [alertPct, setAlertPct] = useState('')
  const [portfolioCount, setPortfolioCount] = useState(0)
  const [watchlistCount, setWatchlistCount] = useState(0)
  const [portfolioSibling, setPortfolioSibling] = useState(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [tcgCardData, setTcgCardData] = useState(null)
  const [allCards, setAllCards] = useState([])
  const [historyCondition, setHistoryCondition] = useState(null)
  const [historyCache, setHistoryCache] = useState({})
  const [siblings, setSiblings] = useState({})
  const [copyMenu, setCopyMenu] = useState(null)
  const [bannerSearch, setBannerSearch] = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifBtnRef = useRef(null)
  const { activeAlerts, alertCount, readIds, dismissAlert, dismissAll, markAllRead } = useAlerts()

  useEffect(() => { load() }, [id])

  async function load() {
    setPriceLoading(true)
    const cards = await window.api.listCards()
    setAllCards(cards)
    const found = cards.find((c) => c.id === id)
    if (!found) { navigate('/'); return }
    setPortfolioCount(cards.filter((c) => c.section === 'collection').length)
    setWatchlistCount(cards.filter((c) => (c.section || 'watchlist') === 'watchlist').length)
    setCard(found)
    if ((found.section || 'watchlist') === 'watchlist') {
      const sibling = cards.find((c) =>
        c.section === 'collection' &&
        ((found.pptId && c.pptId === found.pptId) ||
         (found.tcgId && c.tcgId === found.tcgId))
      ) || null
      setPortfolioSibling(sibling)
    } else {
      setPortfolioSibling(null)
    }
    setAddedDateInput(found.addedDate ? (() => { try { return new Date(found.addedDate).toISOString().split('T')[0] } catch { return '' } })() : '')
    setPurchasePriceInput(found.purchasePrice != null ? String(found.purchasePrice) : '')
    setAlertInput(found.alertPrice != null ? String(found.alertPrice) : '')
    setAlertPct(found.alertPct != null ? String(found.alertPct) : '')
    const h = await window.api.getPriceHistory(id)
    setHistory(h)
    setPriceLoading(false)
    setHistoryCondition(found.condition)
    const sibMap = {}
    if (found.pptId) {
      cards.forEach((c) => {
        if (c.pptId === found.pptId) sibMap[c.condition] = c.id
      })
    } else {
      sibMap[found.condition] = found.id
    }
    setSiblings(sibMap)
    const newCache = { [found.condition]: h }
    await Promise.all(
      Object.entries(sibMap)
        .filter(([cond]) => cond !== found.condition)
        .map(async ([cond, sibId]) => {
          const sibH = await window.api.getPriceHistory(sibId)
          newCache[cond] = sibH
        })
    )
    setHistoryCache(newCache)

    // For raw cards: fetch 6-month PPT history in the background and update the chart
    if (found.condition === 'raw' && found.pptId) {
      window.api.fetchPPTHistory(found.id).then((enriched) => {
        if (enriched && enriched.length > h.length) {
          setHistory(enriched)
          setHistoryCache((prev) => ({ ...prev, [found.condition]: enriched }))
        }
      }).catch(() => {})
    }
  }

  async function handleSwitchHistoryCondition(cond) {
    if (cond === historyCondition) return
    setHistoryCondition(cond)
    if (!historyCache[cond] && siblings[cond]) {
      const h = await window.api.getPriceHistory(siblings[cond])
      setHistoryCache((prev) => ({ ...prev, [cond]: h }))
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    await window.api.refreshPrices(id)
    await load()
    setIsRefreshing(false)
  }

  async function handleUpdateCondition(condition) {
    const updated = await window.api.updateCard(id, { condition })
    setCard((c) => ({ ...c, condition: updated.condition }))
  }

  async function handleUpdatePurchasePrice() {
    const parsed = parseFloat(purchasePriceInput)
    const newPrice = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
    if (newPrice === card.purchasePrice) return
    const updated = await window.api.updateCard(id, { purchasePrice: newPrice })
    setCard((c) => ({ ...c, purchasePrice: updated.purchasePrice }))
    setPriceSaved(true)
    setTimeout(() => setPriceSaved(false), 2000)
    // No current price yet — auto-fetch so P/L can compute immediately
    if (newPrice != null && !history.length) handleRefresh()
  }

  async function handleUpdateAddedDate() {
    if (!addedDateInput || addedDateInput === (card.addedDate ? (() => { try { return new Date(card.addedDate).toISOString().split('T')[0] } catch { return '' } })() : '')) return
    const updated = await window.api.updateCard(id, { addedDate: addedDateInput })
    setCard((c) => ({ ...c, addedDate: updated.addedDate }))
  }

  async function handleUpdateAlertPrice() {
    const parsed = parseFloat(alertInput)
    const newVal = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
    if (newVal === (card.alertPrice ?? null)) return
    const newPct = newVal != null && latest?.price != null
      ? Math.round((newVal - latest.price) / latest.price * 1000) / 10
      : null
    setAlertPct(newPct != null ? String(newPct) : '')
    const updated = await window.api.updateCard(id, { alertPrice: newVal, alertPct: newPct })
    setCard((c) => ({ ...c, alertPrice: updated.alertPrice, alertPct: updated.alertPct }))
  }

  async function handleRemove() {
    if (!confirm(`Remove ${card.name} from your tracker?`)) return
    await window.api.removeCard(id)
    navigate('/')
  }

  async function handleOpenCardModal() {
    if (tcgCardData) { setShowCardModal(true); return }
    if (!card.tcgId) { setShowCardModal(true); return }

    if (tcgCache[card.tcgId]) {
      setTcgCardData(tcgCache[card.tcgId])
      setShowCardModal(true)
      return
    }

    const hasStoredMeta = card.artist || card.types?.length || card.subtypes?.length
    const localFull = {
      id: card.tcgId,
      name: card.name,
      number: card.number,
      images: { large: card.imageUrlLarge, small: card.imageUrl },
      set: { name: card.setName, id: card.setId, series: card.setSeries || seriesFromSetId(card.setId) },
      rarity: card.rarity,
      artist: card.artist || null,
      types: card.types?.length ? card.types : null,
      subtypes: card.subtypes?.length ? card.subtypes : null,
      tcgplayer: { prices: { normal: { market: card.currentPrice } } },
    }

    if (hasStoredMeta) {
      tcgCache[card.tcgId] = localFull
      setTcgCardData(localFull)
      setShowCardModal(true)
      return
    }

    // Older card — open immediately with local data, enrich in background
    setTcgCardData(localFull)
    setShowCardModal(true)
    const results = await window.api.searchCardsAdvanced(`id:"${card.tcgId}"`).catch(() => [])
    const fetched = results?.[0] ?? null
    if (fetched) {
      tcgCache[card.tcgId] = fetched
      setTcgCardData(fetched)
    }
  }

  function handleFilterByArtist(artistName) {
    navigate('/', { state: { tab: 'search', artistFilter: artistName } })
  }

  async function handleModalRemove(tcgCard, section) {
    const owned = allCards.find((c) =>
      c.tcgId === tcgCard.id &&
      (section === 'collection' ? c.section === 'collection' : (!c.section || c.section === 'watchlist'))
    )
    if (!owned) return
    await window.api.removeCard(owned.id)
    if (owned.id === id) {
      navigate('/')
    } else {
      const cards = await window.api.listCards()
      setAllCards(cards)
      const updated = cards.find((c) => c.id === id)
      if (updated) setCard(updated)
      setShowCardModal(false)
    }
  }

  async function handleModalAdd() {
    const cards = await window.api.listCards()
    setAllCards(cards)
    const updated = cards.find((c) => c.id === id)
    if (updated) setCard(updated)
  }

  if (!card) return null

  const dayChangeMap = {}
  Object.entries(historyCache).forEach(([cond, hist]) => {
    if (hist.length >= 2) {
      const curr = hist[hist.length - 1].price
      const prev = hist[hist.length - 2].price
      dayChangeMap[cond] = { dollar: curr - prev, pct: prev > 0 ? ((curr - prev) / prev) * 100 : 0 }
    }
  })

  const latest = history[history.length - 1]
  const priceChangeDay = calcChange(latest?.price, history[history.length - 2]?.price)
  const priceChangeWeek = calcChange(latest?.price, history.find((p) => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return p.date >= d.toISOString().split('T')[0]
  })?.price)
  const priceChangeMonth = calcChange(latest?.price, history.find((p) => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return p.date >= d.toISOString().split('T')[0]
  })?.price)

  return (
    <>
    <div className="h-full flex flex-col overflow-hidden">
      {/* App banner */}
      <div className="flex-shrink-0 flex items-center gap-4 px-8 py-3 bg-surface-900 border-b border-surface-700">
        <div className="flex-shrink-0 mr-2">
          <h1 className="text-2xl font-black tracking-widest text-accent leading-none">POKEPRICE</h1>
          <p className="text-slate-500 text-xs mt-0.5 tracking-wider">Pokémon Card Price Tracker</p>
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-1.5 flex-shrink-0 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate('/', { state: { tab: tab.id } })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                tab.id === fromTab
                  ? `${tab.activeBg} ${tab.color}`
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {TAB_ICONS[tab.id]}
              {tab.label}
              {tab.id !== 'search' && tab.id !== 'trade' && tab.id !== 'pokedex' && tab.id !== 'cardshows' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab.id === fromTab ? 'bg-surface-600' : 'bg-surface-700'} text-slate-400`}>
                  {tab.id === 'watchlist' ? watchlistCount : portfolioCount}
                </span>
              )}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!bannerSearch.trim()) return
              navigate('/', { state: { tab: 'search', searchQuery: bannerSearch.trim() } })
            }}
            className="flex items-center ml-6"
          >
            <input
              type="text"
              value={bannerSearch}
              onChange={(e) => setBannerSearch(e.target.value)}
              placeholder="Search Items..."
              className="h-[34px] px-3 text-sm bg-surface-800 border border-surface-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-accent hover:border-surface-500 transition-colors w-64"
            />
          </form>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowAccount(true)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
          title="My Account"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth={1.8} />
          </svg>
          My Account
        </button>

        {/* Notifications */}
        <button
          ref={notifBtnRef}
          onClick={() => setNotifOpen((o) => !o)}
          className="flex-shrink-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors relative"
          title="Price alerts"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {alertCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-accent text-surface-900 text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/', { state: { openSettings: true } })}
          className="flex-shrink-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={() => navigate('/', { state: { tab: fromTab } })}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </div>

      <div className="flex-1 overflow-hidden min-h-0 px-4 py-3">
        <div className="h-full grid gap-3" style={{ gridTemplateColumns: '16rem 1fr', gridTemplateRows: 'auto 1fr' }}>

          {/* Card Image — row 1, left (position:relative with no in-flow children so the right column drives row height) */}
          <div className="relative bg-surface-800 border border-surface-600 rounded-xl overflow-hidden">
            <div className="absolute inset-0 p-3 flex flex-col">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex-shrink-0">Card Image</h3>
              <div className="flex-1 min-h-0 flex flex-col items-center overflow-hidden">
                <div className="flex-1 min-h-0 flex items-center justify-center w-full overflow-hidden">
                  {card.imageUrlLarge || card.imageUrl ? (
                    <img
                      src={card.imageUrlLarge || card.imageUrl} alt={card.name}
                      className="max-h-full object-contain rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity duration-200"
                      style={{ maxWidth: '160px' }}
                      onClick={handleOpenCardModal}
                      title="Click for details"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-700 rounded-lg flex items-center justify-center text-slate-600">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap mt-2 flex-shrink-0">
                  <div
                    className="flex items-center gap-1.5 cursor-text select-text"
                    onContextMenu={(e) => { e.preventDefault(); setCopyMenu({ x: e.clientX, y: e.clientY }) }}
                  >
                    <h1 className="text-white font-bold text-sm text-center leading-tight select-text">{card.name}</h1>
                    {card.number && <span className="text-slate-500 text-xs flex-shrink-0 select-text">#{card.number}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${CONDITION_COLOR[card.condition] || 'bg-slate-700 text-slate-300'}`}>
                    {CONDITION_LABEL[card.condition] || card.condition}
                  </span>
                </div>
                {card.rarity && <p className="text-slate-500 text-xs text-center mt-0.5 flex-shrink-0">{card.rarity}</p>}
                {(() => {
                  const series = card.setSeries || seriesFromSetId(card.setId)
                  const showSeries = series && series !== card.setName
                  return (
                    <div className="text-center flex-shrink-0 leading-tight mt-0.5">
                      {showSeries && <p className="text-slate-500 text-[10px]">{series}</p>}
                      {card.setName && <p className="text-slate-400 text-xs">{card.setName}</p>}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Pricing Info + PricesByGrade — row 1, right */}
          <div className="flex flex-col gap-3">

            {/* Pricing Information */}
            <div className="flex-shrink-0 bg-surface-800 border border-surface-600 rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">Pricing Information</h3>
                <button onClick={handleRefresh} disabled={isRefreshing}
                  className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 disabled:opacity-40 border border-surface-500 text-slate-300 text-xs rounded-lg transition-colors">
                  {isRefreshing ? 'Fetching...' : 'Refresh Price'}
                </button>
              </div>
              {(() => {
                  const cost = card.section === 'collection'
                    ? (card.purchasePrice ?? null)
                    : (portfolioSibling?.purchasePrice ?? null)
                  const currentValue = latest?.price ?? null
                  const profit = cost != null && currentValue != null ? currentValue - cost : null
                  const roi = profit != null && cost > 0 ? (profit / cost) * 100 : null
                  const isPos = (profit ?? 0) >= 0
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-surface-900 rounded-lg p-2.5">
                        <p className="text-slate-500 text-xs mb-1.5">Purchase Price</p>
                        {cost != null ? (
                          <p className="text-white font-bold text-3xl leading-tight">{format(cost)}</p>
                        ) : (
                          <p className="text-slate-600 text-3xl font-bold">—</p>
                        )}
                      </div>
                      <div className="bg-surface-900 rounded-lg p-2.5">
                        <p className="text-slate-500 text-xs mb-1.5">Current Price · {CONDITION_LABEL[card.condition] || card.condition}</p>
                        {priceLoading ? (
                          <div className="h-9 flex items-center"><PriceSpinner /></div>
                        ) : currentValue != null ? (
                          <p className="text-accent font-bold text-3xl leading-tight">{format(currentValue)}</p>
                        ) : (
                          <p className="text-slate-600 text-3xl font-bold">—</p>
                        )}
                      </div>
                      <div className="bg-surface-900 rounded-lg p-2.5">
                        <p className="text-slate-500 text-xs mb-1.5">Profit / Loss</p>
                        {priceLoading ? (
                          <div className="mt-1"><PriceSpinner /></div>
                        ) : profit != null ? (
                          <div className="flex items-baseline gap-2">
                            <p className={`font-bold text-3xl leading-tight ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isPos ? '+' : '−'}{format(Math.abs(profit))}
                            </p>
                            {roi != null && (
                              <span className={`text-sm font-semibold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isPos ? '+' : ''}{roi.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-600 text-3xl font-bold">—</p>
                        )}
                      </div>
                    </div>
                  )
                })()}
            </div>

            {/* Current Prices by Grade */}
            <PricesByGrade
              cardId={id}
              dayChangeMap={dayChangeMap}
              onPricesLoaded={async () => {
                const h = await window.api.getPriceHistory(id)
                if (h.length > 0) {
                  setHistory(h)
                  setPriceLoading(false)
                  setHistoryCache(prev => ({ ...prev, [card?.condition]: h }))
                }
              }}
            />

          </div>

          {/* Card Details — row 2, left */}
          <div className="min-h-0 overflow-y-auto bg-surface-800 border border-surface-600 rounded-xl p-3 flex flex-col space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Card Details</h3>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Condition</label>
              <select value={card.condition} onChange={(e) => handleUpdateCondition(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent">
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Binder</label>
              <BinderSelector
                section={card.section || 'watchlist'}
                value={card.binder || card.folder || ''}
                onChange={async (val) => {
                  const updated = await window.api.updateCard(id, { binder: val || null })
                  setCard((c) => ({ ...c, binder: updated.binder }))
                }}
                className="w-full"
                compact
              />
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">Date Added</label>
              <input
                type="date"
                value={addedDateInput}
                onChange={(e) => setAddedDateInput(e.target.value)}
                onBlur={handleUpdateAddedDate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur()
                  if (e.key === 'Escape') setAddedDateInput(card.addedDate ? (() => { try { return new Date(card.addedDate).toISOString().split('T')[0] } catch { return '' } })() : '')
                }}
                className="w-full bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>
            {card.section === 'collection' && (
              <div>
                <label className="text-slate-500 text-xs block mb-1">Purchase Price (Paid)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                  <input type="number" min="0.01" step="0.01" value={purchasePriceInput}
                    onChange={(e) => setPurchasePriceInput(e.target.value)}
                    onBlur={handleUpdatePurchasePrice}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur()
                      if (e.key === 'Escape') setPurchasePriceInput(card.purchasePrice != null ? String(card.purchasePrice) : '')
                    }}
                    placeholder="0.00"
                    className={`w-full bg-surface-700 border rounded pl-7 pr-2 py-1.5 text-sm text-white focus:outline-none ${priceSaved ? 'border-emerald-500' : 'border-surface-500 focus:border-accent'}`} />
                </div>
              </div>
            )}
            <div>
              <label className="text-accent text-xs font-medium block mb-1 flex items-center gap-1">
                {card.alertPrice != null && card.alertPct != null && (
                  <span className={card.alertPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {card.alertPct >= 0 ? '↑' : '↓'}
                  </span>
                )}
                Price Alert
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={alertPct}
                  onChange={async (e) => {
                    const val = e.target.value
                    setAlertPct(val)
                    if (val === '') {
                      setAlertInput('')
                      await window.api.updateCard(id, { alertPrice: null, alertPct: null })
                      setCard((c) => ({ ...c, alertPrice: null, alertPct: null }))
                    } else {
                      const p = parseFloat(val)
                      if (!isNaN(p)) {
                        if (latest?.price != null) {
                          const calc = Math.round(latest.price * (1 + p / 100) * 100) / 100
                          setAlertInput(String(calc))
                          const updated = await window.api.updateCard(id, { alertPrice: calc, alertPct: p })
                          setCard((c) => ({ ...c, alertPrice: updated.alertPrice, alertPct: p }))
                        } else {
                          await window.api.updateCard(id, { alertPrice: null, alertPct: p })
                          setCard((c) => ({ ...c, alertPrice: null, alertPct: p }))
                        }
                      }
                    }
                  }}
                  className="flex-shrink-0 w-16 text-xs bg-surface-600 border border-surface-500 rounded px-1 py-1.5 text-slate-400 focus:outline-none focus:border-accent"
                >
                  <option value="">%</option>
                  {PCT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p > 0 ? `+${p}%` : `${p}%`}</option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={alertInput}
                    onChange={(e) => { setAlertInput(e.target.value); setAlertPct('') }}
                    onBlur={handleUpdateAlertPrice}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur()
                      if (e.key === 'Escape') setAlertInput(card.alertPrice != null ? String(card.alertPrice) : '')
                    }}
                    placeholder="—"
                    className="w-full bg-surface-700 border border-surface-500 rounded pl-7 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
            <PPTLinker card={card} onLinked={() => load()} />
            <div className="flex-1" />
            <div className="pt-2 border-t border-surface-600">
              <button onClick={handleRemove}
                className="w-full bg-red-900/80 hover:bg-red-900 border border-red-800/60 text-red-200 text-sm font-semibold py-2 rounded-lg transition-colors">
                {card.section === 'collection' ? 'Remove from Collection' : 'Remove from Watchlist'}
              </button>
            </div>
          </div>

          {/* Price History — row 2, right */}
          <div className="min-h-0 bg-surface-800 border border-surface-600 rounded-xl p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-end mb-3 flex-shrink-0 gap-1">
              {CHART_RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRange(r.days)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    range === r.days
                      ? 'bg-accent text-black'
                      : 'bg-surface-600 text-slate-400 hover:bg-surface-500'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              <PriceChart
                history={historyCache[historyCondition] || []}
                range={range}
                onRangeChange={setRange}
                showRangeButtons={false}
              />
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Right-click copy menu */}
    {copyMenu && (
      <div
        className="fixed inset-0 z-40"
        onClick={() => setCopyMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setCopyMenu(null) }}
      >
        <div
          className="absolute bg-surface-700 border border-surface-500 rounded-lg shadow-xl py-1 min-w-[200px]"
          style={{ left: copyMenu.x, top: copyMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-600 hover:text-white transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(`${card.name}${card.number ? ` #${card.number}` : ''}`)
              setCopyMenu(null)
            }}
          >
            Copy "{card.name}{card.number ? ` #${card.number}` : ''}"
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-600 hover:text-white transition-colors"
            onClick={() => { navigator.clipboard.writeText(card.name); setCopyMenu(null) }}
          >
            Copy name only
          </button>
          {card.number && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-600 hover:text-white transition-colors"
              onClick={() => { navigator.clipboard.writeText(`#${card.number}`); setCopyMenu(null) }}
            >
              Copy card number
            </button>
          )}
        </div>
      </div>
    )}

    {showCardModal && (
      <CardDetailModal
        card={tcgCardData ?? {
          id: card.tcgId,
          name: card.name,
          number: card.number,
          images: { large: card.imageUrlLarge, small: card.imageUrl },
          set: { name: card.setName, id: card.setId, series: card.setSeries || seriesFromSetId(card.setId) },
          rarity: card.rarity,
          tcgplayer: { prices: { normal: { market: card.currentPrice } } },
        }}
        ownedCards={allCards}
        onAdd={handleModalAdd}
        onRemove={handleModalRemove}
        onClose={() => setShowCardModal(false)}
        onFilterByArtist={handleFilterByArtist}
      />
    )}

    {showAccount && (
      <AccountModal onClose={() => setShowAccount(false)} />
    )}

    <NotificationPanel
      isOpen={notifOpen}
      onClose={() => setNotifOpen(false)}
      anchorRef={notifBtnRef}
      alerts={activeAlerts}
      readIds={readIds}
      onDismiss={dismissAlert}
      onDismissAll={dismissAll}
      onMarkAllRead={markAllRead}
    />
    </>
  )
}

function calcChange(current, previous) {
  if (!current || !previous) return null
  return Math.round(((current - previous) / previous) * 10000) / 100
}
