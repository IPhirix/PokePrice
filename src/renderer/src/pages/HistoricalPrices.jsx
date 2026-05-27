import { useState, useEffect } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import PriceChart from '../components/PriceChart'

const CONDITION_LABEL = {
  raw: 'Ungraded', psa10: 'PSA 10', psa9: 'PSA 9',
  psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9',
}
const CONDITION_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}

function SourceBadge({ source }) {
  if (source === 'pricecharting')
    return <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded font-medium">PC</span>
  if (source === 'manual')
    return <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded font-medium">Manual</span>
  if (source === 'ebay')
    return <span className="text-xs px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 rounded font-medium">eBay</span>
  return <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-500 rounded">{source || '—'}</span>
}

function CardListItem({ card, selected, onClick, format }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-surface-700 transition-colors last:border-b-0 ${
        selected ? 'bg-surface-600' : 'hover:bg-surface-700/50'
      }`}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="w-7 h-10 object-contain rounded flex-shrink-0" />
      ) : (
        <div className="w-7 h-10 bg-surface-700 rounded flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate leading-tight">{card.name}</p>
        <p className="text-xs text-slate-500 truncate">{card.setName}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${CONDITION_COLOR[card.condition] || 'bg-slate-700 text-slate-300'}`}>
          {CONDITION_LABEL[card.condition] || card.condition}
        </span>
        {card.currentPrice != null && (
          <span className="text-xs text-slate-400">{format(card.currentPrice)}</span>
        )}
      </div>
    </button>
  )
}

