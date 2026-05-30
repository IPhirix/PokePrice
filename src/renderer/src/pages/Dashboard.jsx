import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

const tcgCache = {} // tcgId → full TCG card object, persists for the session
import { useLocation, useNavigate } from 'react-router-dom'
import CardSearch from '../components/CardSearch'
import CardRow from '../components/CardRow'
import PortfolioSummary from '../components/PortfolioSummary'
import AppFooter from '../components/AppFooter'
import ShareModal from '../components/ShareModal'
import WatchlistSummary from '../components/WatchlistSummary'
import SearchPage, { CardDetailModal } from './SearchPage'
import Settings from './Settings'
import AccountModal from '../components/AccountModal'
import TradeAnalyzer from './TradeAnalyzer'
import Pokedex from './Pokedex'
import CardShows from './CardShows'
import NotificationPanel from '../components/NotificationPanel'
import { useAlerts } from '../context/AlertsContext'
import { useCurrency } from '../context/CurrencyContext'


const TABS = [
  { id: 'collection', label: 'Collection',         color: 'text-emerald-400',  activeBg: 'bg-emerald-900/30 border-emerald-500' },
  { id: 'watchlist', label: 'Watchlist',         color: 'text-sky-400',      activeBg: 'bg-sky-900/30 border-sky-500' },
  { id: 'trade',     label: 'Trade Analyzer',    color: 'text-yellow-300',   activeBg: 'bg-yellow-900/20 border-yellow-400' },
  { id: 'pokedex',   label: 'Pokédex',           color: 'text-red-400',      activeBg: 'bg-red-900/20 border-red-500' },
  { id: 'cardshows', label: 'Card Shows',        color: 'text-violet-400',   activeBg: 'bg-violet-900/30 border-violet-500' },
  { id: 'search',    label: 'Search',            color: 'text-accent',       activeBg: 'bg-amber-900/20 border-accent' },
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

const COND_LABEL_EXPORT = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }

const ALL_COLUMNS = [
  { key: 'name',            label: 'Card Name' },
  { key: 'setName',         label: 'Set' },
  { key: 'number',          label: 'Card Number' },
  { key: 'rarity',          label: 'Rarity' },
  { key: 'condition',       label: 'Condition' },
  { key: 'purchasePrice',   label: 'Purchase Price',   portfolioOnly: true },
  { key: 'currentPrice',    label: 'Current Price' },
  { key: 'plDollar',        label: 'P&L ($)',           portfolioOnly: true },
  { key: 'plPct',           label: 'P&L (%)',           portfolioOnly: true },
  { key: 'targetBuyPrice',  label: 'Buy Price Alert' },
  { key: 'targetSellPrice', label: 'Sell Price Alert' },
  { key: 'imageUrl',        label: 'Image URL',         defaultOff: true },
]

function parseCardNum(num) {
  if (!num) return Infinity
  const slashPart = num.split('/')[0]
  const match = slashPart.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : Infinity
}

function applySort(cards, sortBy, setDateMap = new Map()) {
  return [...cards].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'price') return (b.currentPrice || 0) - (a.currentPrice || 0)
    if (sortBy === 'set_asc') {
      const setComp = (a.setName || '').localeCompare(b.setName || '')
      if (setComp !== 0) return setComp
      return parseCardNum(a.number) - parseCardNum(b.number)
    }
    if (sortBy === 'changeDay') return (b.changeDay ?? -Infinity) - (a.changeDay ?? -Infinity)
    if (sortBy === 'changeWeek') return (b.changeWeek ?? -Infinity) - (a.changeWeek ?? -Infinity)
    if (sortBy === 'changeMonth') return (b.changeMonth ?? -Infinity) - (a.changeMonth ?? -Infinity)
    if (sortBy === 'priceAlert') {
      const hasAlert = (c) =>
        (c.targetBuyPrice != null && c.currentPrice != null && c.currentPrice <= c.targetBuyPrice) ||
        (c.targetSellPrice != null && c.currentPrice != null && c.currentPrice >= c.targetSellPrice)
      const aAlert = hasAlert(a), bAlert = hasAlert(b)
      if (aAlert && !bAlert) return -1
      if (!aAlert && bAlert) return 1
      return a.name.localeCompare(b.name)
    }
    if (sortBy === 'pnl_best' || sortBy === 'pnl_worst') {
      const pnl = (c) => c.currentPrice != null && c.purchasePrice != null
        ? c.currentPrice - c.purchasePrice : null
      const pa = pnl(a), pb = pnl(b)
      if (pa == null && pb == null) return 0
      if (pa == null) return 1
      if (pb == null) return -1
      return sortBy === 'pnl_best' ? pb - pa : pa - pb
    }
    if (sortBy === 'released_desc' || sortBy === 'released_asc') {
      const da = setDateMap.get(a.setId) || ''
      const db = setDateMap.get(b.setId) || ''
      const cmp = db.localeCompare(da)
      return sortBy === 'released_desc' ? cmp : -cmp
    }
    return new Date(b.addedDate) - new Date(a.addedDate)
  })
}

