import { useState, useEffect, useRef, useCallback } from 'react'
import BinderSelector from './BinderSelector'

const CONDITIONS = [
  { value: 'raw', label: 'Raw (Ungraded)' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9', label: 'CGC 9' }
]

export default function CardSearch({ section, onAdd, onClose }) {
  const [searchMode, setSearchMode] = useState('cards') // 'cards' | 'sealed'

  // Cards state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchCommitted, setSearchCommitted] = useState(false)
  const [selected, setSelected] = useState(null)
  const [condition, setCondition] = useState('raw')

  // Sealed state
  const [sealedQuery, setSealedQuery] = useState('')
  const [sealedResults, setSealedResults] = useState([])
  const [sealedLoading, setSealedLoading] = useState(false)
  const [sealedSelected, setSealedSelected] = useState(null)

  // Shared add-form state
  const [binder, setBinder] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [targetBuyPrice, setTargetBuyPrice] = useState('')
  const [targetSellPrice, setTargetSellPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)

  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const binderRef = useRef(null)

  const sectionLabel = section === 'collection' ? 'Collection' : 'Watchlist'

  useEffect(() => {
    inputRef.current?.focus()
    window.api.getSettings().then((s) => {
      if (s.defaultCondition) setCondition(s.defaultCondition)
    })
  }, [])

  // Cards silent background pre-fetch — results are stored but not displayed until committed
  useEffect(() => {
    if (searchMode !== 'cards') return
    if (!query.trim()) { setBgResults([]); setBgQuery(''); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const q = query.trim()
      setBgLoading(true)
      try {
        const cards = await window.api.searchCards(q)
        setBgResults(cards.slice(0, 20))
        setBgQuery(q)
      } catch {
        setBgResults([])
        setBgQuery(q)
      } finally {
        setBgLoading(false)
      }
    }, 400)
  }, [query, searchMode])

  async function runCardSearch() {
    const q = query.trim()
    if (!q) return
    setSelected(null)
    setError(null)
    setSearchCommitted(true)

    // Background already fetched this exact query — show immediately
    if (!bgLoading && bgQuery === q) {
      setResults(bgResults)
      return
    }

    // Background hasn't caught up yet — fetch directly
    setSearching(true)
    try {
      const cards = await window.api.searchCards(q)
      const sliced = cards.slice(0, 20)
      setResults(sliced)
      setBgResults(sliced)
      setBgQuery(q)
    } catch {
      setError('Search failed. Check your internet connection.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function runSealedSearch() {
    if (!sealedQuery.trim()) return
    setSealedLoading(true)
    setSealedResults([])
    setError(null)
    try {
      const { products, error: err } = await window.api.searchSealed(sealedQuery.trim())
      if (err === 'no_token') setError('PriceCharting API token required — add it in Settings.')
      else setSealedResults(products || [])
    } catch {
      setError('Sealed product search failed.')
    } finally {
      setSealedLoading(false)
    }
  }

  async function handleAddCard() {
    if (!selected) return
    setAdding(true)
    try {
      const effectiveBinder = ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null
      const parsedPrice = purchasePrice !== '' ? parseFloat(purchasePrice) : null
      const newCard = await window.api.addCard(selected, condition, 1, section, parsedPrice && parsedPrice > 0 ? parsedPrice : null, effectiveBinder)

      const targets = {}
      const parsedBuy = targetBuyPrice !== '' ? parseFloat(targetBuyPrice) : null
      const parsedSell = targetSellPrice !== '' ? parseFloat(targetSellPrice) : null
      if (parsedBuy != null && parsedBuy > 0) targets.targetBuyPrice = Math.round(parsedBuy * 100) / 100
      if (parsedSell != null && parsedSell > 0) targets.targetSellPrice = Math.round(parsedSell * 100) / 100

      if (newCard?.id && (!targets.targetBuyPrice || !targets.targetSellPrice)) {
        const settings = await window.api.getSettings()
        const history = await window.api.getPriceHistory(newCard.id)
        const latestPrice = history[history.length - 1]?.price
        if (latestPrice != null) {
          if (!targets.targetBuyPrice && settings.defaultTargetBuyPct != null) {
            targets.targetBuyPrice = Math.round(latestPrice * (1 + settings.defaultTargetBuyPct / 100) * 100) / 100
          }
          if (!targets.targetSellPrice && settings.defaultTargetSellPct != null) {
            targets.targetSellPrice = Math.round(latestPrice * (1 + settings.defaultTargetSellPct / 100) * 100) / 100
          }
        }
      }

      if (Object.keys(targets).length > 0 && newCard?.id) {
        await window.api.updateCard(newCard.id, targets)
      }
      onAdd()
      onClose()
    } catch {
      setError('Failed to add card.')
      setAdding(false)
    }
  }

  async function handleAddSealed() {
    if (!sealedSelected) return
    setAdding(true)
    try {
      const effectiveBinder = ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null
      const parsedPrice = purchasePrice !== '' ? parseFloat(purchasePrice) : null
      const newItem = await window.api.addSealedProduct(
        sealedSelected, section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder
      )
      const targets = {}
      const parsedBuy = targetBuyPrice !== '' ? parseFloat(targetBuyPrice) : null
      const parsedSell = targetSellPrice !== '' ? parseFloat(targetSellPrice) : null
      if (parsedBuy != null && parsedBuy > 0) targets.targetBuyPrice = Math.round(parsedBuy * 100) / 100
      if (parsedSell != null && parsedSell > 0) targets.targetSellPrice = Math.round(parsedSell * 100) / 100
      if (Object.keys(targets).length > 0 && newItem?.id) {
        await window.api.updateCard(newItem.id, targets)
      }
      onAdd()
      onClose()
    } catch {
      setError('Failed to add product.')
      setAdding(false)
    }
  }

  function switchMode(mode) {
    setSearchMode(mode)
    setSelected(null)
    setSealedSelected(null)
    setError(null)
    setPurchasePrice('')
    setTargetBuyPrice('')
    setTargetSellPrice('')
    setResults([])
    setBgResults([])
    setBgQuery('')
    setSearchCommitted(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const activeItem = searchMode === 'cards' ? selected : sealedSelected

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !adding && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && !adding && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[88vh] overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-surface-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Add Item</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Adding to{' '}
                <span className={section === 'collection' ? 'text-accent' : 'text-sky-400'}>
                  {sectionLabel}
                </span>
              </p>
            </div>
            <button onClick={onClose} disabled={adding} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center disabled:opacity-30">✕</button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-0.5 bg-surface-900 border border-surface-600 rounded-lg p-0.5 w-fit mb-4">
            <button
              onClick={() => switchMode('cards')}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${searchMode === 'cards' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Cards
            </button>
            <button
              onClick={() => switchMode('sealed')}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition-colors ${searchMode === 'sealed' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Sealed Products
            </button>
          </div>

          {/* Search input */}
          {searchMode === 'cards' && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchCommitted(false) }}
                onKeyDown={(e) => e.key === 'Enter' && runCardSearch()}
                disabled={adding}
                placeholder="Search by name (e.g. Charizard) or number (e.g. 4/102)..."
                className="flex-1 bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={runCardSearch}
                disabled={searching || !query.trim() || adding}
                className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
          )}
          {searchMode === 'sealed' && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={sealedQuery}
                onChange={(e) => setSealedQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSealedSearch()}
                disabled={adding}
                placeholder="Search sealed products (e.g. Ascended Heroes Elite Trainer Box)..."
                className="flex-1 bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 text-base text-white placeholder-slate-500 focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                onClick={runSealedSearch}
                disabled={sealedLoading || !sealedQuery.trim() || adding}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                {sealedLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {(searching || sealedLoading) && (
            <div className="flex items-center justify-center p-10 text-slate-400 text-base">Searching...</div>
          )}
          {error && <div className="p-5 text-red-400 text-base text-center">{error}</div>}

          {/* Cards results */}
          {searchMode === 'cards' && !searching && results.length === 0 && searchCommitted && !error && (
            <div className="p-10 text-slate-500 text-base text-center">No cards found</div>
          )}
          {searchMode === 'cards' && searchCommitted && results.map((card) => (
            <button
              key={card.id}
              onClick={() => !adding && setSelected(selected?.id === card.id ? null : card)}
              className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-700 transition-colors text-left ${
                selected?.id === card.id ? 'bg-surface-700 border-l-2 border-accent' : ''
              }`}
            >
              <img
                src={card.images?.small}
                alt={card.name}
                className="w-16 h-[88px] object-contain rounded flex-shrink-0"
                onError={(e) => (e.target.style.display = 'none')}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-base font-semibold truncate">{card.name}</p>
                <p className="text-slate-300 text-sm mt-0.5">{card.set?.name}</p>
                <p className="text-slate-500 text-sm mt-0.5">#{card.number} · {card.rarity}</p>
              </div>
            </button>
          ))}

          {/* Sealed results */}
          {searchMode === 'sealed' && !sealedLoading && sealedResults.length === 0 && sealedQuery.trim() && !error && (
            <div className="p-10 text-slate-500 text-base text-center">No sealed products found</div>
          )}
          {searchMode === 'sealed' && !sealedLoading && sealedResults.length === 0 && !sealedQuery.trim() && !error && (
            <div className="flex flex-col items-center justify-center p-10 text-slate-600 gap-2">
              <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-base">Search for ETBs, booster boxes, and more</p>
              <p className="text-sm text-slate-700">Requires PriceCharting API token (set in Settings)</p>
            </div>
          )}
          {searchMode === 'sealed' && sealedResults.map((product) => {
            const name = product['product-name'] || product.name || 'Unknown'
            const category = product['console-name'] || 'Sealed Product'
            return (
              <button
                key={product.id}
                onClick={() => !adding && setSealedSelected(sealedSelected?.id === product.id ? null : product)}
                className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-700 transition-colors text-left ${
                  sealedSelected?.id === product.id ? 'bg-surface-700 border-l-2 border-accent' : ''
                }`}
              >
                <div className="w-16 h-[88px] flex-shrink-0 bg-surface-700 rounded overflow-hidden relative flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-500 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  {product.image && (
                    <img
                      src={product.image}
                      alt={name}
                      className="w-full h-full object-contain relative z-10"
                      onError={(e) => e.target.remove()}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-semibold truncate">{name}</p>
                  <p className="text-slate-400 text-sm mt-0.5">{category}</p>
                  {product['loose-price'] && (
                    <p className="text-accent text-sm mt-0.5 font-medium">${(product['loose-price'] / 100).toFixed(2)}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected item + add controls */}
        {activeItem && (
          <div className="flex-shrink-0 border-t border-surface-600 bg-surface-900/50 overflow-y-auto">
            {adding ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="relative w-16 h-16">
                  {searchMode === 'cards' && selected?.images?.small && (
                    <img src={selected.images.small} alt={selected.name}
                      className="w-12 h-[66px] object-contain rounded absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                  )}
                  <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-base">
                    {searchMode === 'cards' ? selected?.name : (sealedSelected?.['product-name'] || sealedSelected?.name)}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">Fetching current price data…</p>
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {/* Selected item preview */}
                <div className="flex items-center gap-4 mb-4">
                  {searchMode === 'cards' ? (
                    <img src={selected?.images?.small} className="w-14 h-[78px] object-contain rounded flex-shrink-0" alt={selected?.name} />
                  ) : (
                    <div className="w-14 h-[78px] flex-shrink-0 bg-surface-700 rounded overflow-hidden relative flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-500 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {sealedSelected?.image && (
                        <img
                          src={sealedSelected.image}
                          alt={sealedSelected?.['product-name']}
                          className="w-full h-full object-contain relative z-10"
                          onError={(e) => e.target.remove()}
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-white text-base font-semibold">
                      {searchMode === 'cards' ? selected?.name : (sealedSelected?.['product-name'] || sealedSelected?.name)}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {searchMode === 'cards' ? selected?.set?.name : (sealedSelected?.['console-name'] || 'Sealed Product')}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 mb-4">
                  {searchMode === 'cards' && (
                    <div className="flex-1">
                      <label className="text-slate-400 text-sm mb-1.5 block">Condition</label>
                      <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="text-slate-400 text-sm mb-1.5 block">Binder (optional)</label>
                    <BinderSelector ref={binderRef} section={section} value={binder} onChange={setBinder} className="w-full" />
                  </div>
                  {section === 'collection' && (
                    <div className="w-40">
                      <label className="text-slate-400 text-sm mb-1.5 block">Price Paid (optional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                        <input
                          type="number" min="0.01" step="0.01"
                          value={purchasePrice}
                          onChange={(e) => setPurchasePrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-emerald-500 text-sm mb-1.5 block font-medium">Buy Price Alert (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={targetBuyPrice}
                        onChange={(e) => setTargetBuyPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-red-400 text-sm mb-1.5 block font-medium">Sell Price Alert (optional)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                      <input
                        type="number" min="0.01" step="0.01"
                        value={targetSellPrice}
                        onChange={(e) => setTargetSellPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={searchMode === 'cards' ? handleAddCard : handleAddSealed}
                  className={`w-full text-black font-bold py-3 rounded-lg text-base transition-colors ${
                    section === 'collection' ? 'bg-accent hover:bg-accent-hover' : 'bg-sky-500 hover:bg-sky-400'
                  }`}
                >
                  Add to {sectionLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
