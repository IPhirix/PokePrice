import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { useCardSearch } from '../hooks/useCardSearch'
import CardSearchInput from '../components/CardSearchInput'

const CONDITIONS = [
  { value: 'raw',   label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9',  label: 'PSA 9' },
  { value: 'psa8',  label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9',  label: 'CGC 9' },
]
const COND_SHORT = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }

function cleanVariationLabel(productName, cardName, cardNumber) {
  if (!productName) return ''
  let label = productName
  label = label.replace(/^Pokemon\s+/i, '')
  if (cardName) label = label.replace(new RegExp('^' + cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '')
  if (cardNumber) label = label.replace(new RegExp('^#?' + String(cardNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[/\\s]*', 'i'), '')
  return label.trim()
}

function tcgPrice(card) {
  return card.cardmarket?.prices?.averageSellPrice
    ?? card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null
}

function tradeLabel(youTotal, themTotal) {
  const diff = youTotal - themTotal
  if (Math.abs(diff) < 0.005) return 'Fair Trade'
  return diff > 0 ? 'You gave more' : 'They gave more'
}

function TradeVerdict({ youTotal, themTotal, small = false }) {
  const diff = youTotal - themTotal
  const isFair = Math.abs(diff) < 0.005
  const color = isFair ? 'bg-emerald-500' : diff > 0 ? 'bg-orange-500' : 'bg-sky-500'
  const label = tradeLabel(youTotal, themTotal)
  return (
    <span className={`inline-flex items-center gap-1 ${small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} rounded-full font-semibold text-black ${color}`}>
      {label}
    </span>
  )
}

// ── Tilt card ─────────────────────────────────────────────────────────────────
function TiltCard({ src, alt, onClick, imgClassName = 'w-28 h-[156px]' }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x: 0.5, y: 0.5 })
  const [hovering, setHovering] = useState(false)

  function handleMouseMove(e) {
    const rect = ref.current.getBoundingClientRect()
    setTilt({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
  }

  const rx = hovering ? -(tilt.y - 0.5) * 22 : 0
  const ry = hovering ? (tilt.x - 0.5) * 22 : 0

  return (
    <div
      ref={ref}
      className="relative cursor-pointer select-none flex-shrink-0"
      style={{ perspective: '700px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setTilt({ x: 0.5, y: 0.5 }) }}
      onClick={onClick}
      title="Click to inspect"
    >
      <div style={{
        transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${hovering ? 1.06 : 1})`,
        transition: hovering ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <img src={src} alt={alt} className={`${imgClassName} object-contain block`} />
        {hovering && (
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at ${tilt.x * 100}% ${tilt.y * 100}%, rgba(255,255,255,0.28) 0%, transparent 65%)` }}
          />
        )}
      </div>
    </div>
  )
}

// ── Card search + price-picker modal ──────────────────────────────────────────
function TradeCardSearch({ side, onAdd, onClose }) {
  const { format } = useCurrency()
  const navigate = useNavigate()
  const {
    query, results, searching: loading, searchCommitted: hasSearched, displayCount,
    handleQueryChange, handleSearch, loadMore, clearSearch,
  } = useCardSearch({ initialPageSize: 24, pageIncrement: 24 })
  const [selected, setSelected] = useState(null)
  const [variations, setVariations] = useState([])
  const [variationStep, setVariationStep] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState(null)
  const [loadingVariations, setLoadingVariations] = useState(false)
  const [condition, setCondition] = useState('raw')
  const [customPrice, setCustomPrice] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [collectionCards, setCollectionCards] = useState([])
  const [collectionLoading, setCollectionLoading] = useState(true)

  useEffect(() => {
    window.api.listCards()
      .then((cards) => setCollectionCards(cards.filter((c) => c.section === 'collection')))
      .catch(() => {})
      .finally(() => setCollectionLoading(false))
  }, [])

  function goToAdvancedSearch() {
    onClose()
    navigate('/', { state: { tab: 'search' } })
  }

  function handleSelectCollection(collCard) {
    const normalized = {
      id: collCard.tcgId || collCard.id,
      name: collCard.name,
      number: collCard.number,
      set: { name: collCard.setName },
      images: { small: collCard.imageUrl, large: collCard.imageUrlLarge || collCard.imageUrl },
      _suggestedPrice: collCard.currentPrice,
      _purchasePrice: collCard.purchasePrice,
      _collectionId: collCard.id,
    }
    setSelected(normalized)
    setVariations([])
    setSelectedVariation(null)
    setVariationStep(false)
    setLoadingVariations(false)
    setCondition(collCard.condition || 'raw')
    setCustomPrice(collCard.currentPrice != null ? String(collCard.currentPrice) : '')
  }

  async function selectCardAndCheckVariations(card) {
    setSelected(card)
    const p = tcgPrice(card)
    setCustomPrice(p != null ? String(p) : '')
    setVariations([])
    setSelectedVariation(null)
    setVariationStep(false)
    setLoadingVariations(true)
    try {
      const vars = await window.api.getCardVariations(card.name, card.number || '', card.set?.name || '')
      if (vars.length > 1) {
        setVariations(vars)
        setVariationStep(true)
      } else {
        setSelectedVariation(vars[0] || null)
      }
    } catch (e) { console.warn('[TradeAnalyzer] getCardVariations failed:', e?.message) }
    setLoadingVariations(false)
  }

  function handleAdd() {
    if (!selected) return
    const price = parseFloat(customPrice)
    onAdd({
      uid: `${selected.id}-${Date.now()}`,
      tcgId: selected.id,
      name: selected.name,
      number: selected.number,
      setName: selected.set?.name,
      seriesName: selected.set?.series || null,
      imageUrl: selected.images?.small,
      condition,
      price: isNaN(price) || price < 0 ? 0 : Math.round(price * 100) / 100,
      collectionId: selected._collectionId || null,
      pricechartingId: selectedVariation?.pricecharting_id || null,
      pricechartingName: selectedVariation?.product_name || null,
    })
    onClose()
  }

  const suggested = selected ? (selected._suggestedPrice ?? tcgPrice(selected)) : null

  if (selected) {
    return (
      <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
            <button onClick={() => { setSelected(null); setVariations([]); setSelectedVariation(null); setVariationStep(false) }}
              className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-base font-semibold text-white">Add to {side === 'you' ? 'Your' : 'Their'} Side</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
          </div>

          {loadingVariations ? (
            <div className="p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
              <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Looking up variations…
            </div>
          ) : variationStep ? (
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-4 mb-1">
                {selected?.images?.small && (
                  <img src={selected.images.small} className="w-12 h-[66px] object-contain rounded flex-shrink-0" alt={selected.name} />
                )}
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
                      className="w-full text-left px-3 py-2.5 bg-surface-800 hover:bg-surface-700 border border-surface-600 hover:border-yellow-400/50 rounded-lg transition-colors"
                    >
                      <p className="text-white text-sm">{v.product_name}</p>
                      <p className="text-slate-500 text-xs">{v.console_name}</p>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setSelectedVariation(null); setVariationStep(false) }}
                className="w-full px-3 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-300 text-sm rounded-lg transition-colors"
              >
                Not sure — skip for now
              </button>
            </div>
          ) : (
            <>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-5">
                {selected.images?.small && (
                  <TiltCard
                    src={selected.images.small}
                    alt={selected.name}
                    onClick={() => setInspecting(true)}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white font-bold text-xl">
                    {selected.name}{selected.number ? <span className="text-slate-400 font-normal"> #{selected.number}</span> : ''}
                  </p>
                  {selectedVariation && (
                    <p className="text-slate-300 text-sm mt-0.5">
                      {cleanVariationLabel(selectedVariation.product_name, selected.name, selected.number)}
                    </p>
                  )}
                  <p className="text-slate-400 text-sm mt-0.5">
                    {[selected.set?.series, selected.set?.name].filter(Boolean).join(' - ')}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1.5">Condition</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400">
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-sm block mb-1.5">
                  Price
                  {suggested != null && <span className="text-slate-500 ml-2 text-xs">Market: {format(suggested)}</span>}
                  {selected._purchasePrice != null && <span className="text-slate-500 ml-2 text-xs">· Paid: {format(selected._purchasePrice)}</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
                  <input autoFocus type="number" min="0" step="0.01"
                    value={customPrice} onChange={(e) => setCustomPrice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                    placeholder="0.00"
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={handleAdd}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
                Add Card
              </button>
            </div>
            </>
          )}
        </div>
      </div>

      {inspecting && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]"
          onClick={() => setInspecting(false)}>
          <TiltCard
            src={selected.images?.large || selected.images?.small}
            alt={selected.name}
            imgClassName="max-h-[80vh] w-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Add Card — {side === 'you' ? 'You' : 'Them'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="px-5 py-3 flex-shrink-0">
          <CardSearchInput
            query={query}
            onChange={handleQueryChange}
            onSearch={handleSearch}
            searching={loading}
            autoFocus
            inputClassName={loading ? 'border-yellow-400/60' : 'focus:border-yellow-400'}
            rightSlot={
              <button onClick={goToAdvancedSearch} title="Advanced search — open full search page"
                className="px-2.5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 hover:border-surface-400 text-slate-400 hover:text-white text-sm rounded-lg transition-colors flex items-center flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            }
          />
          {loading && (
            <div className="mt-2.5 h-0.5 rounded-full bg-surface-600 overflow-hidden">
              <div className="h-full bg-yellow-400 rounded-full"
                style={{ width: '40%', animation: 'progressBar 1.4s ease-in-out infinite' }} />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0"
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
            if (scrollHeight - scrollTop - clientHeight < 150 && displayCount < results.length) {
              loadMore()
            }
          }}
        >
          {/* TCG search results */}
          {hasSearched && (
            <>
              <div className="flex items-center gap-2 mb-2 pt-1">
                <button onClick={clearSearch}
                  className="flex items-center gap-1 text-slate-400 hover:text-white text-xs transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  My Collection
                </button>
                <span className="text-slate-700 text-xs">·</span>
                <span className="text-slate-500 text-xs">TCG search results</span>
              </div>
              {loading && (
                <div className="space-y-1 pt-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-3 rounded-lg animate-pulse">
                      <div className="w-16 h-[90px] bg-surface-700 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-2.5">
                        <div className="h-4 bg-surface-700 rounded w-3/4" />
                        <div className="h-3 bg-surface-700 rounded w-1/2" />
                      </div>
                      <div className="w-14 h-4 bg-surface-700 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                  <svg className="w-10 h-10 mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium">No cards found</p>
                  <p className="text-xs mt-1 text-slate-700">Try a different name or spelling</p>
                </div>
              )}
              {!loading && results.slice(0, displayCount).map((card) => {
                if (card._divider) {
                  return (
                    <div key="__divider__" className="flex items-center gap-3 px-3 py-2 select-none">
                      <div className="flex-1 h-px bg-surface-600" />
                      <span className="text-xs text-slate-500 font-medium">Similar Items</span>
                      <div className="flex-1 h-px bg-surface-600" />
                    </div>
                  )
                }
                const price = tcgPrice(card)
                return (
                  <button key={card.id} onClick={() => selectCardAndCheckVariations(card)}
                    className="w-full flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-surface-700 transition-colors text-left mb-1">
                    <div className="w-16 h-[90px] flex-shrink-0">
                      {card.images?.small ? (
                        <img src={card.images.small} alt={card.name}
                          className="w-full h-full object-contain rounded" />
                      ) : (
                        <div className="w-full h-full bg-surface-700 rounded flex flex-col items-center justify-center text-slate-600 gap-0.5">
                          <svg className="w-8 h-10" viewBox="0 0 28 36" fill="none">
                            <rect x="1" y="1" width="26" height="34" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                            <circle cx="14" cy="15" r="5" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M5 28 Q14 22 23 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span className="text-[9px]">No image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-semibold truncate">
                        {card.name}{card.number ? <span className="text-slate-400 font-normal"> #{card.number}</span> : ''}
                      </p>
                      <p className="text-slate-400 text-sm truncate mt-0.5">
                        {[card.set?.series, card.set?.name].filter(Boolean).join(' - ')}{card.rarity ? ` · ${card.rarity}` : ''}
                      </p>
                    </div>
                    {price != null
                      ? <span className="text-yellow-300 text-base font-semibold flex-shrink-0">{format(price)}</span>
                      : <span className="text-slate-600 text-base flex-shrink-0">—</span>
                    }
                  </button>
                )
              })}
              {!loading && results.length > displayCount && (
                <p className="text-center text-slate-600 text-xs py-3">Showing {displayCount} of {results.length} — scroll for more</p>
              )}
            </>
          )}

          {/* Default: collection */}
          {!hasSearched && (
            <>
              <div className="flex items-center justify-between mb-2 pt-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Collection</p>
                <p className="text-xs text-slate-600">{collectionCards.length} card{collectionCards.length !== 1 ? 's' : ''}</p>
              </div>
              {collectionLoading && (
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-3 rounded-lg animate-pulse">
                      <div className="w-16 h-[90px] bg-surface-700 rounded flex-shrink-0" />
                      <div className="flex-1 space-y-2.5">
                        <div className="h-4 bg-surface-700 rounded w-3/4" />
                        <div className="h-3 bg-surface-700 rounded w-1/2" />
                      </div>
                      <div className="w-14 h-4 bg-surface-700 rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              {!collectionLoading && collectionCards.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                  <svg className="w-10 h-10 mb-2 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm font-medium">No cards in your collection</p>
                  <p className="text-xs mt-1">Search the TCG database above to add any card</p>
                </div>
              )}
              {!collectionLoading && collectionCards.map((card) => (
                <button key={card.id} onClick={() => handleSelectCollection(card)}
                  className="w-full flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-surface-700 transition-colors text-left mb-1">
                  {card.imageUrl
                    ? <img src={card.imageUrl} alt={card.name}
                        className="w-16 h-[90px] object-contain rounded flex-shrink-0" />
                    : <div className="w-16 h-[90px] bg-surface-600 rounded flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-semibold truncate">{card.name}</p>
                    <p className="text-slate-400 text-sm truncate mt-0.5">
                      {card.setName}{card.number ? ` · #${card.number}` : ''}
                    </p>
                    <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-surface-600 text-slate-400">
                      {COND_SHORT[card.condition] || card.condition}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {card.currentPrice != null
                      ? <p className="text-yellow-300 text-base font-semibold">{format(card.currentPrice)}</p>
                      : <p className="text-slate-600 text-base">—</p>
                    }
                    {card.purchasePrice != null && (
                      <p className="text-slate-500 text-xs mt-0.5">Paid {format(card.purchasePrice)}</p>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Cash modal ────────────────────────────────────────────────────────────────
function CashModal({ side, current, onSave, onClose }) {
  const [value, setValue] = useState(current > 0 ? String(current) : '')

  function handleSave() {
    const parsed = parseFloat(value)
    onSave(isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100) / 100)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-xs mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Cash — {side === 'you' ? 'You' : 'Them'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5">
          <label className="text-slate-400 text-sm block mb-1.5">Cash amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
            <input autoFocus type="number" min="0" step="0.01"
              value={value} onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
              placeholder="0.00"
              className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleSave}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
            Set Cash
          </button>
          {current > 0 && (
            <button onClick={() => { onSave(0); onClose() }}
              className="px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 border border-red-700/50 text-red-400 text-sm rounded-lg transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Side panel ────────────────────────────────────────────────────────────────
function SidePanel({ side, label, onRename, cards, cash, total, onAddCard, onAddCash, onRemoveCard }) {
  const { format } = useCurrency()
  const isYou = side === 'you'
  const displayLabel = label || (isYou ? 'You' : 'Them')
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  function startEdit() {
    setEditValue(label || '')
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    if (onRename) onRename(editValue.trim())
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-800 border border-surface-700 rounded-xl min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-surface-700">
        <div className="flex items-center justify-between">
          {!isYou && editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              placeholder="Their name…"
              className="font-bold text-2xl text-white bg-transparent border-b border-yellow-400 outline-none w-40 placeholder-slate-600"
            />
          ) : (
            <div className="flex items-center gap-2 group/name">
              {!isYou ? (
                <button onClick={startEdit}
                  className="font-bold text-2xl text-white hover:text-yellow-200 transition-colors text-left"
                  title="Click to rename">
                  {displayLabel}
                </button>
              ) : (
                <h3 className="font-bold text-2xl text-white">{displayLabel}</h3>
              )}
              {!isYou && (
                <svg className="w-4 h-4 text-slate-600 opacity-0 group-hover/name:opacity-100 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                </svg>
              )}
            </div>
          )}
          <span className="font-bold text-2xl text-white">{format(total)}</span>
        </div>
        <p className="text-slate-500 text-xs mt-0.5">
          {cards.length} card{cards.length !== 1 ? 's' : ''} · {format(cash)} cash
        </p>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-2">
        {cards.length === 0 && cash === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-700">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm font-medium text-slate-600">No items yet</p>
            <p className="text-xs mt-1">Add cards or cash below</p>
          </div>
        ) : (
          <>
            {cards.map((card) => (
              <div key={card.uid}
                className="flex items-center gap-3 bg-surface-700/50 hover:bg-surface-700 rounded-xl px-3 py-2.5 group transition-colors">
                {card.imageUrl
                  ? <img src={card.imageUrl} alt={card.name}
                      className="w-14 h-[78px] object-contain rounded flex-shrink-0" />
                  : <div className="w-14 h-[78px] bg-surface-600 rounded flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-semibold leading-snug truncate">
                    {card.name}{card.number ? <span className="text-slate-400 font-normal"> #{card.number}</span> : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <p className="text-slate-400 text-sm">
                      {card.pricechartingName
                        ? `${cleanVariationLabel(card.pricechartingName, card.name, card.number)} - ${COND_SHORT[card.condition] || card.condition}`
                        : (COND_SHORT[card.condition] || card.condition)
                      }
                    </p>
                    {card.collectionId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex-shrink-0">My Collection</span>
                    )}
                  </div>
                  {card.setName && (
                    <p className="text-slate-500 text-sm truncate">
                      {[card.seriesName, card.setName].filter(Boolean).join(' - ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-base font-bold">{format(card.price)}</p>
                </div>
                <button onClick={() => onRemoveCard(card.uid)}
                  className="text-slate-600 hover:text-red-400 text-lg leading-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all ml-0.5">
                  ✕
                </button>
              </div>
            ))}
            {cash > 0 && (
              <div className="flex items-center gap-3 bg-surface-700/50 rounded-xl px-3 py-2.5">
                <div className="w-14 h-[78px] flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white text-base font-semibold">Cash</p>
                </div>
                <p className="text-emerald-400 text-base font-bold">{format(cash)}</p>
                <button onClick={onAddCash}
                  className="text-slate-500 hover:text-slate-300 text-xs ml-1 flex-shrink-0 transition-colors">
                  Edit
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 flex gap-2 border-t border-surface-700">
        <button onClick={onAddCard}
          className="flex-1 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 hover:text-yellow-200 text-sm font-medium py-2.5 rounded-lg transition-colors">
          + Add Items
        </button>
        <button onClick={onAddCash}
          className="flex-1 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-600/40 text-emerald-400 hover:text-emerald-300 text-sm font-medium py-2.5 rounded-lg transition-colors">
          + Add Cash
        </button>
      </div>
    </div>
  )
}

// ── Make Trade confirmation modal ─────────────────────────────────────────────
function MakeTradeModal({ youCards, themCards, youCash, themCash, youTotal, themTotal, themName, error, onConfirm, onClose }) {
  const { format } = useCurrency()
  const [executing, setExecuting] = useState(false)
  const collectionRemovals = youCards.filter((c) => c.collectionId)
  const collectionAdditions = themCards

  async function handleConfirm() {
    setExecuting(true)
    await onConfirm()
    setExecuting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Confirm Trade</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {collectionRemovals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Removed from your collection</p>
              <div className="space-y-1">
                {collectionRemovals.map((c) => (
                  <div key={c.uid} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 truncate">{c.name} <span className="text-slate-500">({COND_SHORT[c.condition] || c.condition})</span></span>
                    <span className="text-red-400 font-medium ml-3 flex-shrink-0">−{format(c.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {collectionAdditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Added to your collection</p>
              <div className="space-y-1">
                {collectionAdditions.map((c) => (
                  <div key={c.uid} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 truncate">{c.name} <span className="text-slate-500">({COND_SHORT[c.condition] || c.condition})</span></span>
                    <span className="text-emerald-400 font-medium ml-3 flex-shrink-0">+{format(c.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {youCash > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Cash you paid</span>
              <span className="text-red-400 font-medium">−{format(youCash)}</span>
            </div>
          )}
          {themCash > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Cash you received</span>
              <span className="text-emerald-400 font-medium">+{format(themCash)}</span>
            </div>
          )}
          <div className="border-t border-surface-600 pt-3 flex items-center justify-between">
            <span className="text-slate-400 text-sm">Net result</span>
            <span className={`font-bold text-lg ${themTotal >= youTotal ? 'text-emerald-400' : 'text-orange-400'}`}>
              {themTotal >= youTotal ? '+' : '−'}{format(Math.abs(themTotal - youTotal))}
            </span>
          </div>
          {collectionRemovals.length === 0 && collectionAdditions.length === 0 && youCash === 0 && themCash === 0 && (
            <p className="text-slate-500 text-sm text-center py-2">No collection changes to apply.</p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={executing}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
            {executing ? 'Executing…' : 'Execute Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Undo trade confirmation modal ─────────────────────────────────────────────
function UndoTradeModal({ trade, onConfirm, onClose }) {
  const [undoing, setUndoing] = useState(false)
  const [error, setError] = useState(null)

  const restoreCount = trade.removedCardsData?.length ?? (trade.youCards || []).filter((c) => c.collectionId).length
  const receivedCount = trade.addedCardIds?.length ?? trade.themCards?.length ?? 0
  const hasTrackedIds = Array.isArray(trade.addedCardIds)
  const hasFullSnapshot = Array.isArray(trade.removedCardsData)

  async function handleConfirm() {
    setUndoing(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.')
      setUndoing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Undo Trade?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-slate-400 text-sm">
            This will reverse the executed trade
            {trade.themName ? <> with <span className="text-white font-medium">{trade.themName}</span></> : ''}:
          </p>
          <div className="bg-surface-700/60 rounded-xl px-4 py-3 space-y-2">
            {restoreCount > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 font-bold w-4 text-center flex-shrink-0">+</span>
                <span className="text-slate-300">
                  {restoreCount} card{restoreCount !== 1 ? 's' : ''} restored to your collection
                  {hasFullSnapshot && (
                    <span className="block text-xs text-slate-500 mt-0.5">Purchase price, binder, alerts &amp; price history included</span>
                  )}
                </span>
              </div>
            )}
            {receivedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-red-400 font-bold w-4 text-center">−</span>
                <span className="text-slate-300">
                  {receivedCount} received card{receivedCount !== 1 ? 's' : ''} removed from your collection
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-400 font-bold w-4 text-center">·</span>
              <span className="text-slate-300">Trade reverted to draft — no longer counted in P&amp;L</span>
            </div>
          </div>
          {(!hasTrackedIds || !hasFullSnapshot) && (restoreCount > 0 || receivedCount > 0) && (
            <p className="text-xs text-slate-500 bg-surface-700 rounded-lg px-3 py-2">
              {!hasTrackedIds
                ? 'This trade was executed before automatic card tracking was added. Received cards may need to be removed from your collection manually.'
                : 'This trade was executed before full data snapshots were added. Restored cards may be missing purchase price, binder, alerts, and price history.'}
            </p>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={undoing}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-colors">
            {undoing ? 'Undoing…' : 'Undo Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Trade export ──────────────────────────────────────────────────────────────
function buildTradeExportRows(trades) {
  const header = ['Date', 'Trading With', 'Your Total ($)', 'Your Cards', 'Your Cash ($)', 'Their Total ($)', 'Their Cards', 'Their Cash ($)', 'Difference ($)', 'Verdict']
  const rows = [header]
  for (const trade of trades) {
    const date = new Date(trade.savedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const youCardList = (trade.youCards || []).map((c) => `${c.name} (${COND_SHORT[c.condition] || c.condition})`).join('; ')
    const themCardList = (trade.themCards || []).map((c) => `${c.name} (${COND_SHORT[c.condition] || c.condition})`).join('; ')
    const diff = (trade.themTotal ?? 0) - (trade.youTotal ?? 0)
    rows.push([
      date,
      trade.themName || 'Them',
      (trade.youTotal ?? 0).toFixed(2),
      youCardList,
      (trade.youCash ?? 0).toFixed(2),
      (trade.themTotal ?? 0).toFixed(2),
      themCardList,
      (trade.themCash ?? 0).toFixed(2),
      diff.toFixed(2),
      tradeLabel(trade.youTotal ?? 0, trade.themTotal ?? 0),
    ])
  }
  return rows
}

function verdictColor(youTotal, themTotal) {
  const diff = youTotal - themTotal
  if (Math.abs(diff) < 0.005) return 'text-emerald-400'
  return diff > 0 ? 'text-orange-400' : 'text-sky-400'
}

function Checkbox({ checked, indeterminate = false, onChange }) {
  return (
    <div
      onClick={onChange}
      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
        checked || indeterminate ? 'bg-accent border-accent' : 'border-surface-400 bg-surface-700 hover:border-slate-300'
      }`}
    >
      {indeterminate && !checked ? (
        <span className="block w-2 h-0.5 bg-black rounded-full" />
      ) : checked ? (
        <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  )
}

function TradeExportModal({ trades, onClose }) {
  const [format, setFormat] = useState('csv')
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState(() => new Set(trades.map((t) => t.id)))
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const allSelected = selected.size === trades.length
  const noneSelected = selected.size === 0

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(trades.map((t) => t.id)))
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleExport() {
    setExporting(true)
    const toExport = trades.filter((t) => selected.has(t.id))
    const rows = buildTradeExportRows(toExport)
    await window.api.exportCards({ rows, format, section: 'trades' })
    setExporting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[80vh] overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-surface-600 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Export Trades</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              {selected.size} of {trades.length} trade{trades.length !== 1 ? 's' : ''} selected · {date}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Table preview */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-600">
                  <th className="pb-2 pr-3 w-8">
                    <Checkbox checked={allSelected} indeterminate={!noneSelected && !allSelected} onChange={toggleAll} />
                  </th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Date</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Trading With</th>
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Your Total</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Your Cards</th>
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Your Cash</th>
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Their Total</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Their Cards</th>
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Their Cash</th>
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Difference</th>
                  <th className="text-left text-slate-400 font-medium pb-2 whitespace-nowrap">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => {
                  const isSelected = selected.has(trade.id)
                  const d = new Date(trade.savedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  const youCards = (trade.youCards || []).map((c) => `${c.name} (${COND_SHORT[c.condition] || c.condition})`).join('; ')
                  const themCards = (trade.themCards || []).map((c) => `${c.name} (${COND_SHORT[c.condition] || c.condition})`).join('; ')
                  const youTotal = trade.youTotal ?? 0
                  const themTotal = trade.themTotal ?? 0
                  const diff = themTotal - youTotal
                  const verdict = tradeLabel(youTotal, themTotal)
                  const vColor = verdictColor(youTotal, themTotal)
                  return (
                    <tr
                      key={trade.id}
                      onClick={() => toggleOne(trade.id)}
                      className={`border-b border-surface-700/50 cursor-pointer transition-colors ${isSelected ? 'bg-accent/5 hover:bg-accent/10' : 'opacity-40 hover:opacity-60 hover:bg-surface-700/30'}`}
                    >
                      <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onChange={() => toggleOne(trade.id)} />
                      </td>
                      <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{d}</td>
                      <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{trade.themName || 'Them'}</td>
                      <td className="py-2 pr-4 text-right text-yellow-300 font-medium whitespace-nowrap">${youTotal.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-slate-400 max-w-[200px]">
                        <span className="block truncate" title={youCards}>{youCards || '—'}</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-300 whitespace-nowrap">
                        {(trade.youCash ?? 0) > 0 ? `$${(trade.youCash).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-300 font-medium whitespace-nowrap">${themTotal.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-slate-400 max-w-[200px]">
                        <span className="block truncate" title={themCards}>{themCards || '—'}</span>
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-300 whitespace-nowrap">
                        {(trade.themCash ?? 0) > 0 ? `$${(trade.themCash).toFixed(2)}` : '—'}
                      </td>
                      <td className={`py-2 pr-4 text-right font-medium whitespace-nowrap ${diff >= 0 ? 'text-sky-400' : 'text-orange-400'}`}>
                        {diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)}
                      </td>
                      <td className={`py-2 font-medium whitespace-nowrap ${vColor}`}>{verdict}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-surface-600 flex items-center gap-3 flex-shrink-0">
          <div className="flex gap-2 flex-1">
            {[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel (.xlsx)' }].map((opt) => (
              <button key={opt.value} onClick={() => setFormat(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  format === opt.value
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-surface-700 border-surface-500 text-slate-400 hover:text-white'
                }`}>{opt.label}</button>
            ))}
          </div>
          <button onClick={onClose}
            className="px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Close
          </button>
          <button onClick={handleExport} disabled={exporting || noneSelected}
            className="px-4 py-2 bg-accent hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting…' : `Export ${selected.size > 0 ? selected.size : ''}`}
          </button>
        </div>

      </div>
    </div>
  )
}

function groupTradesByYearMonth(trades) {
  const map = {}
  for (const trade of trades) {
    const d = new Date(trade.savedAt)
    const year = d.getFullYear().toString()
    const monthKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleString('en-US', { month: 'long' })
    if (!map[year]) map[year] = {}
    if (!map[year][monthKey]) map[year][monthKey] = { label: monthLabel, trades: [] }
    map[year][monthKey].trades.push(trade)
  }
  return Object.keys(map)
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      months: Object.entries(map[year])
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, { label, trades }]) => ({ key, label, trades })),
    }))
}

// ── Trade history panel ────────────────────────────────────────────────────────
function HistoryPanel({ trades, onLoad, onDelete, onUndo, loadedTradeId, activeThemName }) {
  const { format } = useCurrency()
  const [historyFilter, setHistoryFilter] = useState('all')

  const filteredTrades = useMemo(() => {
    if (historyFilter === 'saved') return trades.filter((t) => !t.executed)
    if (historyFilter === 'executed') return trades.filter((t) => t.executed)
    return trades
  }, [trades, historyFilter])

  const grouped = useMemo(() => groupTradesByYearMonth(filteredTrades), [filteredTrades])

  const [openYears, setOpenYears] = useState(() => {
    const now = new Date()
    return new Set([now.getFullYear().toString()])
  })

  const [openMonths, setOpenMonths] = useState(() => {
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return new Set([key])
  })

  const [expandedTrades, setExpandedTrades] = useState(new Set())

  function toggleYear(year) {
    setOpenYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year); else next.add(year)
      return next
    })
  }

  function toggleMonth(key) {
    setOpenMonths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function toggleExpanded(id) {
    setExpandedTrades((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function sideSummary(cards, cash) {
    const names = cards.slice(0, 2).map((c) => c.name).join(', ')
    const more = cards.length > 2 ? ` +${cards.length - 2}` : ''
    return names + more + (cash > 0 ? (names ? ` + $${cash.toFixed(0)} cash` : `$${cash.toFixed(0)} cash`) : '')
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700 flex-shrink-0">
        <h3 className="text-yellow-300 font-semibold text-sm uppercase tracking-wider">Trade History</h3>
        <p className="text-slate-600 text-xs mt-0.5">{filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-1 mt-2">
          {[
            ['all', 'All', trades.length],
            ['saved', 'Saved', trades.filter((t) => !t.executed).length],
            ['executed', 'Done', trades.filter((t) => t.executed).length],
          ].map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setHistoryFilter(val)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors border ${
                historyFilter === val
                  ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40'
                  : 'text-slate-500 hover:text-slate-400 border-transparent'
              }`}
            >
              {label} {count}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-700">
            <svg className="w-8 h-8 mb-2 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <p className="text-xs text-center">
              {historyFilter === 'all' ? 'No trade history yet' : `No ${historyFilter} trades`}
            </p>
            {historyFilter === 'all' && <p className="text-xs text-center mt-1">Save or execute a trade to see it here</p>}
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(({ year, months }) => {
              const yearOpen = openYears.has(year)
              const yearCount = months.reduce((s, m) => s + m.trades.length, 0)
              return (
                <div key={year}>
                  {/* Year row */}
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-surface-700/50 transition-colors group">
                    <svg
                      className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${yearOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-white font-bold text-sm flex-1 text-left">{year}</span>
                    <span className="text-slate-600 text-xs">{yearCount}</span>
                  </button>

                  {yearOpen && months.map(({ key, label, trades: monthTrades }) => {
                    const monthOpen = openMonths.has(key)
                    return (
                      <div key={key}>
                        {/* Month row */}
                        <button
                          onClick={() => toggleMonth(key)}
                          className="w-full flex items-center gap-1.5 pl-6 pr-3 py-1.5 hover:bg-surface-700/50 transition-colors">
                          <svg
                            className={`w-2.5 h-2.5 text-slate-600 flex-shrink-0 transition-transform ${monthOpen ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-slate-400 text-xs font-medium flex-1 text-left">{label}</span>
                          <span className="text-slate-600 text-xs">{monthTrades.length}</span>
                        </button>

                        {monthOpen && (
                          <div className="pb-1">
                            {monthTrades.map((trade) => {
                              const date = new Date(trade.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              const isExpanded = expandedTrades.has(trade.id)
                              const diff = (trade.themTotal ?? 0) - (trade.youTotal ?? 0)
                              const isFair = Math.abs(diff) < 0.005
                              const diffColor = isFair ? 'text-slate-500' : diff > 0 ? 'text-sky-400' : 'text-orange-400'
                              const diffLabel = isFair ? 'Fair trade' : diff > 0 ? `You +${format(diff)}` : `Them +${format(Math.abs(diff))}`
                              return (
                                <div key={trade.id} className="border-b border-surface-700/40 last:border-0">
                                  {/* Compact row */}
                                  <div
                                    className="flex items-center gap-1.5 pl-6 pr-2 py-1.5 hover:bg-surface-700/50 cursor-pointer group transition-colors"
                                    onClick={() => toggleExpanded(trade.id)}>
                                    <svg
                                      className={`w-2.5 h-2.5 text-slate-600 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-slate-500 text-[11px] flex-shrink-0 w-9 leading-none">{date}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${trade.executed ? 'bg-emerald-400' : 'bg-yellow-400'}`} title={trade.executed ? 'Executed' : 'Saved'} />
                                    <span className="text-white text-xs flex-1 truncate min-w-0 font-medium">{(loadedTradeId === trade.id && activeThemName) ? activeThemName : (trade.themName || 'Them')}</span>
                                    <span className={`text-[11px] font-semibold flex-shrink-0 ${diffColor}`}>{diffLabel}</span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-0.5">
                                      {trade.executed && (
                                        <button onClick={(e) => { e.stopPropagation(); onUndo(trade.id) }} title="Undo trade"
                                          className="text-slate-600 hover:text-red-400 transition-colors">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                          </svg>
                                        </button>
                                      )}
                                      <button onClick={(e) => { e.stopPropagation(); onDelete(trade.id) }}
                                        className="text-slate-600 hover:text-red-400 text-xs leading-none transition-colors">✕</button>
                                    </div>
                                  </div>
                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div className="mx-2 mb-1.5 mt-0.5 bg-surface-700/50 hover:bg-surface-700 rounded-lg p-3 cursor-pointer transition-colors"
                                      onClick={() => onLoad(trade)}>
                                      <div className="flex items-center justify-between gap-1 mb-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {trade.executed
                                            ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">Executed</span>
                                            : <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-400/10 text-yellow-400 border border-yellow-400/25 flex-shrink-0">Saved</span>
                                          }
                                        </div>
                                        <span className="text-slate-600 text-[10px] flex-shrink-0">click to load</span>
                                      </div>
                                      <div className="space-y-1 mb-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-yellow-300/70 text-xs font-medium">You</span>
                                          <span className="text-white text-xs font-bold">{format(trade.youTotal)}</span>
                                        </div>
                                        <p className="text-slate-500 text-xs truncate leading-tight">
                                          {sideSummary(trade.youCards, trade.youCash) || '—'}
                                        </p>
                                        <div className="flex items-center justify-between mt-1">
                                          <span className="text-slate-400 text-xs font-medium">{trade.themName || 'Them'}</span>
                                          <span className="text-slate-300 text-xs font-bold">{format(trade.themTotal)}</span>
                                        </div>
                                        <p className="text-slate-500 text-xs truncate leading-tight">
                                          {sideSummary(trade.themCards, trade.themCash) || '—'}
                                        </p>
                                      </div>
                                      <TradeVerdict youTotal={trade.youTotal} themTotal={trade.themTotal} small />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TradeAnalyzer() {
  const { format } = useCurrency()
  const [youCards, setYouCards] = useState([])
  const [themCards, setThemCards] = useState([])
  const [youCash, setYouCash] = useState(0)
  const [themCash, setThemCash] = useState(0)
  const [themName, _setThemName] = useState('')
  const themNameRef = useRef('')
  function setThemName(name) { themNameRef.current = name; _setThemName(name) }
  const [loadedTradeId, setLoadedTradeId] = useState(null)
  const [showAddCard, setShowAddCard] = useState(null)
  const [showCash, setShowCash] = useState(null)
  const [trades, setTrades] = useState([])
  const [saving, setSaving] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showMakeTradeModal, setShowMakeTradeModal] = useState(false)
  const [makeTradeError, setMakeTradeError] = useState(null)
  const [showUndoModal, setShowUndoModal] = useState(null) // tradeId

  useEffect(() => {
    window.api.listTrades().then(setTrades).catch(() => {})
  }, [])

  const youTotal = youCards.reduce((s, c) => s + c.price, 0) + youCash
  const themTotal = themCards.reduce((s, c) => s + c.price, 0) + themCash
  const totalBoth = youTotal + themTotal

  const sliderPos = totalBoth === 0 ? 0.5 : Math.max(0, Math.min(1, youTotal / totalBoth))
  const diff = youTotal - themTotal
  const absDiff = Math.abs(diff)
  const isFair = totalBoth === 0 || absDiff < 0.005
  const pct = isFair ? null : Math.round(absDiff / Math.max(youTotal, themTotal) * 100)
  const fairLabel = isFair ? 'Fair Trade'
    : diff > 0 ? `${themName ? `${themName} is` : "They're"} getting a better deal by ${format(absDiff)} (${pct}%)`
    : `You're getting a better deal by ${format(absDiff)} (${pct}%)`
  const labelColor = isFair ? 'text-emerald-400' : diff > 0 ? 'text-orange-400' : 'text-sky-400'

  const hasItems = youCards.length > 0 || themCards.length > 0 || youCash > 0 || themCash > 0
  const isLoadedExecuted = loadedTradeId ? trades.find((t) => t.id === loadedTradeId)?.executed === true : false

  function addCard(side, card) {
    if (side === 'you') setYouCards((p) => [...p, card])
    else setThemCards((p) => [...p, card])
  }

  function removeCard(side, uid) {
    if (side === 'you') setYouCards((p) => p.filter((c) => c.uid !== uid))
    else setThemCards((p) => p.filter((c) => c.uid !== uid))
  }

  function reset() {
    setYouCards([]); setThemCards([]); setYouCash(0); setThemCash(0); setThemName(''); setLoadedTradeId(null)
  }

  function tradePayload() {
    return { youCards, themCards, youCash, themCash, youTotal, themTotal, themName: themNameRef.current.trim() || null }
  }

  async function handleSave() {
    if (!hasItems) return
    setSaving(true)
    try {
      const entry = await window.api.saveTrade(tradePayload())
      setTrades((prev) => [entry, ...prev])
      setLoadedTradeId(entry.id)
    } catch {}
    setSaving(false)
  }

  async function handleUpdate() {
    if (!hasItems || !loadedTradeId) return
    setSaving(true)
    try {
      const updated = await window.api.updateTrade(loadedTradeId, tradePayload())
      if (updated) setTrades((prev) => prev.map((t) => t.id === loadedTradeId ? updated : t))
    } catch (e) { console.error('Update trade failed:', e) }
    setSaving(false)
  }

  async function handleSaveAsNew() {
    if (!hasItems) return
    setSaving(true)
    try {
      const entry = await window.api.saveTrade(tradePayload())
      setTrades((prev) => [entry, ...prev])
      setLoadedTradeId(entry.id)
    } catch {}
    setSaving(false)
  }

  async function handleMakeTrade() {
    const youCollectionIds = youCards.filter((c) => c.collectionId).map((c) => c.collectionId)
    const receivedCards = themCards.map((c) => ({
      tcgId: c.tcgId,
      name: c.name,
      setName: c.setName,
      number: c.number,
      imageUrl: c.imageUrl,
      condition: c.condition,
      price: c.price,
    }))
    const payload = {
      youCollectionIds,
      receivedCards,
      tradePayload: tradePayload(),
      existingTradeId: loadedTradeId || null,
    }
    try {
      await window.api.executeTrade(payload)
      const fresh = await window.api.listTrades()
      setTrades(fresh)
      setShowMakeTradeModal(false)
      reset()
    } catch (e) {
      console.error('Execute trade failed:', e)
      setMakeTradeError(e?.message || 'Something went wrong. Please try again.')
    }
  }

  async function handleDeleteTrade(id) {
    await window.api.deleteTrade(id)
    setTrades((prev) => prev.filter((t) => t.id !== id))
    if (loadedTradeId === id) setLoadedTradeId(null)
  }

  async function handleUndoTrade() {
    const id = showUndoModal
    await window.api.undoTrade(id)
    const fresh = await window.api.listTrades()
    setTrades(fresh)
    setShowUndoModal(null)
  }

  function handleLoadTrade(trade) {
    setYouCards(trade.youCards || [])
    setThemCards(trade.themCards || [])
    setYouCash(trade.youCash || 0)
    setThemCash(trade.themCash || 0)
    setThemName(trade.themName || '')
    setLoadedTradeId(trade.id)
  }

  const executedTrades = trades.filter((t) => t.executed)
  const totalTrades = executedTrades.length
  const totalPnl = executedTrades.reduce((s, t) => s + ((t.themTotal ?? 0) - (t.youTotal ?? 0)), 0)
  const validTrades = executedTrades.filter((t) => Math.max(t.youTotal ?? 0, t.themTotal ?? 0) > 0)
  const avgPctDiff = validTrades.length === 0 ? null
    : validTrades.reduce((s, t) => s + ((t.themTotal - t.youTotal) / Math.max(t.youTotal, t.themTotal) * 100), 0) / validTrades.length

  return (
    <div className="h-full flex gap-4 px-6 py-4 min-h-0">

      {/* Left: saved trades history */}
      <HistoryPanel trades={trades} onLoad={handleLoadTrade} onDelete={handleDeleteTrade} onUndo={(id) => setShowUndoModal(id)} loadedTradeId={loadedTradeId} activeThemName={themName} />

      {/* Right: active trade */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-xl">Trade Analyzer</h2>
            <p className="text-slate-500 text-sm mt-0.5">Compare card values to see if your trade is fair</p>
          </div>
          <div className="flex items-center gap-2">
            {hasItems && (
              <>
                {isLoadedExecuted && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-medium">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Executed — view only
                  </div>
                )}
                <button onClick={() => { setMakeTradeError(null); setShowMakeTradeModal(true) }}
                  disabled={isLoadedExecuted}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors">
                  Make Trade
                </button>
                {loadedTradeId ? (
                  <>
                    <button onClick={handleUpdate} disabled={saving || isLoadedExecuted}
                      className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold rounded-lg transition-colors">
                      {saving ? 'Saving…' : 'Update Trade'}
                    </button>
                    <button onClick={handleSaveAsNew} disabled={saving || isLoadedExecuted}
                      className="px-4 py-1.5 bg-surface-700 hover:bg-surface-600 disabled:opacity-40 disabled:cursor-not-allowed border border-yellow-400/40 text-yellow-300 hover:text-yellow-200 text-sm font-medium rounded-lg transition-colors">
                      Save as New Trade
                    </button>
                  </>
                ) : (
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black text-sm font-bold rounded-lg transition-colors">
                    {saving ? 'Saving…' : 'Save Trade'}
                  </button>
                )}
                <button onClick={reset}
                  className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors">
                  Reset
                </button>
              </>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={trades.length === 0}
              className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 text-sm font-medium rounded-lg transition-colors">
              Export
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-3">
          <div className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Trades</p>
            <p className="text-white font-bold text-2xl">{totalTrades}</p>
          </div>
          <div className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total P&amp;L</p>
            {totalTrades === 0 ? (
              <p className="text-slate-600 font-bold text-2xl">—</p>
            ) : (
              <p className={`font-bold text-2xl ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}{format(totalPnl)}
              </p>
            )}
          </div>
          <div className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Avg Trade Diff</p>
            {avgPctDiff === null ? (
              <p className="text-slate-600 font-bold text-2xl">—</p>
            ) : (
              <p className={`font-bold text-2xl ${avgPctDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {avgPctDiff >= 0 ? '+' : ''}{avgPctDiff.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Fair trade bar */}
        <div className="flex-shrink-0">
          <div className="relative h-5 rounded-full overflow-hidden"
            style={{ background: 'linear-gradient(to right, #22c55e 0%, #4b5563 50%, #ef4444 100%)' }}>
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-surface-900 z-10"
              style={{ left: `${sliderPos * 100}%`, transition: 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-emerald-400 text-xs font-medium">← Better Trade for You</span>
            <span className="text-white text-sm font-bold">{fairLabel}</span>
            <span className="text-red-400 text-xs font-medium">Better Trade for Them →</span>
          </div>
        </div>

        {/* Two side panels */}
        <div className="flex-1 flex gap-4 min-h-0">
          <SidePanel side="you" cards={youCards} cash={youCash} total={youTotal}
            onAddCard={() => setShowAddCard('you')} onAddCash={() => setShowCash('you')}
            onRemoveCard={(uid) => removeCard('you', uid)} />

          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 py-8">
            <div className="w-px flex-1 bg-surface-700" />
            <span className="text-xs font-bold text-surface-500 bg-surface-900 px-2 py-1 rounded-full border border-surface-700">VS</span>
            <div className="w-px flex-1 bg-surface-700" />
          </div>

          <SidePanel side="them" label={themName || 'Them'} onRename={setThemName}
            cards={themCards} cash={themCash} total={themTotal}
            onAddCard={() => setShowAddCard('them')} onAddCash={() => setShowCash('them')}
            onRemoveCard={(uid) => removeCard('them', uid)} />
        </div>

      </div>

      {/* Modals */}
      {showMakeTradeModal && (
        <MakeTradeModal
          youCards={youCards} themCards={themCards}
          youCash={youCash} themCash={themCash}
          youTotal={youTotal} themTotal={themTotal}
          themName={themName}
          error={makeTradeError}
          onConfirm={handleMakeTrade}
          onClose={() => setShowMakeTradeModal(false)}
        />
      )}
      {showExportModal && (
        <TradeExportModal trades={trades} onClose={() => setShowExportModal(false)} />
      )}
      {showUndoModal && (
        <UndoTradeModal
          trade={trades.find((t) => t.id === showUndoModal) || {}}
          onConfirm={handleUndoTrade}
          onClose={() => setShowUndoModal(null)}
        />
      )}
      {showAddCard && (
        <TradeCardSearch side={showAddCard}
          onAdd={(card) => addCard(showAddCard, card)}
          onClose={() => setShowAddCard(null)} />
      )}
      {showCash && (
        <CashModal side={showCash}
          current={showCash === 'you' ? youCash : themCash}
          onSave={(val) => showCash === 'you' ? setYouCash(val) : setThemCash(val)}
          onClose={() => setShowCash(null)} />
      )}
    </div>
  )
}