function buildExportRows(cards, enabledCols, section) {
  const visibleCols = ALL_COLUMNS.filter((c) => enabledCols.has(c.key) && (!c.portfolioOnly || section === 'collection'))
  const rows = [visibleCols.map((c) => c.label)]
  for (const card of cards) {
    const condition = COND_LABEL_EXPORT[card.condition] || card.condition
    const currentPrice = card.currentPrice ?? null
    const purchasePrice = card.purchasePrice ?? null
    const pl = currentPrice != null && purchasePrice != null ? currentPrice - purchasePrice : null
    const plPct = pl != null && purchasePrice > 0 ? (pl / purchasePrice * 100).toFixed(2) : null
    const vals = {
      name: card.name, setName: card.setName, number: card.number,
      rarity: card.rarity, condition,
      purchasePrice: purchasePrice != null ? purchasePrice.toFixed(2) : null,
      currentPrice: currentPrice != null ? currentPrice.toFixed(2) : null,
      plDollar: pl != null ? pl.toFixed(2) : null,
      plPct,
      targetBuyPrice: card.targetBuyPrice != null ? card.targetBuyPrice.toFixed(2) : null,
      targetSellPrice: card.targetSellPrice != null ? card.targetSellPrice.toFixed(2) : null,
      imageUrl: card.imageUrl || null,
    }
    rows.push(visibleCols.map((c) => vals[c.key] ?? ''))
  }
  return rows
}

const SOLD_COND_LABEL = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }
const SOLD_COND_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}

