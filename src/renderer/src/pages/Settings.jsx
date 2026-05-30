import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency, CURRENCIES } from '../context/CurrencyContext'

const PCT_OPTIONS = Array.from({ length: 20 }, (_, i) => (i < 10 ? -(10 - i) * 5 : (i - 9) * 5))

const SORT_OPTIONS = [
  { value: 'addedDate',      label: 'Recently Added' },
  { value: 'name',           label: 'Name (A → Z)' },
  { value: 'set_asc',        label: 'Set' },
  { value: 'released_desc',  label: 'Released (Newest First)' },
  { value: 'released_asc',   label: 'Released (Oldest First)' },
  { value: 'price',          label: 'Current Price' },
  { value: 'changeDay',      label: '1D % Change' },
  { value: 'changeWeek',     label: '1W % Change' },
  { value: 'changeMonth',    label: '1M % Change' },
]

const CONDITIONS = [
  { value: 'raw',   label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9',  label: 'PSA 9' },
  { value: 'psa8',  label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9',  label: 'CGC 9' },
]

// Keywords for each settings section — used by the search filter
const SECTION_KEYWORDS = {
  startpage:  ['start', 'page', 'startup', 'landing', 'initial', 'load', 'home', 'collection', 'watchlist', 'pokedex', 'search', 'trade', 'history', 'default page'],
  api:        ['api', 'token', 'pokemon price tracker', 'ppt', 'pricing data', 'key', 'authentication', 'source'],
  currency:   ['currency', 'exchange', 'rate', 'usd', 'cad', 'eur', 'gbp', 'format', 'dollar', 'money'],
  sort:       ['sort', 'order', 'default sort', 'recently added', 'name', 'set', 'portfolio', 'watchlist'],
  condition:  ['condition', 'grade', 'psa', 'cgc', 'raw', 'ungraded', 'default condition', 'graded', 'adding'],
  targets:    ['target', 'buy', 'sell', 'price', 'percentage', 'pct', 'alert', 'default target', 'auto'],
  alerts:     ['alert', 'notification', 'notify', 'buy alert', 'sell alert', 'price alert', 'enable', 'disable'],
  management: ['remove', 'confirm', 'delete', 'management', 'card management', 'portfolio', 'watchlist'],
  refresh:    ['refresh', 'update', 'fetch', 'prices', 'ppt', 'data', 'refresh card'],
  history:    ['history', 'clear', 'reset', 'data', 'historical', 'price history', 'delete history'],
}

const START_PAGE_OPTIONS = [
  { value: 'collection', label: 'Collection' },
  { value: 'watchlist',  label: 'Watchlist' },
  { value: 'trade',      label: 'Trade Analyzer' },
  { value: 'pokedex',    label: 'Pokédex' },
  { value: 'search',     label: 'Search' },
]

export default function Settings({ onBack, onSortChange, onCardDataChanged }) {
  const navigate = useNavigate()
  const { currency, setCurrency } = useCurrency()
  const [pptToken, setPptToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmRemove, setConfirmRemove] = useState(true)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [clearResult, setClearResult] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [defaultBuyPct, setDefaultBuyPct] = useState('')
  const [defaultSellPct, setDefaultSellPct] = useState('')
  const [defaultCondition, setDefaultCondition] = useState('')
  const [defaultSortBy, setDefaultSortBy] = useState('')
  const [targetApplyMsg, setTargetApplyMsg] = useState('')
  const [clearBuyMsg, setClearBuyMsg] = useState('')
  const [clearSellMsg, setClearSellMsg] = useState('')
  const [alertBuyEnabled, setAlertBuyEnabled] = useState(true)
  const [alertSellEnabled, setAlertSellEnabled] = useState(true)
  const [refreshSection, setRefreshSection] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)
  const [settingsSearch, setSettingsSearch] = useState('')
  const [defaultStartTab, setDefaultStartTab] = useState('collection')
  const [portfolioFolders, setPortfolioFolders] = useState([])
  const [watchlistFolders, setWatchlistFolders] = useState([])
  const [newPortfolioFolder, setNewPortfolioFolder] = useState('')
  const [newWatchlistFolder, setNewWatchlistFolder] = useState('')
  const [newPortfolioFolderError, setNewPortfolioFolderError] = useState(false)
  const [newWatchlistFolderError, setNewWatchlistFolderError] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setPptToken(s.pptToken || '')
      if (s.confirmRemove !== undefined) setConfirmRemove(s.confirmRemove)
      setDefaultBuyPct(s.defaultTargetBuyPct != null ? String(s.defaultTargetBuyPct) : '')
      setDefaultSellPct(s.defaultTargetSellPct != null ? String(s.defaultTargetSellPct) : '')
      setDefaultCondition(s.defaultCondition || '')
      setDefaultSortBy(s.defaultSortBy || '')
      setAlertBuyEnabled(s.alertBuyEnabled !== false)
      setAlertSellEnabled(s.alertSellEnabled !== false)
      if (s.defaultStartTab) setDefaultStartTab(s.defaultStartTab)
      setLoading(false)
    })
    window.api.listBinders('collection').then(setPortfolioFolders).catch(() => {})
    window.api.listBinders('watchlist').then(setWatchlistFolders).catch(() => {})
  }, [])

  // Returns true if the section's keywords match the current search query
  function shows(sectionId) {
    const q = settingsSearch.trim().toLowerCase()
    if (!q) return true
    return SECTION_KEYWORDS[sectionId].some((k) => k.includes(q))
  }

  const anyVisible = Object.keys(SECTION_KEYWORDS).some((id) => shows(id))

  async function handleRefreshData() {
    setIsRefreshing(true)
    setRefreshResult(null)
    await window.api.refreshPrices(null, refreshSection)
    setRefreshResult('Prices updated successfully.')
    setIsRefreshing(false)
    setTimeout(() => setRefreshResult(null), 4000)
  }

  async function handleClearHistory() {
    setClearingHistory(true)
    const result = await window.api.clearPriceHistory()
    setClearResult(result.cleared)
    setClearingHistory(false)
    setConfirmClear(false)
    setTimeout(() => setClearResult(null), 4000)
  }

  async function handleToggleConfirmRemove() {
    const newVal = !confirmRemove
    setConfirmRemove(newVal)
    await window.api.setSettings({ confirmRemove: newVal })
  }

  async function handleSave(e) {
    e.preventDefault()
    await window.api.setSettings({
      pptToken: pptToken.trim()
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDefaultBuyPct(e) {
    const val = e.target.value
    setDefaultBuyPct(val)
    await window.api.setSettings({ defaultTargetBuyPct: val !== '' ? parseFloat(val) : null })
    if (val !== '') {
      const { updated } = await window.api.applyDefaultTargets({ buyPct: parseFloat(val), sellPct: null, force: true })
      if (updated > 0) {
        setTargetApplyMsg(`Applied to ${updated} card${updated !== 1 ? 's' : ''}.`)
        setTimeout(() => setTargetApplyMsg(''), 4000)
        onCardDataChanged?.()
      }
    }
  }

  async function handleDefaultSellPct(e) {
    const val = e.target.value
    setDefaultSellPct(val)
    await window.api.setSettings({ defaultTargetSellPct: val !== '' ? parseFloat(val) : null })
    if (val !== '') {
      const { updated } = await window.api.applyDefaultTargets({ buyPct: null, sellPct: parseFloat(val), force: true })
      if (updated > 0) {
        setTargetApplyMsg(`Applied to ${updated} card${updated !== 1 ? 's' : ''}.`)
        setTimeout(() => setTargetApplyMsg(''), 4000)
        onCardDataChanged?.()
      }
    }
  }

  async function handleClearAllBuy() {
    const { cleared } = await window.api.clearAllTargets('targetBuyPrice')
    setClearBuyMsg(`Cleared target buy price for ${cleared} card${cleared !== 1 ? 's' : ''}.`)
    setTimeout(() => setClearBuyMsg(''), 4000)
    if (cleared > 0) onCardDataChanged?.()
  }

  async function handleClearAllSell() {
    const { cleared } = await window.api.clearAllTargets('targetSellPrice')
    setClearSellMsg(`Cleared target sell price for ${cleared} card${cleared !== 1 ? 's' : ''}.`)
    setTimeout(() => setClearSellMsg(''), 4000)
    if (cleared > 0) onCardDataChanged?.()
  }

  async function handleToggleAlertBuy() {
    const newVal = !alertBuyEnabled
    setAlertBuyEnabled(newVal)
    await window.api.setSettings({ alertBuyEnabled: newVal })
  }

  async function handleToggleAlertSell() {
    const newVal = !alertSellEnabled
    setAlertSellEnabled(newVal)
    await window.api.setSettings({ alertSellEnabled: newVal })
  }

  async function handleDefaultSortBy(e) {
    const val = e.target.value
    setDefaultSortBy(val)
    await window.api.setSettings({ defaultSortBy: val || null })
    if (onSortChange) onSortChange(val || 'addedDate')
  }

  async function handleDefaultCondition(e) {
    const val = e.target.value
    setDefaultCondition(val)
    await window.api.setSettings({ defaultCondition: val || null })
  }

  async function handleDefaultStartTab(e) {
    const val = e.target.value
    setDefaultStartTab(val)
    await window.api.setSettings({ defaultStartTab: val })
  }

  function goBack() {
    if (onBack) onBack()
    else navigate('/')
  }

  if (loading) return null

  return (
    <div className="py-4 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-xl mb-1">Settings</h1>
            <p className="text-slate-500 text-sm">Configure your pricing data source.</p>
          </div>
          <button
            onClick={goBack}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
        </div>

        {/* Settings search bar */}
        <div className="relative mb-5">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            value={settingsSearch}
            onChange={(e) => setSettingsSearch(e.target.value)}
            placeholder="Search settings…"
            className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
          />
          {settingsSearch && (
            <button
              onClick={() => setSettingsSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {/* No results */}
        {settingsSearch.trim() && !anyVisible && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No settings found for <span className="text-white">"{settingsSearch}"</span></p>
            <button onClick={() => setSettingsSearch('')} className="text-accent text-xs mt-2 hover:underline">Clear search</button>
          </div>
        )}

        {/* Default Start Page */}
        {shows('startpage') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Default Start Page</h2>
            <p className="text-slate-500 text-xs mb-3">
              Choose which page is shown when the app opens.
            </p>
            <select
              value={defaultStartTab}
              onChange={handleDefaultStartTab}
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              {START_PAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Pokemon Price Tracker API */}
        {shows('api') && (
          <form onSubmit={handleSave} className="mb-4">
            <div className="bg-surface-800 border border-surface-600 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-white font-semibold text-sm mb-1">Pokemon Price Tracker API</h2>
                <p className="text-slate-500 text-xs mb-3">
                  All pricing data is sourced from pokemonpricetracker.com. Enter your API token below.
                  You can find your token in your Pokemon Price Tracker account settings.
                </p>
                <label className="text-slate-400 text-xs block mb-1.5">API Token</label>
                <input
                  type="text"
                  value={pptToken}
                  onChange={(e) => setPptToken(e.target.value)}
                  placeholder="Your Pokemon Price Tracker Bearer token"
                  className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-accent"
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-black text-sm font-semibold rounded-lg transition-colors"
                >
                  Save
                </button>
                {saved && <span className="text-emerald-400 text-sm">Saved</span>}
              </div>
            </div>
          </form>
        )}

        {/* Currency */}
        {shows('currency') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Currency</h2>
            <p className="text-slate-500 text-xs mb-3">Select the currency used to display all prices throughout the app. Exchange rates are fetched live on startup.</p>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Default Sort Order */}
        {shows('sort') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Default Sort Order</h2>
            <p className="text-slate-500 text-xs mb-3">
              Cards on the Collection and Watchlist pages will be sorted by this option when the app loads.
            </p>
            <select
              value={defaultSortBy}
              onChange={handleDefaultSortBy}
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="">Recently Added (default)</option>
              {SORT_OPTIONS.filter((o) => o.value !== 'addedDate').map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Default Card Condition */}
        {shows('condition') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Default Card Condition</h2>
            <p className="text-slate-500 text-xs mb-3">
              Pre-select this condition when adding a card to your watchlist or portfolio.
            </p>
            <select
              value={defaultCondition}
              onChange={handleDefaultCondition}
              className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="">No default (Raw)</option>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Default Target Prices */}
        {shows('targets') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Default Target Prices</h2>
            <p className="text-slate-500 text-xs mb-4">
              Automatically set target buy and sell prices when a card is added, based on a percent change from its current price. Changing a value here will also apply it to any existing cards that have no target set for that field.
            </p>
            {targetApplyMsg && <p className="text-emerald-400 text-xs mb-3">{targetApplyMsg}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-emerald-500 text-xs font-medium block mb-1.5">Default Buy Price Alert %</label>
                <select
                  value={defaultBuyPct}
                  onChange={handleDefaultBuyPct}
                  className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {PCT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p > 0 ? `+${p}%` : `${p}%`}</option>
                  ))}
                </select>
                {clearBuyMsg
                  ? <p className="text-emerald-400 text-xs mt-2">{clearBuyMsg}</p>
                  : (
                    <button
                      onClick={handleClearAllBuy}
                      className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors underline"
                    >
                      Clear all target buy prices
                    </button>
                  )
                }
              </div>
              <div>
                <label className="text-red-400 text-xs font-medium block mb-1.5">Default Sell Price Alert %</label>
                <select
                  value={defaultSellPct}
                  onChange={handleDefaultSellPct}
                  className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">None</option>
                  {PCT_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p > 0 ? `+${p}%` : `${p}%`}</option>
                  ))}
                </select>
                {clearSellMsg
                  ? <p className="text-emerald-400 text-xs mt-2">{clearSellMsg}</p>
                  : (
                    <button
                      onClick={handleClearAllSell}
                      className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors underline"
                    >
                      Clear all target sell prices
                    </button>
                  )
                }
              </div>
            </div>
          </div>
        )}

        {/* Alert Notifications */}
        {shows('alerts') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Alert Notifications</h2>
            <p className="text-slate-500 text-xs mb-4">
              Choose which types of price alerts appear in the notification panel. Disabling a type hides those alerts from the bell icon.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Buy price alerts</p>
                  <p className="text-slate-500 text-xs mt-0.5">Notify when a card's price is at or below your buy target.</p>
                </div>
                <button
                  onClick={handleToggleAlertBuy}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${alertBuyEnabled ? 'bg-emerald-600' : 'bg-surface-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertBuyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-300 text-sm font-medium">Sell price alerts</p>
                  <p className="text-slate-500 text-xs mt-0.5">Notify when a card's price is at or above your sell target.</p>
                </div>
                <button
                  onClick={handleToggleAlertSell}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${alertSellEnabled ? 'bg-red-600' : 'bg-surface-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertSellEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card Management */}
        {shows('management') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Card Management</h2>
            <p className="text-slate-500 text-xs mb-4">Options for managing your portfolio and watchlist.</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-medium">Confirm before removing cards</p>
                <p className="text-slate-500 text-xs mt-0.5">Show a confirmation popup when removing a card from your portfolio or watchlist.</p>
              </div>
              <button
                onClick={handleToggleConfirmRemove}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${confirmRemove ? 'bg-accent' : 'bg-surface-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${confirmRemove ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Refresh Card Data */}
        {shows('refresh') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Refresh Card Data</h2>
            <p className="text-slate-500 text-xs mb-4">
              Fetch the latest prices from Pokemon Price Tracker for your cards. Choose which section to refresh, or refresh all cards at once.
            </p>
            {refreshResult && <p className="text-emerald-400 text-sm mb-3">{refreshResult}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={refreshSection}
                onChange={(e) => setRefreshSection(e.target.value)}
                disabled={isRefreshing}
                className="bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent disabled:opacity-50"
              >
                <option value="all">All Cards</option>
                <option value="portfolio">Collection Only</option>
                <option value="watchlist">Watchlist Only</option>
              </select>
              <button
                onClick={handleRefreshData}
                disabled={isRefreshing}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 disabled:opacity-50 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh Now'}
              </button>
            </div>
          </div>
        )}

        {/* Binder Management */}
        <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
          <h2 className="text-white font-semibold text-sm mb-1">Binders</h2>
          <p className="text-slate-500 text-xs mb-4">
            Create binders to organize cards within your Collection and Watchlist.
          </p>
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Collection', section: 'collection', folders: portfolioFolders, setFolders: setPortfolioFolders, newVal: newPortfolioFolder, setNew: setNewPortfolioFolder, dupError: newPortfolioFolderError, setDupError: setNewPortfolioFolderError },
              { label: 'Watchlist', section: 'watchlist', folders: watchlistFolders, setFolders: setWatchlistFolders, newVal: newWatchlistFolder, setNew: setNewWatchlistFolder, dupError: newWatchlistFolderError, setDupError: setNewWatchlistFolderError },
            ].map(({ label, section, folders, setFolders, newVal, setNew, dupError, setDupError }) => (
              <div key={section}>
                <p className="text-slate-400 text-xs font-medium mb-2">{label} binders</p>
                <div className="space-y-1.5 mb-3">
                  {folders.length === 0 && (
                    <p className="text-slate-600 text-xs">No binders yet</p>
                  )}
                  {folders.map((f) => (
                    <div key={f} className="flex items-center justify-between bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5">
                      <span className="text-white text-sm">{f}</span>
                      <button
                        onClick={async () => {
                          await window.api.deleteBinder(section, f)
                          setFolders((prev) => prev.filter((x) => x !== f))
                        }}
                        className="text-slate-600 hover:text-red-400 text-xs transition-colors ml-2"
                        title="Delete binder"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <input
                      value={newVal}
                      onChange={(e) => { setNew(e.target.value); setDupError(false) }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newVal.trim()) {
                          const name = newVal.trim()
                          if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) { setDupError(true); return }
                          await window.api.addBinder(section, name)
                          setFolders((prev) => [...prev, name].sort())
                          setNew('')
                          setDupError(false)
                        }
                      }}
                      placeholder="New binder name…"
                      className={`flex-1 bg-surface-700 border rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none ${dupError ? 'border-red-500 focus:border-red-500' : 'border-surface-500 focus:border-accent'}`}
                    />
                    <button
                      onClick={async () => {
                        const name = newVal.trim()
                        if (!name) return
                        if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) { setDupError(true); return }
                        await window.api.addBinder(section, name)
                        setFolders((prev) => [...prev, name].sort())
                        setNew('')
                        setDupError(false)
                      }}
                      disabled={!newVal.trim()}
                      className="px-3 py-1.5 bg-accent disabled:opacity-40 text-black text-sm font-semibold rounded-lg transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {dupError && <p className="text-red-400 text-xs">A binder with this name already exists in this section.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price History */}
        {shows('history') && (
          <div className="mb-4 bg-surface-800 border border-surface-600 rounded-xl p-5">
            <h2 className="text-white font-semibold text-sm mb-1">Price History</h2>
            <p className="text-slate-500 text-xs mb-4">
              Clear historical price data for all cards, keeping only today's prices. Use this if your pricing data was captured with an incorrect API key.
            </p>
            {clearResult != null && (
              <p className="text-emerald-400 text-sm mb-3">Cleared history for {clearResult} card{clearResult !== 1 ? 's' : ''}.</p>
            )}
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Clear Historical Prices
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Remove all price history before today?</span>
                <button
                  onClick={handleClearHistory}
                  disabled={clearingHistory}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {clearingHistory ? 'Clearing…' : 'Yes, clear it'}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 bg-surface-600 hover:bg-surface-500 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
