import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import BinderSelector from './BinderSelector'
import { useCardSearch } from '../hooks/useCardSearch'
import CardSearchInput from './CardSearchInput'

const CONDITIONS = [
  { value: 'raw', label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9', label: 'CGC 9' }
]

export default function CardSearch({ section, onAdd, onClose }) {
  const navigate = useNavigate()
  const {
    query, results, searching, searchCommitted, displayCount, error: searchError,
    handleQueryChange, handleSearch, loadMore,
  } = useCardSearch({ initialPageSize: 40, pageIncrement: 20 })
  const [selected, setSelected] = useState(null)
  const [condition, setCondition] = useState('raw')
  const [binder, setBinder] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [alertPrice, setAlertPrice] = useState('')
  const [addedDate, setAddedDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [variations, setVariations] = useState([])
  const [variationStep, setVariationStep] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState(null)
  const [loadingVariations, setLoadingVariations] = useState(false)

  const inputRef = useRef(null)
  const binderRef = useRef(null)

  const sectionLabel = section === 'collection' ? 'Collection' : 'Watchlist'

  useEffect(() => {
    inputRef.current?.focus()
    window.api.getSettings().then((s) => {
      if (s.defaultCondition) setCondition(s.defaultCondition)
    })
  }, [])

  async function doSearch() {
    setSelected(null)
    setError(null)
    await handleSearch()
  }

  function goToAdvancedSearch() {
    onClose()
    navigate('/', { state: { tab: 'search', searchQuery: query.trim() || undefined } })
  }

  async function selectCardAndCheckVariations(card) {
    if (selected?.id === card.id) {
      setSelected(null); setVariationStep(false); setVariations([]); setSelectedVariation(null)
      return
    }
    setSelected(card); setVariations([]); setSelectedVariation(null); setVariationStep(false)
    setLoadingVariations(true)
    try {
      const vars = await window.api.getCardVariations(card.name, card.number || '', card.set?.name || '')
      if (vars.length > 1) {
        setVariations(vars); setVariationStep(true)
      } else {
        setSelectedVariation(vars[0] || null)
      }
    } catch (e) { console.warn('[CardSearch] getCardVariations failed:', e?.message) }
    setLoadingVariations(false)
  }

  async function handleAddCard() {
    if (!selected) return
    setAdding(true)
    try {
      const effectiveBinder = ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null
      const parsedPrice = purchasePrice !== '' ? parseFloat(purchasePrice) : null
      const newCard = await window.api.addCard(
        {
          ...selected,
          pricechartingId: selectedVariation?.pricecharting_id || null,
          pricechartingName: selectedVariation?.product_name || null,
        },
        condition, 1, section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder,
        addedDate || null
      )
      const targets = {}
      const parsedAlert = alertPrice !== '' ? parseFloat(alertPrice) : null
      if (parsedAlert != null && parsedAlert > 0) {
        targets.alertPrice = Math.round(parsedAlert * 100) / 100
        const history = await window.api.getPriceHistory(newCard.id)
        const latestPrice = history[history.length - 1]?.price
        if (latestPrice != null) {
          targets.alertPct = Math.round((targets.alertPrice - latestPrice) / latestPrice * 1000) / 10
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

          {/* Single search bar */}
          <CardSearchInput
            query={query}
            onChange={handleQueryChange}
            onSearch={doSearch}
            searching={searching}
            disabled={adding}
            inputRef={inputRef}
            rightSlot={
              <button
                onClick={goToAdvancedSearch}
                title="Advanced search — open full search page"
                className="px-2.5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-400 hover:text-white rounded-lg transition-colors flex items-center flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            }
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0"
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
            if (scrollHeight - scrollTop - clientHeight < 150 && displayCount < results.length) {
              loadMore()
            }
          }}
        >
          {searching && (
            <div className="flex items-center justify-center p-10 text-slate-400 text-base">Searching...</div>
          )}
          {searchError && <div className="p-5 text-red-400 text-base text-center">{searchError}</div>}
          {!searching && !searchError && results.length === 0 && searchCommitted && (
            <div className="p-10 text-slate-500 text-base text-center">No cards found</div>
          )}
          {!searching && !searchError && !searchCommitted && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-700 gap-2">
              <svg className="w-10 h-10 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p className="text-sm">Search to find a card</p>
            </div>
          )}
          {searchCommitted && results.slice(0, displayCount).map((card) => {
            if (card._divider) {
              return (
                <div key="__divider__" className="flex items-center gap-3 px-6 py-2 select-none">
                  <div className="flex-1 h-px bg-surface-600" />
                  <span className="text-xs text-slate-500 font-medium">Similar Items</span>
                  <div className="flex-1 h-px bg-surface-600" />
                </div>
              )
            }
            return (
              <button
                key={card.id}
                onClick={() => !adding && !loadingVariations && selectCardAndCheckVariations(card)}
                className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-surface-700 transition-colors text-left ${
                  selected?.id === card.id ? 'bg-surface-700 border-l-2 border-accent' : ''
                }`}
              >
                <div className="w-16 h-[88px] flex-shrink-0">
                  {card.images?.small ? (
                    <img
                      src={card.images.small}
                      alt={card.name}
                      className="w-full h-full object-contain rounded"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}
                    />
                  ) : null}
                  <div style={{ display: card.images?.small ? 'none' : 'flex' }} className="w-full h-full bg-surface-700 rounded flex-col items-center justify-center text-slate-600 gap-0.5">
                    <svg className="w-8 h-10" viewBox="0 0 28 36" fill="none">
                      <rect x="1" y="1" width="26" height="34" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="14" cy="15" r="5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M5 28 Q14 22 23 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[9px]">No image</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-semibold truncate">
                    {card.name}{card.number ? <span className="text-slate-400 font-normal"> #{card.number}</span> : ''}
                  </p>
                  <p className="text-slate-300 text-sm mt-0.5">{[card.set?.series, card.set?.name].filter(Boolean).join(' - ')}</p>
                  {card.rarity && <p className="text-slate-500 text-sm mt-0.5">{card.rarity}</p>}
                </div>
              </button>
            )
          })}
          {searchCommitted && !searching && results.length > displayCount && (
            <p className="text-center text-slate-600 text-xs py-3">Showing {displayCount} of {results.length} — scroll for more</p>
          )}
        </div>

        {/* Selected card + variation picker / add form */}
        {(selected || loadingVariations) && (
          <div className="flex-shrink-0 border-t border-surface-600 bg-surface-900/50 overflow-y-auto">
            {loadingVariations ? (
              <div className="p-6 flex items-center justify-center gap-3 text-slate-400 text-sm">
                <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Looking up variations…
              </div>
            ) : variationStep ? (
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-4 mb-1">
                  <img src={selected?.images?.small} className="w-12 h-[66px] object-contain rounded flex-shrink-0" alt={selected?.name} />
                  <div>
                    <p className="text-white text-base font-semibold">{selected?.name}</p>
                    <p className="text-slate-400 text-sm">{selected?.set?.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-0.5">Which variation?</p>
                  <p className="text-xs text-slate-500 mb-3">Multiple versions found — pick the one you have.</p>
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {variations.map((v) => (
                      <button
                        key={v.pricecharting_id}
                        onClick={() => { setSelectedVariation(v); setVariationStep(false) }}
                        className="w-full text-left px-3 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 hover:border-accent rounded-lg transition-colors"
                      >
                        <p className="text-white text-sm">{v.product_name}</p>
                        <p className="text-slate-500 text-xs">{v.console_name}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => { setSelectedVariation(null); setVariationStep(false) }}
                    className="w-full px-3 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Not sure — skip for now
                  </button>
                  <button
                    onClick={() => { setSelected(null); setVariationStep(false) }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors text-center py-1"
                  >
                    ← Back to results
                  </button>
                </div>
              </div>
            ) : adding ? (
              <div className="p-8 flex flex-col items-center justify-center gap-4">
                <div className="relative w-16 h-16">
                  {selected?.images?.small && (
                    <img src={selected.images.small} alt={selected.name}
                      className="w-12 h-[66px] object-contain rounded absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                  )}
                  <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-base">{selected?.name}</p>
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
                <div className="flex items-center gap-4 mb-4">
                  <img src={selected?.images?.small} className="w-14 h-[78px] object-contain rounded flex-shrink-0" alt={selected?.name} />
                  <div>
                    <p className="text-white text-base font-semibold">{selected?.name}</p>
                    <p className="text-slate-400 text-sm mt-0.5">{selected?.set?.name}</p>
                  </div>
                </div>

                <div className="flex gap-4 mb-4">
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
                  <div className="flex-1">
                    <label className="text-slate-400 text-sm mb-1.5 block">Binder (optional)</label>
                    <BinderSelector ref={binderRef} section={section} value={binder} onChange={setBinder} className="w-full" />
                  </div>
                  <div className="w-44">
                    <label className="text-slate-400 text-sm mb-1.5 block">Added to Collection</label>
                    <input
                      type="date"
                      value={addedDate}
                      onChange={(e) => setAddedDate(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent [color-scheme:dark]"
                    />
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
                <div className="mb-4">
                  <label className="text-accent text-sm mb-1.5 block font-medium">Price Alert (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <button
                  onClick={handleAddCard}
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