function SoldCardRow({ card, onRemove, onUndo, onEdit }) {
  const { format } = useCurrency()
  const { soldInfo } = card
  const [confirming, setConfirming] = useState(false)
  const condLabel = SOLD_COND_LABEL[card.condition] || card.condition
  const condColor = SOLD_COND_COLOR[card.condition] || 'bg-slate-700 text-slate-300'
  const pl = soldInfo?.salePrice != null && card.purchasePrice != null
    ? soldInfo.salePrice - card.purchasePrice : null
  const dateStr = soldInfo?.saleDate
    ? new Date(soldInfo.saleDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div
      className="flex items-center gap-4 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 mb-2 cursor-pointer hover:border-surface-500 hover:bg-surface-700/50 transition-all group"
      onClick={() => !confirming && onEdit?.(card)}
    >
      <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-surface-900 border border-surface-700">
        {card.imageUrl
          ? <img src={card.imageUrl} alt={card.name} className="h-full w-full object-contain" />
          : <div className="w-full h-full" />
        }
      </div>
      <div className="w-56 flex-shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-slate-300 font-semibold text-sm truncate">{card.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${condColor}`}>{condLabel}</span>
        </div>
        <p className="text-slate-600 text-xs truncate">{card.setName}{card.number ? ` · #${card.number}` : ''}</p>
      </div>
      <div className="flex-shrink-0">
        {soldInfo?.isTrade ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-900/40 border border-sky-600/40 text-sky-400">Traded</span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-600/40 text-emerald-400">Sold</span>
        )}
      </div>
      <div className="flex-1 text-slate-500 text-sm">{dateStr}</div>
      <div className="w-28 flex-shrink-0 text-right">
        <p className="text-slate-600 text-xs mb-0.5">Sale Price</p>
        <p className="text-slate-300 font-bold text-sm">{soldInfo?.salePrice != null ? format(soldInfo.salePrice) : '—'}</p>
      </div>
      <div className="w-24 flex-shrink-0 text-right">
        <p className="text-slate-600 text-xs mb-0.5">P&L</p>
        <p className={`font-bold text-sm ${pl != null ? (pl >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
          {pl != null ? `${pl >= 0 ? '+' : '−'}${format(Math.abs(pl))}` : '—'}
        </p>
      </div>
      <div className={`flex-shrink-0 flex items-center justify-end ${confirming ? '' : 'w-24'}`} onClick={(e) => e.stopPropagation()}>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUndo?.(card.id)}
              className="text-xs px-2 py-0.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-semibold transition-colors whitespace-nowrap"
              title="Move back to Collection"
            >Undo</button>
            <button
              onClick={() => onRemove?.(card.id)}
              className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded font-semibold transition-colors"
            >Remove</button>
            <button
              onClick={() => setConfirming(false)}
              className="text-slate-500 hover:text-white text-sm leading-none transition-colors px-1"
            >✕</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-slate-600 hover:text-red-400 transition-colors text-xl leading-none opacity-0 group-hover:opacity-100"
            title="Remove"
          >✕</button>
        )}
      </div>
    </div>
  )
}

function SoldEditModal({ card, onClose, onSaved }) {
  const { format } = useCurrency()
  const [salePrice, setSalePrice] = useState(
    card.soldInfo?.salePrice != null ? String(card.soldInfo.salePrice) : ''
  )
  const [purchasePrice, setPurchasePrice] = useState(
    card.purchasePrice != null ? String(card.purchasePrice) : ''
  )
  const [saleDate, setSaleDate] = useState(
    card.soldInfo?.saleDate || new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)

  const isTrade = card.soldInfo?.isTrade || false
  const salePriceNum = parseFloat(salePrice)
  const purchasePriceNum = parseFloat(purchasePrice)
  const effectiveSalePrice = isTrade && !salePrice ? 0 : salePriceNum
  const previewPL = !isNaN(effectiveSalePrice) && salePrice !== '' && !isNaN(purchasePriceNum) && purchasePrice !== ''
    ? effectiveSalePrice - purchasePriceNum : null
  const canSubmit = isTrade
    ? !salePrice || (!isNaN(salePriceNum) && salePriceNum >= 0)
    : !isNaN(salePriceNum) && salePriceNum > 0

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    try {
      const updates = {
        soldInfo: {
          ...card.soldInfo,
          salePrice: Math.round(effectiveSalePrice * 100) / 100,
          saleDate,
        }
      }
      if (!isNaN(purchasePriceNum) && purchasePrice !== '') {
        updates.purchasePrice = Math.round(purchasePriceNum * 100) / 100
      } else if (purchasePrice === '') {
        updates.purchasePrice = null
      }
      await window.api.updateCard(card.id, updates)
      onSaved()
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-surface-600 flex items-center gap-4">
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.name} className="w-16 h-[90px] object-contain rounded-lg flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{card.name}</h2>
            <p className="text-slate-400 text-sm truncate mt-0.5">{card.setName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center flex-shrink-0 self-start">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                <input
                  autoFocus
                  type="number" min="0" step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="0.00"
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Sale Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="0.00"
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
          {previewPL != null && (
            <p className={`text-xs -mt-2 ${previewPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              P&L: {previewPL >= 0 ? '+' : '−'}${Math.abs(previewPL).toFixed(2)}
            </p>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          {card.soldInfo?.tradeCardsReceived?.length > 0 && (
            <div>
              <p className="text-slate-400 text-sm font-medium mb-2">Cards Received</p>
              <div className="space-y-1.5">
                {card.soldInfo.tradeCardsReceived.map((tc, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface-700 rounded-lg px-3 py-2">
                    {tc.imageUrl && (
                      <img src={tc.imageUrl} alt={tc.name} className="w-8 h-11 object-contain rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-xs font-medium truncate">{tc.name}</p>
                      <p className="text-slate-600 text-xs truncate">{tc.setName}</p>
                    </div>
                    {tc.estimatedValue && (
                      <span className="text-slate-500 text-xs flex-shrink-0">${parseFloat(tc.estimatedValue).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-surface-600 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !canSubmit}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportModal({ cards, section, setDateMap, onClose }) {
  const SORT_OPTIONS = [
    { value: 'addedDate',      label: 'Recently Added' },
    { value: 'name',           label: 'Name (A → Z)' },
    { value: 'set_asc',        label: 'Set' },
    { value: 'released_desc',  label: 'Released (Newest First)' },
    { value: 'released_asc',   label: 'Released (Oldest First)' },
    { value: 'price',          label: 'Current Price (High → Low)' },
    { value: 'priceAlert',     label: 'Price Alert' },
    { value: 'changeDay',      label: '1D % Change' },
    { value: 'changeWeek',     label: '1W % Change' },
    { value: 'changeMonth',    label: '1M % Change' },
    ...(section === 'collection' ? [
      { value: 'pnl_best',  label: 'P&L — Best First' },
      { value: 'pnl_worst', label: 'P&L — Worst First' },
    ] : []),
  ]

  const [format, setFormat] = useState('csv')
  const [exportSort, setExportSort] = useState('addedDate')
  const [enabledCols, setEnabledCols] = useState(() => new Set(
    ALL_COLUMNS.filter((c) => !c.defaultOff && (!c.portfolioOnly || section === 'collection')).map((c) => c.key)
  ))
  const [exporting, setExporting] = useState(false)

  const visibleCols = ALL_COLUMNS.filter((c) => !c.portfolioOnly || section === 'collection')

  function toggleCol(key) {
    setEnabledCols((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleExport() {
    setExporting(true)
    const sorted = applySort(cards, exportSort, setDateMap)
    const rows = buildExportRows(sorted, enabledCols, section)
    await window.api.exportCards({ rows, format, section })
    setExporting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Export {section === 'collection' ? 'Collection' : 'Watchlist'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Format */}
          <div>
            <p className="text-slate-300 text-sm font-medium mb-2">File Format</p>
            <div className="flex gap-3">
              {[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel (.xlsx)' }].map((opt) => (
                <button key={opt.value} onClick={() => setFormat(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    format === opt.value
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-surface-700 border-surface-500 text-slate-400 hover:text-white'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <p className="text-slate-300 text-sm font-medium mb-2">Sort By</p>
            <select value={exportSort} onChange={(e) => setExportSort(e.target.value)}
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Columns */}
          <div>
            <p className="text-slate-300 text-sm font-medium mb-2">Columns</p>
            <div className="grid grid-cols-2 gap-2.5">
              {visibleCols.map((col) => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer group" onClick={() => toggleCol(col.key)}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    enabledCols.has(col.key) ? 'bg-accent border-accent' : 'border-surface-400 bg-surface-700'
                  }`}>
                    {enabledCols.has(col.key) && (
                      <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors select-none">{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-surface-600 flex gap-3">
          <button onClick={handleExport} disabled={exporting || enabledCols.size === 0}
            className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition-colors">
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()

  const [cards, setCards] = useState([])
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'collection')
  const [showSearch, setShowSearch] = useState(null) // null | 'portfolio' | 'watchlist'
  const [refreshKey, setRefreshKey] = useState(0)
  const [pokedexResetKey, setPokedexResetKey] = useState(0)
  const [sortBy, setSortBy] = useState('addedDate')
  const [bannerSearch, setBannerSearch] = useState('')
  const [globalSearchQuery, setGlobalSearchQuery] = useState(location.state?.searchQuery || '')
  const [globalArtistFilter, setGlobalArtistFilter] = useState(location.state?.artistFilter || '')
  const [activeModalCard, setActiveModalCard] = useState(null)
  const [modalTcgData, setModalTcgData] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showPlPct, setShowPlPct] = useState(false)
  const [showDollarChanges, setShowDollarChanges] = useState(false)
  const [binderFilter, setBinderFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState('')
  const [availableBinders, setAvailableBinders] = useState([])
  const [showAddBinderModal, setShowAddBinderModal] = useState(false)
  const [newBinderName, setNewBinderName] = useState('')
  const [newBinderError, setNewBinderError] = useState(false)
  const [renamingBinder, setRenamingBinder] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [hidePortfolioValues, setHidePortfolioValues] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifBtnRef = useRef(null)
  const { activeAlerts, alertCount, readIds, dismissAlert, dismissAll, markAllRead } = useAlerts()
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [showBulkBinderPicker, setShowBulkBinderPicker] = useState(false)
  const [soldCards, setSoldCards] = useState([])
  const [soldCollapsed, setSoldCollapsed] = useState(false)
  const [editingSoldCard, setEditingSoldCard] = useState(null)
  const [listCollapsed, setListCollapsed] = useState(false)

  const cardListRef = useRef(null)
  const scrollTimerRef = useRef(null)

  function handleCardListScroll() {
    const el = cardListRef.current
    if (!el) return
    el.classList.add('is-scrolling')
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => el.classList.remove('is-scrolling'), 1000)
  }

  // Push a browser history entry when Settings opens so the mouse back button closes it
  // (HashRouter uses hashchange, not popstate, so this doesn't interfere with React Router)
  useEffect(() => {
    if (showSettings) {
      window.history.pushState({ pokeprice: 'settings' }, '')
      function handlePopState() {
        setShowSettings(false)
      }
      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [showSettings])

  useEffect(() => {
    if (location.state?.openSettings) setShowSettings(true)
    if (location.state?.tab) setActiveTab(location.state.tab)
    if (location.state?.artistFilter) {
      setGlobalArtistFilter(location.state.artistFilter)
      setActiveTab('search')
    }
  }, [location.state])

  const [allSets, setAllSets] = useState([])
  const setDateMap = useMemo(() => new Map(allSets.map((s) => [s.id, s.releaseDate || ''])), [allSets])

  const loadCards = useCallback(async () => {
    const [list, sold] = await Promise.all([
      window.api.listCards(),
      window.api.listSoldCards(),
    ])
    setCards(list)
    setSoldCards(sold)
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    loadCards()
    window.api.listSets().then(setAllSets).catch(() => {})
    window.api.onPricesRefreshed(() => { loadCards() })
    window.api.onCardsChanged(() => { loadCards() })
    window.api.getSettings().then((s) => {
      if (s.confirmRemove === false) setConfirmRemove(false)
      if (s.defaultSortBy) setSortBy(s.defaultSortBy)
      if (s.defaultStartTab && !location.state?.tab) setActiveTab(s.defaultStartTab)
    })
  }, [loadCards])

  async function handleRemove(id) {
    await window.api.removeCard(id)
    loadCards()
  }

  async function handleUndoSold(id) {
    await window.api.updateCard(id, { section: 'collection', soldInfo: null })
    loadCards()
  }

  async function handleBulkRemove() {
    for (const id of selectedCards) {
      await window.api.removeCard(id)
    }
    setSelectedCards(new Set())
    setBulkMode(false)
    loadCards()
  }

  function handleToggleSelect(id) {
    setSelectedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitBulkMode() {
    setBulkMode(false)
    setSelectedCards(new Set())
    setShowBulkBinderPicker(false)
  }

  async function handleBulkMoveToBinder(binderName) {
    for (const id of selectedCards) {
      await window.api.updateCard(id, { binder: binderName || null })
    }
    setShowBulkBinderPicker(false)
    setSelectedCards(new Set())
    setBulkMode(false)
    await reloadBinders()
    loadCards()
  }

  async function reloadBinders() {
    if (activeTab === 'collection' || activeTab === 'watchlist') {
      const binders = await window.api.listBinders(activeTab).catch(() => [])
      setAvailableBinders(binders)
    }
  }

  async function handleCardAdded() {
    await loadCards()
    const section = (activeTab === 'collection' || activeTab === 'watchlist') ? activeTab : 'collection'
    const binders = await window.api.listBinders(section).catch(() => [])
    setAvailableBinders(binders)
  }

  async function handleCardRowClick(localCard) {
    setActiveModalCard(localCard)
    if (!localCard.tcgId) { setModalTcgData(null); return }

    // Build placeholder from stored fields — shown immediately while fetch runs
    const localFull = {
      id: localCard.tcgId,
      name: localCard.name,
      number: localCard.number,
      images: { large: localCard.imageUrlLarge, small: localCard.imageUrl },
      set: { name: localCard.setName, id: localCard.setId },
      rarity: localCard.rarity,
      artist: localCard.artist || null,
      types: localCard.types?.length ? localCard.types : null,
      subtypes: localCard.subtypes?.length ? localCard.subtypes : null,
      tcgplayer: { prices: { normal: { market: localCard.currentPrice } } },
    }
    setModalTcgData(localFull)

    // Session cache hit — enrich with current price and return
    if (tcgCache[localCard.tcgId]) {
      setModalTcgData({ ...tcgCache[localCard.tcgId], tcgplayer: localFull.tcgplayer })
      return
    }

    // Always fetch full card from TCGdex to ensure complete metadata
    const results = await window.api.searchCardsAdvanced(`id:"${localCard.tcgId}"`).catch(() => [])
    const fetched = results?.[0] ?? null
    if (fetched) {
      const enriched = { ...fetched, tcgplayer: localFull.tcgplayer }
      tcgCache[localCard.tcgId] = enriched
      setModalTcgData(enriched)
      // Persist any metadata that's missing from the stored card record
      const metaToSave = {}
      if (fetched.artist && !localCard.artist)                     metaToSave.artist   = fetched.artist
      if (fetched.types?.length && !localCard.types?.length)       metaToSave.types    = fetched.types
      if (fetched.subtypes?.length && !localCard.subtypes?.length) metaToSave.subtypes = fetched.subtypes
      if (fetched.rarity && !localCard.rarity)                     metaToSave.rarity   = fetched.rarity
      if (Object.keys(metaToSave).length) window.api.updateCard(localCard.id, metaToSave).catch(() => {})
    }
  }

  async function handleModalRemove(tcgCard, section) {
    const owned = cards.find((c) =>
      c.tcgId === tcgCard.id &&
      (section === 'collection' ? c.section === 'collection' : (!c.section || c.section === 'watchlist'))
    )
    if (!owned) return
    await window.api.removeCard(owned.id)
    setActiveModalCard(null)
    setModalTcgData(null)
    loadCards()
  }

  function handleModalFilterByArtist(artistName) {
    setActiveModalCard(null)
    setModalTcgData(null)
    setGlobalArtistFilter(artistName)
    setActiveTab('search')
  }

  function handleBannerSearch() {
    if (!bannerSearch.trim()) return
    setGlobalSearchQuery(bannerSearch.trim())
    setBannerSearch('')
    setActiveTab('search')
  }

  useEffect(() => {
    if (activeTab === 'collection' || activeTab === 'watchlist') {
      setBinderFilter('')
      setAlertFilter('')
      window.api.listBinders(activeTab).then(setAvailableBinders).catch(() => {})
    }
    setListCollapsed(false)
  }, [activeTab])

  const tabCards = cards.filter((c) => (c.section || 'watchlist') === activeTab)
  const watchlistCount = cards.filter((c) => (c.section || 'watchlist') === 'watchlist').length
  const portfolioCount = cards.filter((c) => (c.section || 'watchlist') === 'collection').length

  const binderFiltered = binderFilter
    ? tabCards.filter((c) => (c.binder || c.folder) === binderFilter)
    : tabCards
  const filteredCards = alertFilter === 'buy'
    ? binderFiltered.filter((c) => c.targetBuyPrice != null && c.currentPrice != null && c.currentPrice <= c.targetBuyPrice)
    : alertFilter === 'sell'
    ? binderFiltered.filter((c) => c.targetSellPrice != null && c.currentPrice != null && c.currentPrice >= c.targetSellPrice)
    : binderFiltered
  const sorted = applySort(filteredCards, sortBy, setDateMap)

  const activeTabCfg = TABS.find((t) => t.id === activeTab)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Single banner row */}
      <div className="flex-shrink-0 px-8 py-3 bg-surface-900 border-b border-surface-700">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex-shrink-0 mr-2">
            <h1 className="text-2xl font-black tracking-widest text-accent leading-none">POKEPRICE</h1>
            <p className="text-slate-500 text-xs tracking-wider mt-0.5">Pokémon Card Price Tracker</p>
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1.5 flex-shrink-0 items-center">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setShowSettings(false)
                  exitBulkMode()
                  navigate('/', { replace: true, state: { tab: tab.id } })
                  if (tab.id !== 'collection' && ['pnl_best','pnl_worst'].includes(sortBy)) setSortBy('addedDate')
                  if (tab.id === 'pokedex') setPokedexResetKey((k) => k + 1)
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? `${tab.activeBg} ${tab.color}`
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {TAB_ICONS[tab.id]}
                {tab.label}
                {tab.id !== 'search' && tab.id !== 'trade' && tab.id !== 'pokedex' && tab.id !== 'cardshows' && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-surface-600' : 'bg-surface-700'
                  } text-slate-400`}>
                    {tab.id === 'watchlist' ? watchlistCount : portfolioCount}
                  </span>
                )}
              </button>
            ))}
            {/* Inline search field to the right of the Search tab */}
            <div className="flex items-center ml-1">
              <input
                type="text"
                value={bannerSearch}
                onChange={(e) => setBannerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBannerSearch()}
                placeholder="Search cards…"
                className="h-[34px] px-3 text-sm bg-surface-800 border border-surface-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-accent hover:border-surface-500 transition-colors w-44"
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Hide values (portfolio only) */}
          {activeTab === 'collection' && (
            <button
              onClick={() => setHidePortfolioValues((v) => !v)}
              className="flex-shrink-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
              title={hidePortfolioValues ? 'Show values' : 'Hide values'}
            >
              {hidePortfolioValues ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}

          {/* My Account */}
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

          {/* Settings gear */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
            title="Settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Portfolio summary — only visible on portfolio tab */}
      {activeTab === 'collection' && !showSettings && (
        <div className="pt-3">
          <PortfolioSummary refreshKey={refreshKey} binderFilter={binderFilter} hideValues={hidePortfolioValues} alertFilter={alertFilter} onAlertFilter={(v) => setAlertFilter((cur) => cur === v ? '' : v)} />
        </div>
      )}

      {/* Watchlist summary tiles */}
      {activeTab === 'watchlist' && !showSettings && (
        <div className="pt-3">
          <WatchlistSummary cards={filteredCards} onRefresh={loadCards} />
        </div>
      )}

      {/* Controls sub-bar — portfolio/watchlist only */}
      {activeTab !== 'search' && activeTab !== 'trade' && activeTab !== 'pokedex' && activeTab !== 'cardshows' && !showSettings && (
        <div className="flex-shrink-0 flex items-center gap-3 px-8 py-3">
          {/* Title */}
          <h2 className="text-white font-bold text-xl whitespace-nowrap">
            {activeTab === 'collection' ? 'My Collection' : 'My Watchlist'}
          </h2>

          {/* Binder dropdown — right of title */}
          <div className="flex items-center gap-1">
            <select
              value={binderFilter}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  setNewBinderName('')
                  setShowAddBinderModal(true)
                } else {
                  setBinderFilter(e.target.value)
                }
              }}
              className="w-44 bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
            >
              <option value="">All Binders</option>
              {availableBinders.map((f) => <option key={f} value={f}>{f}</option>)}
              <option value="__add__">+ Add binder…</option>
            </select>
            {binderFilter && (
              <>
                <button
                  onClick={() => { setRenameValue(binderFilter); setRenamingBinder(true) }}
                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-accent hover:bg-accent/10 rounded transition-colors flex-shrink-0"
                  title={`Rename binder "${binderFilter}"`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    await window.api.deleteBinder(activeTab, binderFilter)
                    setBinderFilter('')
                    await reloadBinders()
                  }}
                  className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                  title={`Delete binder "${binderFilter}"`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Add button */}
          {activeTab === 'collection' && (
            <button
              onClick={() => setShowSearch('collection')}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-black text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              + Add to Collection
            </button>
          )}
          {activeTab === 'watchlist' && (
            <button
              onClick={() => setShowSearch('watchlist')}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              + Add to Watchlist
            </button>
          )}

          {/* Bulk edit — inline after Add button */}
          {!bulkMode ? (
            <button
              onClick={() => setBulkMode(true)}
              disabled={sorted.length === 0}
              className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-40 border border-red-700/50 hover:border-red-600 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
            >
              Bulk Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs whitespace-nowrap">{selectedCards.size} selected</span>
              {/* Move to Binder */}
              <div className="relative">
                <button
                  onClick={() => setShowBulkBinderPicker((v) => !v)}
                  disabled={selectedCards.size === 0}
                  className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 disabled:opacity-40 border border-surface-500 hover:border-accent text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                  Move to Binder
                </button>
                {showBulkBinderPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBulkBinderPicker(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl z-50 min-w-[180px] py-1 overflow-hidden">
                      <button
                        onClick={() => handleBulkMoveToBinder('')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-surface-700 hover:text-white transition-colors"
                      >
                        No Binder (unassign)
                      </button>
                      {availableBinders.length > 0 && (
                        <div className="border-t border-surface-700 mt-1 pt-1">
                          {availableBinders.map((f) => (
                            <button
                              key={f}
                              onClick={() => handleBulkMoveToBinder(f)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleBulkRemove}
                disabled={selectedCards.size === 0}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Remove
              </button>
              <button
                onClick={exitBulkMode}
                className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex-1" />

          {/* Right: alerts, sort, export, share */}
          <span className="text-slate-500 text-sm whitespace-nowrap">Alerts</span>
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="w-36 bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
          >
            <option value="">All Cards</option>
            <option value="buy">Cards to Buy</option>
            <option value="sell">Cards to Sell</option>
          </select>
          <span className="text-slate-500 text-sm whitespace-nowrap">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-44 bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-accent"
          >
            <option value="addedDate">Recently Added</option>
            <option value="name">Name (A→Z)</option>
            <option value="set_asc">Set</option>
            <option value="released_desc">Released (Newest First)</option>
            <option value="released_asc">Released (Oldest First)</option>
            <option value="price">Current Price</option>
            <option value="priceAlert">Price Alert</option>
            {activeTab === 'collection' && <option value="pnl_best">P&amp;L — Largest Profit</option>}
            {activeTab === 'collection' && <option value="pnl_worst">P&amp;L — Largest Loss</option>}
            <option value="changeDay">1D % Change</option>
            <option value="changeWeek">1W % Change</option>
            <option value="changeMonth">1M % Change</option>
          </select>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={sorted.length === 0}
            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 text-sm font-medium rounded-lg transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            disabled={sorted.length === 0}
            className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 border border-violet-500/50 hover:border-violet-400 text-violet-400 hover:text-violet-300 text-sm font-medium rounded-lg transition-colors"
            title="Share"
          >
            Share
          </button>
        </div>
      )}
      {activeTab !== 'search' && activeTab !== 'trade' && activeTab !== 'pokedex' && activeTab !== 'cardshows' && !showSettings && (
        <div className="flex-shrink-0 border-b border-surface-700 mx-6" />
      )}

      {/* Trade Analyzer — own layout */}
      {activeTab === 'trade' && !showSettings && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <TradeAnalyzer />
        </div>
      )}

      {/* Pokédex — own layout */}
      {activeTab === 'pokedex' && !showSettings && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Pokedex resetKey={pokedexResetKey} />
        </div>
      )}

      {/* Card Shows — own layout */}
      {activeTab === 'cardshows' && !showSettings && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <CardShows />
        </div>
      )}

      {/* Card list / Search page / Settings */}
      {(activeTab !== 'trade' && activeTab !== 'pokedex' && activeTab !== 'cardshows' || showSettings) && (
        <div ref={cardListRef} onScroll={handleCardListScroll} className="flex-1 [overflow-y:overlay] px-6 py-3 scrollbar-autohide">
          {showSettings ? (
            <Settings onBack={() => setShowSettings(false)} onSortChange={(val) => setSortBy(val)} onCardDataChanged={loadCards} />
          ) : activeTab === 'search' ? (
            <SearchPage
              key={globalSearchQuery + '|' + globalArtistFilter}
              initialQuery={globalSearchQuery}
              initialArtist={globalArtistFilter}
              onCardAdded={handleCardAdded}
            />
          ) : (
            <>
              {/* Collapsible section header for collection / watchlist */}
              <button
                onClick={() => setListCollapsed((v) => !v)}
                className="w-full flex items-center gap-3 mb-3"
              >
                <div className="flex-1 h-px bg-surface-700" />
                <span className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors whitespace-nowrap">
                  <svg
                    className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${listCollapsed ? '-rotate-90' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {activeTab === 'collection' ? 'My Collection' : 'My Watchlist'}
                  <span className="text-xs px-1.5 py-0.5 bg-surface-700 rounded-full text-slate-400">{sorted.length}</span>
                </span>
                <div className="flex-1 h-px bg-surface-700" />
              </button>

              {!listCollapsed && (sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-600">
                  <p className="text-lg mb-2">No cards in your {activeTabCfg?.label.toLowerCase()} yet</p>
                  <p className="text-sm">
                    Click{' '}
                    <span className={activeTab === 'collection' ? 'text-accent' : 'text-sky-400'}>
                      {`"+ Add to ${activeTabCfg?.label}"`}
                    </span>{' '}
                    to get started
                  </p>
                </div>
              ) : (
                sorted.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    onRemove={handleRemove}
                    onRefresh={loadCards}
                    confirmRemove={confirmRemove}
                    onBinderFilter={(binder) => setBinderFilter(binder)}
                    showPlPct={showPlPct}
                    onTogglePlPct={() => setShowPlPct((v) => !v)}
                    showDollarChanges={showDollarChanges}
                    onToggleDollarChanges={() => setShowDollarChanges((v) => !v)}
                    bulkMode={bulkMode}
                    isSelected={selectedCards.has(card.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))
              ))}
              {activeTab === 'collection' && (
                <div className="mt-6 mb-2">
                  <button
                    onClick={() => setSoldCollapsed((v) => !v)}
                    className="w-full flex items-center gap-3 mb-3"
                  >
                    <div className="flex-1 h-px bg-surface-700" />
                    <span className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors whitespace-nowrap">
                      <svg
                        className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${soldCollapsed ? '-rotate-90' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      Traded / Sold
                      <span className="text-xs px-1.5 py-0.5 bg-surface-700 rounded-full text-slate-400">{soldCards.length}</span>
                    </span>
                    <div className="flex-1 h-px bg-surface-700" />
                  </button>
                  {!soldCollapsed && soldCards
                    .slice()
                    .sort((a, b) => (b.soldInfo?.saleDate || '').localeCompare(a.soldInfo?.saleDate || ''))
                    .map((card) => (
                      <SoldCardRow
                        key={card.id}
                        card={card}
                        onRemove={handleRemove}
                        onUndo={handleUndoSold}
                        onEdit={setEditingSoldCard}
                      />
                    ))
                  }
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showSearch && (
        <CardSearch
          section={showSearch}
          onAdd={handleCardAdded}
          onClose={() => setShowSearch(null)}
        />
      )}

      {activeModalCard && (
        <CardDetailModal
          card={modalTcgData ?? {
            id: activeModalCard.tcgId,
            name: activeModalCard.name,
            number: activeModalCard.number,
            images: { large: activeModalCard.imageUrlLarge, small: activeModalCard.imageUrl },
            set: { name: activeModalCard.setName, id: activeModalCard.setId },
            rarity: activeModalCard.rarity,
            tcgplayer: { prices: { normal: { market: activeModalCard.currentPrice } } },
          }}
          ownedCards={cards}
          onAdd={handleCardAdded}
          onRemove={handleModalRemove}
          onClose={() => { setActiveModalCard(null); setModalTcgData(null) }}
          onFilterByArtist={handleModalFilterByArtist}
        />
      )}

      {showExportModal && (
        <ExportModal
          cards={tabCards}
          section={activeTab}
          setDateMap={setDateMap}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showAccount && (
        <AccountModal onClose={() => setShowAccount(false)} />
      )}

      {editingSoldCard && (
        <SoldEditModal
          card={editingSoldCard}
          onClose={() => setEditingSoldCard(null)}
          onSaved={() => { setEditingSoldCard(null); loadCards() }}
        />
      )}

      {showShareModal && (
        <ShareModal
          cards={sorted}
          section={activeTab}
          binderFilter={binderFilter}
          sortBy={sortBy}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {renamingBinder && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setRenamingBinder(false)}
        >
          <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Rename Binder</h2>
              <button onClick={() => setRenamingBinder(false)} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={async (e) => {
                  const trimmed = renameValue.trim()
                  if (e.key === 'Enter' && trimmed && trimmed !== binderFilter) {
                    await window.api.renameBinder(activeTab, binderFilter, trimmed)
                    setBinderFilter(trimmed)
                    await reloadBinders()
                    setRenamingBinder(false)
                  }
                  if (e.key === 'Escape') setRenamingBinder(false)
                }}
                placeholder="New binder name"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={async () => {
                  const trimmed = renameValue.trim()
                  if (!trimmed || trimmed === binderFilter) return
                  await window.api.renameBinder(activeTab, binderFilter, trimmed)
                  setBinderFilter(trimmed)
                  await reloadBinders()
                  setRenamingBinder(false)
                }}
                disabled={!renameValue.trim() || renameValue.trim() === binderFilter}
                className="flex-1 bg-accent hover:bg-amber-400 disabled:opacity-40 text-black font-semibold py-2 rounded-lg text-sm transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => setRenamingBinder(false)}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddBinderModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddBinderModal(false); setNewBinderName(''); setNewBinderError(false) } }}
        >
          <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                New {activeTab === 'collection' ? 'Collection' : 'Watchlist'} Binder
              </h2>
              <button onClick={() => { setShowAddBinderModal(false); setNewBinderName(''); setNewBinderError(false) }} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="p-5 space-y-2">
              <input
                autoFocus
                type="text"
                value={newBinderName}
                onChange={(e) => { setNewBinderName(e.target.value); setNewBinderError(false) }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newBinderName.trim()) {
                    if (availableBinders.some((f) => f.toLowerCase() === newBinderName.trim().toLowerCase())) {
                      setNewBinderError(true)
                      return
                    }
                    await window.api.addBinder(activeTab, newBinderName.trim())
                    await reloadBinders()
                    setBinderFilter(newBinderName.trim())
                    setNewBinderName('')
                    setNewBinderError(false)
                    setShowAddBinderModal(false)
                  }
                  if (e.key === 'Escape') setShowAddBinderModal(false)
                }}
                placeholder="Binder name"
                className={`w-full bg-surface-700 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none ${newBinderError ? 'border-red-500 focus:border-red-500' : 'border-surface-500 focus:border-accent'}`}
              />
              {newBinderError && <p className="text-red-400 text-xs">A binder with this name already exists in this section.</p>}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={async () => {
                  if (!newBinderName.trim()) return
                  if (availableBinders.some((f) => f.toLowerCase() === newBinderName.trim().toLowerCase())) {
                    setNewBinderError(true)
                    return
                  }
                  await window.api.addBinder(activeTab, newBinderName.trim())
                  await reloadBinders()
                  setBinderFilter(newBinderName.trim())
                  setNewBinderName('')
                  setNewBinderError(false)
                  setShowAddBinderModal(false)
                }}
                disabled={!newBinderName.trim()}
                className="flex-1 bg-accent hover:bg-amber-400 disabled:opacity-40 text-black font-semibold py-2 rounded-lg text-sm transition-colors"
              >
                Create Binder
              </button>
              <button
                onClick={() => { setShowAddBinderModal(false); setNewBinderName(''); setNewBinderError(false) }}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AppFooter refreshKey={refreshKey} />

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
    </div>
  )
}