function SoldCardListItem({ card, selected, onClick, format }) {
  const pl = card.soldInfo?.salePrice != null && card.purchasePrice != null
    ? card.soldInfo.salePrice - card.purchasePrice : null
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-surface-700 transition-colors last:border-b-0 ${
        selected ? 'bg-surface-600' : 'hover:bg-surface-700/50'
      }`}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.name} className="w-7 h-10 object-contain rounded flex-shrink-0" />
      ) : (
        <div className="w-7 h-10 bg-surface-700 rounded flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate leading-tight">{card.name}</p>
        <p className="text-xs text-slate-500 truncate">{card.setName}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${card.soldInfo?.isTrade ? 'bg-sky-900/50 text-sky-300' : 'bg-emerald-900/50 text-emerald-400'}`}>
          {card.soldInfo?.isTrade ? 'Trade' : 'Sold'}
        </span>
        {pl != null && (
          <span className={`text-xs font-medium tabular-nums ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pl >= 0 ? '+' : '−'}{format(Math.abs(pl))}
          </span>
        )}
      </div>
    </button>
  )
}

export default function HistoricalPrices() {
  const { format } = useCurrency()
  const [cards, setCards] = useState([])
  const [soldCards, setSoldCards] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [history, setHistory] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingDate, setEditingDate] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [chartRange, setChartRange] = useState(90)
  const [collapsedPortfolio, setCollapsedPortfolio] = useState(false)
  const [collapsedWatchlist, setCollapsedWatchlist] = useState(false)
  const [collapsedSold, setCollapsedSold] = useState(false)

  useEffect(() => {
    window.api.listCards().then(setCards)
    window.api.listSoldCards().then(setSoldCards)
  }, [])

  const allCards = [...cards, ...soldCards]
  const selectedCard = allCards.find((c) => c.id === selectedId) || null
  const isSoldCard = selectedCard?.section === 'sold'

  async function handleSelectCard(id) {
    if (id === selectedId) return
    setSelectedId(id)
    setEditingDate(null)
    setEditPrice('')
    setConfirmDeleteDate(null)
    setShowAddForm(false)
    const h = await window.api.getPriceHistory(id)
    setHistory(h)
  }

  async function reloadHistory() {
    if (!selectedId) return
    const h = await window.api.getPriceHistory(selectedId)
    setHistory(h)
  }

  async function handleSaveEdit() {
    const parsed = parseFloat(editPrice)
    if (isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    await window.api.updateHistoryEntry(selectedId, editingDate, parsed)
    await reloadHistory()
    setEditingDate(null)
    setEditPrice('')
    setSaving(false)
  }

  async function handleDelete(date) {
    setSaving(true)
    await window.api.deleteHistoryEntry(selectedId, date)
    await reloadHistory()
    setConfirmDeleteDate(null)
    setSaving(false)
  }

  async function handleAddEntry() {
    const parsed = parseFloat(newPrice)
    if (!newDate || isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    await window.api.updateHistoryEntry(selectedId, newDate, parsed)
    await reloadHistory()
    setShowAddForm(false)
    setNewDate('')
    setNewPrice('')
    setSaving(false)
  }

  const filtered = cards.filter((c) => {
    const q = searchQuery.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.setName || '').toLowerCase().includes(q)
  })
  const filteredSold = soldCards.filter((c) => {
    const q = searchQuery.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.setName || '').toLowerCase().includes(q)
  })
  const portfolioCards = filtered.filter((c) => c.section === 'collection')
  const watchlistCards = filtered.filter((c) => (c.section || 'watchlist') === 'watchlist')

  // Enrich history with day-over-day change (history is chronological asc)
  const enriched = history.map((entry, i) => {
    const prev = history[i - 1]
    const dollar = prev != null ? entry.price - prev.price : null
    const pct = prev != null && prev.price > 0 ? ((entry.price - prev.price) / prev.price) * 100 : null
    return { ...entry, dollar, pct }
  })
  const displayRows = [...enriched].reverse() // newest first

  const latestPrice = history.length > 0 ? history[history.length - 1].price : null

  return (
    <div className="h-full flex gap-3 overflow-hidden">

      {/* Left: Card list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 min-h-0">

        {/* Search */}
        <div className="flex-shrink-0 bg-surface-800 border border-surface-600 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cards…"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
          )}
        </div>

        {/* Card list */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-surface-800 border border-surface-600 rounded-xl">
          {portfolioCards.length > 0 && (
            <>
              <button
                onClick={() => setCollapsedPortfolio((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-accent uppercase tracking-widest border-b border-surface-700 sticky top-0 bg-surface-800 z-10 hover:bg-surface-700/50 transition-colors"
              >
                <span>Collection · {portfolioCards.length}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${collapsedPortfolio ? '-rotate-90' : ''}`}
                  viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {!collapsedPortfolio && portfolioCards.map((card) => (
                <CardListItem
                  key={card.id}
                  card={card}
                  selected={selectedId === card.id}
                  onClick={() => handleSelectCard(card.id)}
                  format={format}
                />
              ))}
            </>
          )}
          {watchlistCards.length > 0 && (
            <>
              <button
                onClick={() => setCollapsedWatchlist((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-sky-400 uppercase tracking-widest border-b border-surface-700 sticky top-0 bg-surface-800 z-10 hover:bg-surface-700/50 transition-colors"
              >
                <span>Watchlist · {watchlistCards.length}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${collapsedWatchlist ? '-rotate-90' : ''}`}
                  viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {!collapsedWatchlist && watchlistCards.map((card) => (
                <CardListItem
                  key={card.id}
                  card={card}
                  selected={selectedId === card.id}
                  onClick={() => handleSelectCard(card.id)}
                  format={format}
                />
              ))}
            </>
          )}
          {filteredSold.length > 0 && (
            <>
              <button
                onClick={() => setCollapsedSold((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-emerald-400 uppercase tracking-widest border-b border-surface-700 sticky top-0 bg-surface-800 z-10 hover:bg-surface-700/50 transition-colors"
              >
                <span>Sold / Traded · {filteredSold.length}</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${collapsedSold ? '-rotate-90' : ''}`}
                  viewBox="0 0 12 12" fill="none"
                >
                  <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {!collapsedSold && filteredSold.map((card) => (
                <SoldCardListItem
                  key={card.id}
                  card={card}
                  selected={selectedId === card.id}
                  onClick={() => handleSelectCard(card.id)}
                  format={format}
                />
              ))}
            </>
          )}
          {portfolioCards.length === 0 && watchlistCards.length === 0 && filteredSold.length === 0 && (
            <p className="text-slate-600 text-sm text-center py-10">No cards found</p>
          )}
        </div>

      </div>

      {/* Right: History panel */}
      <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">

        {!selectedCard ? (
          <div className="flex-1 bg-surface-800 border border-surface-600 rounded-xl flex flex-col items-center justify-center gap-3 text-center">
            <svg className="w-12 h-12 text-surface-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <p className="text-slate-400 font-medium">Select a card to view its price history</p>
              <p className="text-slate-600 text-sm mt-1">All daily price records are shown here and can be edited</p>
            </div>
          </div>
        ) : (
          <>
            {/* Card header + mini chart */}
            <div className="flex-shrink-0 bg-surface-800 border border-surface-600 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-4">
                {(selectedCard.imageUrl || selectedCard.imageUrlLarge) && (
                  <img
                    src={selectedCard.imageUrl || selectedCard.imageUrlLarge}
                    alt={selectedCard.name}
                    className="w-10 h-14 object-contain rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-white font-bold text-lg leading-tight">{selectedCard.name}</h2>
                    {selectedCard.number && <span className="text-slate-500 text-sm">#{selectedCard.number}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CONDITION_COLOR[selectedCard.condition] || 'bg-slate-700 text-slate-300'}`}>
                      {CONDITION_LABEL[selectedCard.condition] || selectedCard.condition}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isSoldCard
                        ? (selectedCard.soldInfo?.isTrade ? 'bg-sky-900/30 text-sky-400' : 'bg-emerald-900/30 text-emerald-400')
                        : selectedCard.section === 'collection'
                        ? 'bg-amber-900/30 text-accent'
                        : 'bg-sky-900/30 text-sky-400'
                    }`}>
                      {isSoldCard ? (selectedCard.soldInfo?.isTrade ? 'Traded' : 'Sold') : selectedCard.section === 'collection' ? 'Collection' : 'Watchlist'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{selectedCard.setName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-slate-500 text-xs mb-0.5">Latest Price</p>
                  <p className="text-accent font-bold text-2xl leading-tight">
                    {latestPrice != null ? format(latestPrice) : '—'}
                  </p>
                  <p className="text-slate-600 text-xs mt-0.5">{history.length} {history.length === 1 ? 'entry' : 'entries'}</p>
                </div>
              </div>
              <div className="h-44">
                <PriceChart history={history} range={chartRange} onRangeChange={setChartRange} />
              </div>
            </div>

            {/* Sale / Trade record — sold cards only */}
            {isSoldCard && selectedCard.soldInfo && (
              <div className="flex-shrink-0 bg-surface-800 border border-surface-600 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  {selectedCard.soldInfo.isTrade ? 'Trade Record' : 'Sale Record'}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">{selectedCard.soldInfo.isTrade ? 'Traded On' : 'Sold For'}</p>
                    <p className="text-white font-bold text-xl leading-tight">{format(selectedCard.soldInfo.salePrice)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Date</p>
                    <p className="text-slate-300 text-sm font-medium">{selectedCard.soldInfo.saleDate || '—'}</p>
                    {selectedCard.purchasePrice != null && (
                      <p className="text-slate-600 text-xs mt-0.5">Paid {format(selectedCard.purchasePrice)}</p>
                    )}
                  </div>
                  {selectedCard.purchasePrice != null && (() => {
                    const pl = selectedCard.soldInfo.salePrice - selectedCard.purchasePrice
                    const roi = selectedCard.purchasePrice > 0 ? (pl / selectedCard.purchasePrice) * 100 : null
                    return (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">Realized P&L</p>
                        <p className={`font-bold text-xl leading-tight ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pl >= 0 ? '+' : '−'}{format(Math.abs(pl))}
                        </p>
                        {roi != null && (
                          <p className={`text-xs mt-0.5 ${roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% ROI
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {selectedCard.soldInfo.isTrade && selectedCard.soldInfo.tradeCardsReceived?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-surface-700">
                    <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Cards Received</p>
                    <div className="space-y-1.5">
                      {selectedCard.soldInfo.tradeCardsReceived.map((tc, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 text-sm">{tc.name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${CONDITION_COLOR[tc.condition] || 'bg-slate-700 text-slate-300'}`}>
                              {CONDITION_LABEL[tc.condition] || tc.condition}
                            </span>
                          </div>
                          {tc.estimatedValue && parseFloat(tc.estimatedValue) > 0 && (
                            <span className="text-slate-400 text-xs tabular-nums">{format(parseFloat(tc.estimatedValue))}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History table */}
            <div className="flex-1 min-h-0 bg-surface-800 border border-surface-600 rounded-xl flex flex-col overflow-hidden">

              {/* Table header bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 flex-shrink-0">
                <h3 className="text-sm font-medium text-slate-300">Price History</h3>
                {!isSoldCard && (
                  <button
                    onClick={() => {
                      setShowAddForm((v) => !v)
                      setNewDate(new Date().toISOString().split('T')[0])
                      setNewPrice('')
                    }}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-black text-xs font-semibold rounded-lg transition-colors"
                  >
                    + Add Entry
                  </button>
                )}
              </div>

              {/* Add entry inline form */}
              {showAddForm && !isSoldCard && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-900/60 border-b border-surface-700 flex-shrink-0 flex-wrap">
                  <span className="text-slate-400 text-xs font-medium">New Entry</span>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
                  />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntry() }}
                      placeholder="0.00"
                      className="bg-surface-700 border border-surface-500 rounded pl-7 pr-3 py-1.5 text-sm text-white w-32 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    onClick={handleAddEntry}
                    disabled={saving || !newDate || !newPrice}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black text-xs font-semibold rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-900 z-10">
                    <tr className="border-b border-surface-700">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 w-36">Date</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Day Δ$</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">Day Δ%</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 w-24">Source</th>
                      {!isSoldCard && <th className="px-4 py-2.5 w-28"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row) => {
                      const isEditing = editingDate === row.date
                      const isConfirmingDelete = confirmDeleteDate === row.date

                      if (isEditing) {
                        return (
                          <tr key={row.date} className="bg-accent/5 border-b border-surface-700">
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{row.date}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex justify-end">
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                                  <input
                                    autoFocus
                                    type="number" min="0.01" step="0.01"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit()
                                      if (e.key === 'Escape') { setEditingDate(null); setEditPrice('') }
                                    }}
                                    className="bg-surface-700 border border-accent rounded pl-6 pr-2 py-1 text-sm text-white w-28 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </td>
                            <td colSpan={2} className="px-4 py-2.5">
                              <div className="flex items-center gap-2 justify-center">
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={saving}
                                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-black text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => { setEditingDate(null); setEditPrice('') }}
                                  className="px-3 py-1 bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <SourceBadge source="manual" />
                            </td>
                            {!isSoldCard && <td />}
                          </tr>
                        )
                      }

                      return (
                        <tr key={row.date} className="border-b border-surface-700 hover:bg-surface-700/20 group last:border-b-0">
                          <td className="px-4 py-2.5 text-slate-400 text-xs tabular-nums">{row.date}</td>
                          <td className="px-4 py-2.5 text-right text-white font-medium tabular-nums">{format(row.price)}</td>
                          <td className={`px-4 py-2.5 text-right text-xs font-medium tabular-nums ${
                            row.dollar == null ? 'text-slate-600'
                            : row.dollar >= 0 ? 'text-emerald-500' : 'text-red-400'
                          }`}>
                            {row.dollar == null
                              ? '—'
                              : `${row.dollar >= 0 ? '+' : '−'}${format(Math.abs(row.dollar))}`}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-xs font-medium tabular-nums ${
                            row.pct == null ? 'text-slate-600'
                            : row.pct >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {row.pct == null
                              ? '—'
                              : `${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(2)}%`}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <SourceBadge source={row.source} />
                          </td>
                          {!isSoldCard && (
                            <td className="px-4 py-2.5">
                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-xs text-slate-400">Delete?</span>
                                  <button
                                    onClick={() => handleDelete(row.date)}
                                    disabled={saving}
                                    className="px-2 py-0.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteDate(null)}
                                    className="px-2 py-0.5 bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs rounded transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setEditingDate(row.date)
                                      setEditPrice(String(row.price))
                                      setConfirmDeleteDate(null)
                                    }}
                                    className="p-1.5 rounded hover:bg-surface-600 text-slate-500 hover:text-slate-200 transition-colors"
                                    title="Edit price"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                      <path d="M9.5 1.5l2 2L4 11l-2.5.5.5-2.5L9.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmDeleteDate(row.date)
                                      setEditingDate(null)
                                      setEditPrice('')
                                    }}
                                    className="p-1.5 rounded hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Delete entry"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                      <path d="M2 3.5h9M5 3.5V2h3v1.5M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    {displayRows.length === 0 && (
                      <tr>
                        <td colSpan={isSoldCard ? 5 : 6} className="px-4 py-16 text-center text-slate-600">
                          No price history recorded for this card yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </>
        )}
      </div>

    </div>
  )
}
