import { useState, useEffect, useRef, useMemo } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import BinderSelector from '../components/BinderSelector'
import PriceChart from '../components/PriceChart'

const CONDITIONS = [
  { value: 'raw',   label: 'Raw (Ungraded)' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9',  label: 'PSA 9' },
  { value: 'psa8',  label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9',  label: 'CGC 9' },
]

const RARITIES = [
  { value: '', label: 'All Rarities' },
  { value: 'Common', label: 'Common' },
  { value: 'Uncommon', label: 'Uncommon' },
  { value: 'Rare', label: 'Rare' },
  { value: 'Rare Holo', label: 'Rare Holo' },
  { value: 'Double Rare', label: 'Double Rare' },
  { value: 'Illustration Rare', label: 'Illustration Rare' },
  { value: 'Special Illustration Rare', label: 'Special Illustration Rare' },
  { value: 'Hyper Rare', label: 'Hyper Rare' },
  { value: 'ACE SPEC Rare', label: 'ACE SPEC Rare' },
  { value: 'Promo', label: 'Promo' },
  { value: 'Shiny Rare', label: 'Shiny Rare' },
  { value: 'Shiny Ultra Rare', label: 'Shiny Ultra Rare' },
  { value: 'Radiant Rare', label: 'Radiant Rare' },
  { value: 'Amazing Rare', label: 'Amazing Rare' },
  { value: 'Rare BREAK', label: 'Rare BREAK' },
  { value: 'Rare Prism Star', label: 'Rare Prism Star' },
  { value: 'Rare Ultra', label: 'Rare Ultra' },
  { value: 'Rare Secret', label: 'Rare Secret' },
]

let popularCache = null

function cardPrice(card) {
  return card.cardmarket?.prices?.averageSellPrice
    ?? card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null
}

export function CardDetailModal({ card, ownedCards, onAdd, onRemove, onClose, onFilterByArtist }) {
  const { format } = useCurrency()
  const [addingSection, setAddingSection] = useState(null)
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const [inspecting, setInspecting] = useState(false)
  const [inspectTilt, setInspectTilt] = useState({ x: 0, y: 0 })
  const [priceHistory, setPriceHistory] = useState([])
  const [chartRange, setChartRange] = useState(90)
  const imgRef = useRef(null)
  const inspectImgRef = useRef(null)

  const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
  const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
  const ownedEntry = ownedCards.find((c) => c.tcgId === card.id)
  const price = cardPrice(card)

  useEffect(() => {
    if (ownedEntry?.id) {
      window.api.getPriceHistory(ownedEntry.id).then(setPriceHistory).catch(() => {})
    } else {
      setPriceHistory([])
    }
  }, [ownedEntry?.id])

  function handleMouseMove(e) {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setCardTilt({ x: dy * -12, y: dx * 12 })
  }

  function handleInspectMouseMove(e) {
    if (!inspectImgRef.current) return
    const rect = inspectImgRef.current.getBoundingClientRect()
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setInspectTilt({ x: dy * -15, y: dx * 15 })
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-5xl overflow-hidden flex max-h-[88vh]">

          {/* Left: card image — fills the full panel with equal padding */}
          <div className="flex-shrink-0 w-80 bg-surface-900 p-5 flex flex-col">
            <img
              ref={imgRef}
              src={card.images?.large || card.images?.small}
              alt={card.name}
              className="flex-1 min-h-0 w-full object-contain rounded-xl select-none cursor-pointer"
              style={{
                transform: `perspective(800px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`,
                transition: cardTilt.x === 0 && cardTilt.y === 0 ? 'transform 0.4s ease' : 'transform 0.05s linear',
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setCardTilt({ x: 0, y: 0 })}
              onClick={() => setInspecting(true)}
              title="Click to inspect"
            />
          </div>

          {/* Right: info + chart + actions */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Header row */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <div className="min-w-0 pr-2">
                <h2 className="text-xl font-bold text-white leading-tight">
                  {card.name}{card.number ? <span className="text-slate-400 font-normal text-base ml-2">#{card.number}</span> : null}
                </h2>
              </div>
              <button onClick={onClose} className="flex-shrink-0 text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pb-5 flex flex-col gap-4 min-h-0">

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Set</p>
                  <p className="text-white text-sm">{card.set?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Rarity</p>
                  <p className="text-white text-sm">{card.rarity ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Pokémon Type</p>
                  <p className="text-white text-sm">{card.types?.length > 0 ? card.types.join(', ') : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Card Type</p>
                  <p className="text-white text-sm">{card.subtypes?.length > 0 ? card.subtypes.join(', ') : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Illustrator</p>
                  {card.artist && onFilterByArtist ? (
                    <button
                      onClick={() => onFilterByArtist(card.artist)}
                      className="text-sm text-accent hover:text-yellow-200 underline underline-offset-2 decoration-accent/50 hover:decoration-yellow-300 transition-colors text-left"
                      title={`Show all cards by ${card.artist}`}
                    >
                      {card.artist}
                    </button>
                  ) : (
                    <p className="text-white text-sm">{card.artist ?? '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Market Price · Raw</p>
                  {price != null
                    ? <p className="text-accent font-bold text-3xl leading-tight">{format(price)}</p>
                    : <p className="text-slate-600 text-xl">—</p>
                  }
                </div>
              </div>

              {/* Price chart */}
              <div className="bg-surface-900/60 border border-surface-700 rounded-xl p-4">
                <div style={{ height: 200 }}>
                  <PriceChart
                    history={priceHistory}
                    range={chartRange}
                    onRangeChange={setChartRange}
                    showRangeButtons
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                {inPortfolio ? (
                  <button
                    onClick={() => { onRemove(card, 'collection'); onClose() }}
                    className="flex-1 bg-red-800/70 hover:bg-red-700/80 border border-red-700/50 text-red-300 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Remove from Collection
                  </button>
                ) : (
                  <button
                    onClick={() => setAddingSection('collection')}
                    className="flex-1 bg-accent hover:bg-accent-hover text-black text-sm font-bold py-2.5 rounded-lg transition-colors"
                  >
                    + Add to Collection
                  </button>
                )}
                {inWatchlist ? (
                  <button
                    onClick={() => { onRemove(card, 'watchlist'); onClose() }}
                    className="flex-1 bg-red-800/70 hover:bg-red-700/80 border border-red-700/50 text-red-300 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Remove from Watchlist
                  </button>
                ) : (
                  <button
                    onClick={() => setAddingSection('watchlist')}
                    className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
                  >
                    + Add to Watchlist
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {addingSection && (
        <AddModal
          card={card}
          section={addingSection}
          onAdd={() => { onAdd(); setAddingSection(null); onClose() }}
          onClose={() => setAddingSection(null)}
        />
      )}

      {inspecting && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60]"
          onClick={() => { setInspecting(false); setInspectTilt({ x: 0, y: 0 }) }}
        >
          <img
            ref={inspectImgRef}
            src={card.images?.large || card.images?.small}
            alt={card.name}
            className="max-h-[88vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl select-none cursor-default"
            style={{
              transform: `perspective(900px) rotateX(${inspectTilt.x}deg) rotateY(${inspectTilt.y}deg)`,
              transition: inspectTilt.x === 0 && inspectTilt.y === 0 ? 'transform 0.4s ease' : 'transform 0.05s linear',
            }}
            onMouseMove={handleInspectMouseMove}
            onMouseLeave={() => setInspectTilt({ x: 0, y: 0 })}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-5 right-6 text-white/70 hover:text-white text-3xl leading-none"
            onClick={() => setInspecting(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

export function AddModal({ card, section, onAdd, onClose }) {
  const [condition, setCondition] = useState('raw')
  const [binder, setBinder] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [targetBuyPrice, setTargetBuyPrice] = useState('')
  const [targetSellPrice, setTargetSellPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const binderRef = useRef(null)

  const sectionLabel = section === 'collection' ? 'Collection' : 'Watchlist'

  useEffect(() => {
    window.api.getSettings().then((s) => {
      if (s.defaultCondition) setCondition(s.defaultCondition)
    })
  }, [])

  async function handleAdd() {
    setAdding(true)
    try {
      const effectiveBinder = ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null
      const parsedPrice = purchasePrice !== '' ? parseFloat(purchasePrice) : null
      const newCard = await window.api.addCard(
        card, condition, 1, section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder
      )
      const parsedBuy  = targetBuyPrice  !== '' ? parseFloat(targetBuyPrice)  : null
      const parsedSell = targetSellPrice !== '' ? parseFloat(targetSellPrice) : null
      const targets = {}
      if (parsedBuy  != null && parsedBuy  > 0) targets.targetBuyPrice  = Math.round(parsedBuy  * 100) / 100
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

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !adding && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-5 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Add to {sectionLabel}</h2>
          <button onClick={onClose} disabled={adding} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center disabled:opacity-30">✕</button>
        </div>

        {adding ? (
          <div className="p-8 flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16">
              {card.images?.small && (
                <img src={card.images.small} alt={card.name}
                  className="w-12 h-[66px] object-contain rounded absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
              )}
              <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">{card.name}</p>
              <p className="text-slate-400 text-sm mt-1">Fetching current price data…</p>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={card.images?.small} alt={card.name}
                  className="w-12 h-[67px] object-contain rounded flex-shrink-0"
                  onError={(e) => (e.target.style.display = 'none')}
                />
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{card.name}</p>
                  <p className="text-slate-400 text-sm truncate">{card.set?.name}</p>
                  <p className="text-slate-500 text-xs">#{card.number}{card.rarity ? ` · ${card.rarity}` : ''}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-slate-400 text-sm mb-1.5 block">Condition</label>
                  <select
                    value={condition} onChange={(e) => setCondition(e.target.value)}
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                  >
                    {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-slate-400 text-sm mb-1.5 block">Binder (optional)</label>
                  <BinderSelector ref={binderRef} section={section} value={binder} onChange={setBinder} className="w-full" />
                </div>
              </div>

              {section === 'collection' && (
                <div>
                  <label className="text-slate-400 text-sm mb-1.5 block">Price Paid (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-emerald-500 text-sm mb-1.5 block font-medium">Buy Price Alert (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={targetBuyPrice}
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
                      type="number" min="0.01" step="0.01" value={targetSellPrice}
                      onChange={(e) => setTargetSellPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={handleAdd}
                className={`w-full text-black font-bold py-3 rounded-lg text-base transition-colors ${
                  section === 'collection' ? 'bg-accent hover:bg-accent-hover' : 'bg-sky-500 hover:bg-sky-400'
                }`}
              >
                Add to {sectionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SealedAddModal({ product, section, onAdd, onClose }) {
  const [binder, setBinder] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [targetBuyPrice, setTargetBuyPrice] = useState('')
  const [targetSellPrice, setTargetSellPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const binderRef = useRef(null)

  const sectionLabel = section === 'collection' ? 'Collection' : 'Watchlist'
  const productName = product['product-name'] || product.name || 'Unknown Product'
  const category = product['console-name'] || 'Sealed Product'

  async function handleAdd() {
    setAdding(true)
    try {
      const effectiveBinder = ((await binderRef.current?.ensureAndGetBinder()) ?? binder) || null
      const parsedPrice = purchasePrice !== '' ? parseFloat(purchasePrice) : null
      const newItem = await window.api.addSealedProduct(
        product,
        section,
        parsedPrice && parsedPrice > 0 ? parsedPrice : null,
        effectiveBinder
      )
      const parsedBuy  = targetBuyPrice  !== '' ? parseFloat(targetBuyPrice)  : null
      const parsedSell = targetSellPrice !== '' ? parseFloat(targetSellPrice) : null
      const targets = {}
      if (parsedBuy  != null && parsedBuy  > 0) targets.targetBuyPrice  = Math.round(parsedBuy  * 100) / 100
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

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !adding && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-5 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Add to {sectionLabel}</h2>
          <button onClick={onClose} disabled={adding} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center disabled:opacity-30">✕</button>
        </div>

        {adding ? (
          <div className="p-8 flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">{productName}</p>
              <p className="text-slate-400 text-sm mt-1">Fetching current price data…</p>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-white font-semibold">{productName}</p>
                <p className="text-slate-400 text-sm">{category}</p>
              </div>

              <div className="flex-1">
                <label className="text-slate-400 text-sm mb-1.5 block">Binder (optional)</label>
                <BinderSelector ref={binderRef} section={section} value={binder} onChange={setBinder} className="w-full" />
              </div>

              {section === 'collection' && (
                <div>
                  <label className="text-slate-400 text-sm mb-1.5 block">Price Paid (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-emerald-500 text-sm mb-1.5 block font-medium">Buy Price Alert (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={targetBuyPrice}
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
                      type="number" min="0.01" step="0.01" value={targetSellPrice}
                      onChange={(e) => setTargetSellPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={handleAdd}
                className={`w-full text-black font-bold py-3 rounded-lg text-base transition-colors ${
                  section === 'collection' ? 'bg-accent hover:bg-accent-hover' : 'bg-sky-500 hover:bg-sky-400'
                }`}
              >
                Add to {sectionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function useFavNames() {
  const [favNames, setFavNames] = useState(() => {
    try { return Object.values(JSON.parse(localStorage.getItem('pokeprice-favorites') || '{}')) } catch { return [] }
  })
  useEffect(() => {
    const update = () => { try { setFavNames(Object.values(JSON.parse(localStorage.getItem('pokeprice-favorites') || '{}'))) } catch {} }
    window.addEventListener('pokeprice-favs', update)
    return () => window.removeEventListener('pokeprice-favs', update)
  }, [])
  return favNames
}

export default function SearchPage({ initialQuery = '', initialArtist = '', onCardAdded }) {
  const { format } = useCurrency()
  const favNames = useFavNames()
  const [nameQuery, setNameQuery]   = useState(initialQuery)
  const [setQuery,  setSetQuery]    = useState('')
  const [rarity,    setRarity]      = useState('')
  const [results,   setResults]     = useState([])
  const [loading,   setLoading]     = useState(false)
  const [error,     setError]       = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [addModal,  setAddModal]    = useState(null)
  const [ownedCards, setOwnedCards] = useState([])
  const [sortOrder,  setSortOrder]  = useState('name')
  const [lightboxCard, setLightboxCard] = useState(null)
  const [binderFilter, setBinderFilter] = useState('')
  const [mode, setMode] = useState('sets') // 'cards' | 'sets' | 'sealed'
  const [browsedSet, setBrowsedSet] = useState(null)
  const [setsQuery, setSetsQuery] = useState('')
  const [portfolioBinders, setPortfolioBinders] = useState([])
  const [watchlistBinders, setWatchlistBinders] = useState([])
  const [allSets, setAllSets] = useState([])
  const [setDropdownOpen, setSetDropdownOpen] = useState(false)
  const [setSearch, setSetSearch] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [setRarityFilter, setSetRarityFilter] = useState('')
  const [setCollectionFilter, setSetCollectionFilter] = useState('')
  const [artistFilter, setArtistFilter] = useState(initialArtist)
  const [sealedQuery, setSealedQuery] = useState('')
  const [sealedResults, setSealedResults] = useState([])
  const [sealedLoading, setSealedLoading] = useState(false)
  const [sealedAddModal, setSealedAddModal] = useState(null)
  const [binderSearch, setBinderSearch] = useState('')
  const [browsedBinder, setBrowsedBinder] = useState(null)
  const [binderSectionFilter, setBinderSectionFilter] = useState('')
  const [binderSortOrder, setBinderSortOrder] = useState('name')
  const [showCollectionProgress, setShowCollectionProgress] = useState(true)
  const setDropdownRef = useRef(null)
  const nameRef = useRef(null)

  async function loadOwnedCards() {
    try {
      const cards = await window.api.listCards()
      setOwnedCards(cards)
    } catch {}
  }

  async function loadPopular() {
    if (popularCache) {
      setResults(popularCache)
      setHasSearched(true)
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const cards = await window.api.searchCardsAdvanced('rarity:"Special Illustration Rare"')
      const limited = cards.slice(0, 20)
      popularCache = limited
      setResults(limited)
    } catch {}
    finally {
      setLoading(false)
    }
  }

  function handleCardAdded() {
    onCardAdded()
    loadOwnedCards()
    window.api.listBinders('collection').then(setPortfolioBinders).catch(() => {})
    window.api.listBinders('watchlist').then(setWatchlistBinders).catch(() => {})
  }

  async function handleRemove(card, section) {
    const owned = ownedCards.find((c) =>
      c.tcgId === card.id &&
      (section === 'collection' ? c.section === 'collection' : (!c.section || c.section === 'watchlist'))
    )
    if (!owned) return
    await window.api.removeCard(owned.id)
    onCardAdded()
    loadOwnedCards()
  }

  useEffect(() => {
    nameRef.current?.focus()
    loadOwnedCards()
    if (initialArtist.trim()) {
      setMode('cards')
      runSearch('', '', '', initialArtist)
    } else if (initialQuery.trim()) {
      runSearch(initialQuery, '', '')
    } else {
      loadPopular()
    }
    window.api.listSets().then((sets) => setAllSets(sets)).catch(() => {})
    window.api.listBinders('collection').then(setPortfolioBinders).catch(() => {})
    window.api.listBinders('watchlist').then(setWatchlistBinders).catch(() => {})
  }, [])

  useEffect(() => {
    if (!browsedSet) return
    setSortOrder('number_asc')
    setSetRarityFilter('')
    setSetCollectionFilter('')
    setLoading(true)
    setHasSearched(true)
    setResults([])
    window.api.searchCardsAdvanced(`set.id:"${browsedSet.id}"`)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [browsedSet])

  useEffect(() => {
    if (!setDropdownOpen) return
    function handleClickOutside(e) {
      if (setDropdownRef.current && !setDropdownRef.current.contains(e.target)) {
        setSetDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setDropdownOpen])

  async function runSearch(name = nameQuery, set = setQuery, rar = rarity, artist = artistFilter) {
    const parts = []
    if (name.trim())   parts.push(`name:"${name.trim()}*"`)
    if (set.trim())    parts.push(`set.name:"${set.trim()}"`)
    if (rar)           parts.push(`rarity:"${rar}"`)
    if (artist.trim()) parts.push(`artist:"${artist.trim()}"`)
    if (!parts.length) return

    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const cards = await window.api.searchCardsAdvanced(parts.join(' '))
      setResults(cards)
    } catch {
      setError('Search failed. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  function handleFilterByArtist(artistName) {
    setLightboxCard(null)
    setMode('cards')
    setBrowsedSet(null)
    setNameQuery('')
    setSetQuery('')
    setRarity('')
    setBinderFilter('')
    setArtistFilter(artistName)
    runSearch('', '', '', artistName)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') runSearch()
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

  const canSearch = nameQuery.trim() || setQuery.trim() || rarity || binderFilter || artistFilter.trim()

  const binderResults = binderFilter
    ? ownedCards
        .filter((c) => {
          if (binderFilter === 'collection') return c.section === 'collection'
          if (binderFilter === 'watchlist') return (!c.section || c.section === 'watchlist')
          if (binderFilter.startsWith('binder:')) {
            const name = binderFilter.slice(7)
            return (c.binder || c.folder) === name
          }
          return false
        })
        .map((c) => ({ id: c.tcgId, name: c.name, images: { small: c.imageUrl }, set: { name: c.setName }, number: c.number, rarity: c.rarity }))
    : null

  function parseCardNum(str) {
    if (!str) return Infinity
    const slashPart = str.split('/')[0]
    const m = slashPart.match(/(\d+)$/)
    return m ? parseInt(m[1], 10) : Infinity
  }

  const baseResults = (mode === 'sets' && browsedSet) ? results : (binderResults ?? results)

  const setStats = useMemo(() => {
    const stats = {}
    ownedCards.forEach((c) => {
      if (!c.setName) return
      if (!stats[c.setName]) stats[c.setName] = { count: 0, value: 0 }
      stats[c.setName].count++
      stats[c.setName].value += c.currentPrice ?? 0
    })
    return stats
  }, [ownedCards])

  const allSeries = useMemo(() => {
    const s = new Set(allSets.map((s) => s.series).filter(Boolean))
    return Array.from(s).sort()
  }, [allSets])

  const allYears = useMemo(() => {
    const y = new Set(
      allSets.map((s) => (s.releaseDate || '').split('/')[0].split('-')[0]).filter(Boolean)
    )
    return Array.from(y).sort().reverse()
  }, [allSets])

  const setsFiltered = useMemo(() => {
    const q = setsQuery.trim().toLowerCase()
    return [...allSets]
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q)) return false
        if (seriesFilter && s.series !== seriesFilter) return false
        if (yearFilter) {
          const year = (s.releaseDate || '').split('/')[0].split('-')[0]
          if (year !== yearFilter) return false
        }
        return true
      })
      .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
  }, [allSets, setsQuery, seriesFilter, yearFilter])

  const setRarities = useMemo(() => {
    if (!browsedSet) return []
    const s = new Set(results.map((c) => c.rarity).filter(Boolean))
    return Array.from(s).sort()
  }, [results, browsedSet])

  const allBinders = useMemo(() => {
    const entries = []
    portfolioBinders.forEach((name) => {
      const cards = ownedCards.filter((c) => (c.binder || c.folder) === name && c.section === 'collection')
      entries.push({ name, section: 'collection', count: cards.length, value: cards.reduce((s, c) => s + (c.currentPrice ?? 0), 0) })
    })
    watchlistBinders.forEach((name) => {
      const cards = ownedCards.filter((c) => (c.binder || c.folder) === name && (!c.section || c.section === 'watchlist'))
      entries.push({ name, section: 'watchlist', count: cards.length, value: cards.reduce((s, c) => s + (c.currentPrice ?? 0), 0) })
    })
    return entries.sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section))
  }, [portfolioBinders, watchlistBinders, ownedCards])

  const bindersFiltered = useMemo(() => {
    const q = binderSearch.trim().toLowerCase()
    return allBinders
      .filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false
        if (binderSectionFilter && f.section !== binderSectionFilter) return false
        return true
      })
      .sort((a, b) => {
        if (binderSortOrder === 'count') return b.count - a.count
        if (binderSortOrder === 'value') return b.value - a.value
        return a.name.localeCompare(b.name) || a.section.localeCompare(b.section)
      })
  }, [allBinders, binderSearch, binderSectionFilter, binderSortOrder])

  const browsedBinderCards = useMemo(() => {
    if (!browsedBinder) return []
    return ownedCards
      .filter((c) => {
        if ((c.binder || c.folder) !== browsedBinder.name) return false
        if (browsedBinder.section === 'collection') return c.section === 'collection'
        return (!c.section || c.section === 'watchlist')
      })
      .map((c) => ({ id: c.tcgId, name: c.name, images: { small: c.imageUrl }, set: { name: c.setName }, number: c.number, rarity: c.rarity, _owned: c }))
  }, [browsedBinder, ownedCards])

  const sortedResults = [...baseResults].sort((a, b) => {
    if (sortOrder === 'name')         return a.name.localeCompare(b.name)
    if (sortOrder === 'set_asc') {
      const setCmp = (a.set?.name ?? '').localeCompare(b.set?.name ?? '')
      return setCmp !== 0 ? setCmp : parseCardNum(a.number) - parseCardNum(b.number)
    }
    if (sortOrder === 'number_asc')   return parseCardNum(a.number) - parseCardNum(b.number)
    if (sortOrder === 'number_desc')  return parseCardNum(b.number) - parseCardNum(a.number)
    if (sortOrder === 'price')        return (cardPrice(b) ?? -Infinity) - (cardPrice(a) ?? -Infinity)
    if (sortOrder === 'price_low')    return (cardPrice(a) ?? Infinity)  - (cardPrice(b) ?? Infinity)
    return 0
  })

  const displayResults = useMemo(() => {
    if (!browsedSet) return sortedResults
    return sortedResults.filter((card) => {
      if (setRarityFilter && card.rarity !== setRarityFilter) return false
      if (setCollectionFilter === 'owned')     return ownedCards.some((c) => c.tcgId === card.id)
      if (setCollectionFilter === 'collection') return ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
      if (setCollectionFilter === 'watchlist') return ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
      if (setCollectionFilter === 'not_owned') return !ownedCards.some((c) => c.tcgId === card.id)
      return true
    })
  }, [sortedResults, setRarityFilter, setCollectionFilter, ownedCards, browsedSet])

  return (
    <div>
      {/* ── Search / filter bar — always visible ── */}
      <div className="bg-surface-800 border border-surface-600 rounded-xl p-4 mb-5">
        <div className="flex gap-3 flex-wrap items-end">

          {/* Mode toggle — inline, leftmost */}
          <div className="flex gap-0.5 bg-surface-900 border border-surface-600 rounded-lg p-1 self-end mb-[1px] flex-shrink-0">
            <button
              onClick={() => { setMode('sets'); setBrowsedSet(null) }}
              className={`px-5 py-2 rounded text-sm font-semibold transition-colors ${mode === 'sets' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Sets
            </button>
            <button
              onClick={() => { setMode('cards'); setBrowsedSet(null) }}
              className={`px-5 py-2 rounded text-sm font-semibold transition-colors ${mode === 'cards' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Items
            </button>
            <button
              onClick={() => { setMode('folders'); setBrowsedSet(null); setBrowsedBinder(null) }}
              className={`px-5 py-2 rounded text-sm font-semibold transition-colors ${mode === 'folders' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Binders
            </button>
          </div>

          {/* Cards mode fields */}
          {mode === 'cards' && <>
            {artistFilter && (
              <div className="w-full flex items-center gap-2 bg-amber-900/20 border border-accent/40 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                </svg>
                <span className="text-accent text-sm">Illustrator: <strong className="text-white">{artistFilter}</strong></span>
                <button
                  onClick={() => { setArtistFilter(''); loadPopular() }}
                  className="ml-auto text-accent hover:text-white text-lg leading-none transition-colors"
                  title="Clear artist filter"
                >×</button>
              </div>
            )}
            <div className="flex-1 min-w-[160px]">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Pokémon Name</label>
              <input
                ref={nameRef}
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Charizard"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex-1 min-w-[160px] relative" ref={setDropdownRef}>
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Set Name</label>
              <button
                type="button"
                onClick={() => { setSetDropdownOpen((v) => !v); setSetSearch('') }}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between focus:outline-none focus:border-accent hover:border-surface-400"
              >
                <span className={setQuery ? 'text-white' : 'text-slate-500'}>{setQuery || 'Any set…'}</span>
                <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${setDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {setDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-700 border border-surface-500 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-surface-600">
                    <input
                      autoFocus
                      value={setSearch}
                      onChange={(e) => setSetSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setSetDropdownOpen(false) }}
                      placeholder="Search sets…"
                      className="w-full bg-surface-800 border border-surface-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setSetQuery(''); setSetDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      Any set
                    </button>
                    {allSets
                      .filter((s) => s.name.toLowerCase().includes(setSearch.toLowerCase()))
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSetQuery(s.name); setSetDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-600 transition-colors ${setQuery === s.name ? 'text-accent' : 'text-white'}`}
                        >
                          {s.name}
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="w-52 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Card Type / Rarity</label>
              <select
                value={rarity} onChange={(e) => setRarity(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="w-48 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Binder</label>
              <select
                value={binderFilter} onChange={(e) => setBinderFilter(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">All Cards</option>
                <optgroup label="Collection">
                  <option value="collection">Collection (all)</option>
                  {portfolioBinders.map((f) => (
                    <option key={f} value={`binder:${f}`}>&nbsp;&nbsp;{f}</option>
                  ))}
                </optgroup>
                <optgroup label="Watchlist">
                  <option value="watchlist">Watchlist (all)</option>
                  {watchlistBinders.map((f) => (
                    <option key={f} value={`binder:${f}`}>&nbsp;&nbsp;{f}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="w-48 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Sort By</label>
              <select
                value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="name">Name (A → Z)</option>
                <option value="set_asc">Set</option>
                <option value="number_asc">Card Number (Low → High)</option>
                <option value="number_desc">Card Number (High → Low)</option>
                <option value="price">Current Price</option>
              </select>
            </div>
            <div className="flex gap-2 items-end flex-shrink-0">
              <button
                onClick={() => runSearch()}
                disabled={loading || !canSearch || !!binderFilter}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
              <button
                onClick={() => {
                  setNameQuery('')
                  setSetQuery('')
                  setRarity('')
                  setBinderFilter('')
                  setArtistFilter('')
                  setSortOrder('name')
                  setError(null)
                  loadPopular()
                }}
                className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-slate-300 font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </>}

          {/* Sets mode: search + filters */}
          {mode === 'sets' && <>
            <div className="flex-1 min-w-[160px]">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Search Sets</label>
              <input
                value={setsQuery}
                onChange={(e) => setSetsQuery(e.target.value)}
                placeholder="Search sets…"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="w-52 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Parent Set</label>
              <select
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">All Series</option>
                {allSeries.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="w-36 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Year</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">All Years</option>
                {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-end flex-shrink-0">
              <button
                onClick={() => setShowCollectionProgress((v) => !v)}
                title="Toggle collection progress bars"
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showCollectionProgress ? 'bg-accent text-black' : 'bg-surface-600 hover:bg-surface-500 text-slate-300'}`}
              >
                Progress
              </button>
            </div>
            {(seriesFilter || yearFilter || setsQuery) && (
              <div className="flex items-end flex-shrink-0">
                <button
                  onClick={() => { setSeriesFilter(''); setYearFilter(''); setSetsQuery('') }}
                  className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-slate-300 font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            )}
          </>}

          {/* Sealed mode: product search */}
          {mode === 'sealed' && <>
            <div className="flex-1 min-w-[200px]">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Product Name</label>
              <input
                value={sealedQuery}
                onChange={(e) => setSealedQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSealedSearch()}
                placeholder="e.g. Scarlet & Violet Elite Trainer Box"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex gap-2 items-end flex-shrink-0">
              <button
                onClick={runSealedSearch}
                disabled={sealedLoading || !sealedQuery.trim()}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                {sealedLoading ? 'Searching…' : 'Search'}
              </button>
              <button
                onClick={() => { setSealedQuery(''); setSealedResults([]); setError(null) }}
                className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-slate-300 font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </>}

          {/* Binders mode: search + filters */}
          {mode === 'folders' && <>
            <div className="flex-1 min-w-[160px]">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Search Binders</label>
              <input
                value={binderSearch}
                onChange={(e) => setBinderSearch(e.target.value)}
                placeholder="Search binders…"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="w-44 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Section</label>
              <select
                value={binderSectionFilter}
                onChange={(e) => setBinderSectionFilter(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">All Sections</option>
                <option value="collection">Collection</option>
                <option value="watchlist">Watchlist</option>
              </select>
            </div>
            <div className="w-44 flex-shrink-0">
              <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Sort By</label>
              <select
                value={binderSortOrder}
                onChange={(e) => setBinderSortOrder(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="name">Name (A → Z)</option>
                <option value="count">Card Count</option>
                <option value="value">Total Value</option>
              </select>
            </div>
            {(binderSearch || binderSectionFilter) && (
              <div className="flex items-end flex-shrink-0">
                <button
                  onClick={() => { setBinderSearch(''); setBinderSectionFilter('') }}
                  className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-slate-300 font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            )}
          </>}

        </div>
      </div>

      {/* ── SETS mode: grid ── */}
      {mode === 'sets' && !browsedSet && (
        <div>
          {allSets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <p className="text-sm">Loading sets…</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {setsFiltered.map((set) => {
                const stats = setStats[set.name] || { count: 0, value: 0 }
                const totalCards = set.printedTotal || set.total || 0
                const releaseDate = set.releaseDate
                  ? new Date(set.releaseDate.replace(/\//g, '-')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null
                return (
                  <button
                    key={set.id}
                    onClick={() => { setBrowsedSet(set); setSeriesFilter(set.series || '') }}
                    className="bg-surface-800 border border-surface-600 hover:border-accent/50 hover:bg-surface-700 rounded-xl overflow-hidden text-left transition-all group"
                  >
                    <div className="relative bg-surface-900 h-32 flex items-center justify-center p-4">
                      {releaseDate && (
                        <div className="absolute top-2 right-2 text-right">
                          <p className="text-slate-500 text-[10px] uppercase tracking-wider leading-none mb-1">Released</p>
                          <span className="text-slate-500 text-xs">{releaseDate}</span>
                        </div>
                      )}
                      {set.images?.logo ? (
                        <img
                          src={set.images.logo}
                          alt={set.name}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      ) : (
                        <p className="text-white font-bold text-center text-sm">{set.name}</p>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-white text-sm font-semibold truncate mb-1.5">
                        {set.name}
                        {set.ptcgoCode && <span className="text-slate-500 font-normal ml-1">({set.ptcgoCode})</span>}
                      </p>
                      {showCollectionProgress && totalCards > 0 && (
                        <div className="mb-1.5">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-slate-400 text-xs">Progress</span>
                            <span className="text-white text-xs font-medium">{stats.count}/{totalCards} <span className="text-slate-500">({totalCards > 0 ? Math.round((stats.count / totalCards) * 100) : 0}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${Math.min(100, totalCards > 0 ? (stats.count / totalCards) * 100 : 0)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {!showCollectionProgress && (
                        <p className="text-slate-400 text-xs mb-0.5">
                          Progress: <span className="text-white font-medium">{stats.count}/{totalCards}</span>
                        </p>
                      )}
                      <p className="text-slate-400 text-xs">
                        Total Value: <span className="text-accent font-medium">{format(stats.value)}</span>
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BINDERS mode: binder grid ── */}
      {mode === 'folders' && !browsedBinder && (
        <div>
          {allBinders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
              <svg className="w-12 h-12 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <p className="text-lg mb-1">No binders yet</p>
              <p className="text-sm">Add cards to binders from your Collection or Watchlist</p>
            </div>
          ) : bindersFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <p className="text-lg">No binders match "{binderSearch}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {bindersFiltered.map((binder) => (
                <button
                  key={`${binder.section}:${binder.name}`}
                  onClick={() => setBrowsedBinder({ name: binder.name, section: binder.section })}
                  className="bg-surface-800 border border-surface-600 hover:border-accent/50 hover:bg-surface-700 rounded-xl overflow-hidden text-left transition-all group"
                >
                  <div className="bg-surface-900 h-24 flex items-center justify-center p-4 relative">
                    <svg className="w-10 h-10 text-slate-600 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                    </svg>
                    <div className="absolute top-2 right-2">
                      {binder.section === 'collection'
                        ? <span className="bg-accent/20 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">Collection</span>
                        : <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Watchlist</span>
                      }
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-white text-sm font-semibold truncate mb-1.5">{binder.name}</p>
                    <p className="text-slate-400 text-xs mb-0.5">
                      Cards: <span className="text-white font-medium">{binder.count}</span>
                    </p>
                    <p className="text-slate-400 text-xs">
                      Total Value: <span className="text-accent font-medium">{format(binder.value)}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BINDERS mode: browsing a binder — header ── */}
      {mode === 'folders' && browsedBinder && (
        <div className="flex items-center gap-4 bg-surface-800 border border-surface-600 rounded-xl p-4 mb-5">
          <button
            onClick={() => setBrowsedBinder(null)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Binders
          </button>
          <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg truncate">{browsedBinder.name}</h2>
            <p className="text-slate-500 text-xs">
              {browsedBinder.section === 'collection' ? 'Collection' : 'Watchlist'} · {browsedBinderCards.length} {browsedBinderCards.length === 1 ? 'card' : 'cards'}
            </p>
          </div>
          {browsedBinder.section === 'collection'
            ? <span className="bg-accent/20 text-accent text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">Collection</span>
            : <span className="bg-sky-500/20 text-sky-400 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0">Watchlist</span>
          }
        </div>
      )}

      {/* ── BINDERS mode: card grid ── */}
      {mode === 'folders' && browsedBinder && browsedBinderCards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-lg">No cards in this binder</p>
        </div>
      )}

      {/* ── SETS mode: browsing a specific set — header ── */}
      {mode === 'sets' && browsedSet && (
        <div className="flex items-center gap-4 bg-surface-800 border border-surface-600 rounded-xl p-4 mb-5">
          <button
            onClick={() => setBrowsedSet(null)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Sets
          </button>
          {browsedSet.images?.logo && (
            <img src={browsedSet.images.logo} alt={browsedSet.name} className="h-10 object-contain flex-shrink-0"
              onError={(e) => (e.target.style.display = 'none')} />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg truncate">{browsedSet.name}</h2>
            <p className="text-slate-500 text-xs">
              {browsedSet.releaseDate && `${browsedSet.releaseDate} · `}
              {(browsedSet.printedTotal || browsedSet.total || 0)} cards in set
            </p>
          </div>
          {setRarities.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <label className="text-slate-400 text-xs whitespace-nowrap">Rarity</label>
              <select
                value={setRarityFilter}
                onChange={(e) => setSetRarityFilter(e.target.value)}
                className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                <option value="">All Rarities</option>
                {setRarities.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-slate-400 text-xs whitespace-nowrap">Binder</label>
            <select
              value={setCollectionFilter}
              onChange={(e) => setSetCollectionFilter(e.target.value)}
              className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="">All Cards</option>
              <option value="owned">Owned</option>
              <option value="collection">In Collection</option>
              <option value="watchlist">In Watchlist</option>
              <option value="not_owned">Not Owned</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-slate-400 text-xs">Sort</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="name">Name (A → Z)</option>
              <option value="number_asc">Card Number (Low → High)</option>
              <option value="number_desc">Card Number (High → Low)</option>
              <option value="price">Price (High → Low)</option>
              <option value="price_low">Price (Low → High)</option>
            </select>
          </div>
        </div>
      )}

      {/* ── SEALED mode: results ── */}
      {mode === 'sealed' && (
        <div>
          {sealedLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-surface-600" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent animate-spin" />
              </div>
              <p className="text-slate-400 text-base font-medium tracking-wide">Searching for sealed products…</p>
            </div>
          )}

          {!sealedLoading && sealedResults.length === 0 && !sealedQuery && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
              <svg className="w-12 h-12 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-lg mb-1">Search for sealed products</p>
              <p className="text-sm">Elite Trainer Boxes, Booster Boxes, and more</p>
              <p className="text-xs mt-2 text-slate-700">Requires PriceCharting API token (set in Settings)</p>
            </div>
          )}

          {!sealedLoading && sealedResults.length === 0 && sealedQuery && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <p className="text-lg">No sealed products found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}

          {!sealedLoading && sealedResults.length > 0 && (
            <div className="flex flex-col gap-2">
              {sealedResults.map((product) => {
                const name = product['product-name'] || product.name || 'Unknown'
                const category = product['console-name'] || 'Sealed Product'
                const loosePrice = product['loose-price'] ? product['loose-price'] / 100 : null
                const newPrice = product['new-price'] ? product['new-price'] / 100 : null
                const displayPrice = loosePrice || newPrice
                const alreadyOwned = ownedCards.some((c) => c.pricechartingId === product.id)
                return (
                  <div
                    key={product.id}
                    className={`bg-surface-800 border rounded-xl px-4 py-3 flex items-center gap-4 ${alreadyOwned ? 'border-emerald-500/50' : 'border-surface-600'}`}
                  >
                    <div className="w-14 h-14 flex-shrink-0 bg-surface-700 rounded-lg overflow-hidden relative flex items-center justify-center">
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
                      <p className="text-white font-semibold text-sm truncate">{name}</p>
                      <p className="text-slate-500 text-xs">{category}</p>
                    </div>
                    {displayPrice != null && (
                      <p className="text-accent font-bold text-sm flex-shrink-0">{format(displayPrice)}</p>
                    )}
                    {alreadyOwned && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                        Owned
                      </span>
                    )}
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setSealedAddModal({ product, section: 'collection' })}
                        className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-black text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        + Collection
                      </button>
                      <button
                        onClick={() => setSealedAddModal({ product, section: 'watchlist' })}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        + Watchlist
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Cards-mode states ── */}
      {mode === 'cards' && error && <p className="text-red-400 text-center py-10">{error}</p>}
      {mode === 'sealed' && error && <p className="text-red-400 text-center py-10">{error}</p>}

      {mode === 'cards' && !hasSearched && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600">
          <svg className="w-12 h-12 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg mb-1">Search for any Pokémon card</p>
          <p className="text-sm">Filter by name, set, or rarity above</p>
        </div>
      )}

      {mode === 'cards' && hasSearched && !loading && results.length > 0 && nameQuery === '' && setQuery === '' && rarity === '' && (
        <p className="text-slate-500 text-sm mb-4">Showing top 20 Special Illustration Rares — use filters above to search for any card</p>
      )}

      {mode === 'cards' && !binderFilter && hasSearched && !loading && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-lg">No cards found</p>
          <p className="text-sm mt-1">Try adjusting your search terms</p>
        </div>
      )}
      {mode === 'cards' && binderFilter && !loading && binderResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-lg">No cards in {binderFilter.startsWith('binder:') ? binderFilter.slice(7) : binderFilter === 'collection' ? 'Collection' : 'Watchlist'}</p>
          <p className="text-sm mt-1">Add cards from the search results above</p>
        </div>
      )}

      {mode === 'sets' && browsedSet && !loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-lg">No cards found for {browsedSet.name}</p>
        </div>
      )}

      {(mode === 'cards' || browsedSet) && loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-surface-600" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent animate-spin" />
          </div>
          <p className="text-slate-400 text-base font-medium tracking-wide">
            {browsedSet ? `Loading ${browsedSet.name} cards…` : 'Searching for cards…'}
          </p>
        </div>
      )}

      {/* Binder browse card grid — standalone, no dependency on search state */}
      {mode === 'folders' && browsedBinder && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {browsedBinderCards.map((card) => {
            // Use _owned directly when possible; fall back to tcgId search for cross-section entries
            const collectionEntry = card._owned?.section === 'collection'
              ? card._owned
              : (card.id ? ownedCards.find((c) => c.tcgId === card.id && c.section === 'collection') : null)
            const watchlistEntry = card._owned?.section !== 'collection'
              ? card._owned
              : (card.id ? ownedCards.find((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist')) : null)
            const inPortfolio = !!collectionEntry
            const inWatchlist = !!watchlistEntry
            const price = cardPrice(card)

            async function removeEntry(entry) {
              if (!entry) return
              await window.api.removeCard(entry.id)
              onCardAdded()
              loadOwnedCards()
            }

            return (
              <div key={card._owned?.id ?? card.id} className={`relative bg-surface-800 rounded-xl p-3 flex flex-col transition-colors ${inPortfolio || inWatchlist ? 'border-2 border-emerald-500/70 hover:border-emerald-400/80' : 'border border-surface-600 hover:border-surface-500'}`}>
                {favNames.some((n) => { const cn = (card.name || '').toLowerCase(); const fn = (n || '').toLowerCase(); return cn === fn || cn.startsWith(fn + ' ') || cn.startsWith(fn + '-') }) && (
                  <span className="absolute top-1.5 right-1.5 text-yellow-400 text-sm leading-none pointer-events-none z-10">★</span>
                )}
                <div
                  className="flex justify-center h-36 items-center mb-2 cursor-pointer"
                  onClick={() => setLightboxCard(card)}
                >
                  <img
                    src={card.images?.small} alt={card.name}
                    className="max-h-full object-contain rounded hover:opacity-90 transition-opacity"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                </div>
                <p className="text-white text-sm font-semibold leading-tight mb-0.5 text-center truncate">{card.name}{card.number ? ` #${card.number}` : ''}</p>
                <p className="text-slate-400 text-xs mb-0.5 text-center truncate">{card.set?.name}{card.rarity ? ` · ${card.rarity}` : ''}</p>
                {price != null && (
                  <span className="self-start text-xs font-semibold px-1.5 py-0.5 rounded-full bg-surface-700 text-slate-300 mt-1">
                    {format(price)} RAW
                  </span>
                )}
                <div className="mt-auto flex gap-1.5 pt-2">
                  {inPortfolio ? (
                    <div className="flex-1 flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg px-2.5 py-1.5">
                      <span className="text-accent text-xs font-bold">✓ Collection</span>
                      <button
                        onClick={() => removeEntry(collectionEntry)}
                        className="text-accent/50 hover:text-red-400 transition-colors text-base leading-none ml-1 flex-shrink-0"
                        title="Remove from Collection"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddModal({ card, section: 'collection' })}
                      className="flex-1 bg-accent hover:bg-accent-hover text-black text-xs font-bold py-1.5 rounded-lg transition-colors"
                    >
                      + Collection
                    </button>
                  )}
                  {inWatchlist ? (
                    <div className="flex-1 flex items-center justify-between bg-sky-500/10 border border-sky-500/30 rounded-lg px-2.5 py-1.5">
                      <span className="text-sky-400 text-xs font-bold">✓ Watchlist</span>
                      <button
                        onClick={() => removeEntry(watchlistEntry)}
                        className="text-sky-400/50 hover:text-red-400 transition-colors text-base leading-none ml-1 flex-shrink-0"
                        title="Remove from Watchlist"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddModal({ card, section: 'watchlist' })}
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                    >
                      + Watchlist
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cards mode + set browse card grid */}
      {!loading && baseResults.length > 0 && (mode === 'cards' || browsedSet) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayResults.map((card) => {
            const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
            const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
            const price = cardPrice(card)
            return (
              <div key={card.id} className={`relative bg-surface-800 rounded-xl p-3 flex flex-col transition-colors ${inPortfolio || inWatchlist ? 'border-2 border-emerald-500/70 hover:border-emerald-400/80' : 'border border-surface-600 hover:border-surface-500'}`}>
                {favNames.some((n) => { const cn = (card.name || '').toLowerCase(); const fn = (n || '').toLowerCase(); return cn === fn || cn.startsWith(fn + ' ') || cn.startsWith(fn + '-') }) && (
                  <span className="absolute top-1.5 right-1.5 text-yellow-400 text-sm leading-none pointer-events-none z-10">★</span>
                )}
                <div
                  className="flex justify-center h-36 items-center mb-2 cursor-pointer"
                  onClick={() => setLightboxCard(card)}
                >
                  <img
                    src={card.images?.small} alt={card.name}
                    className="max-h-full object-contain rounded hover:opacity-90 transition-opacity"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                </div>
                <p className="text-white text-sm font-semibold leading-tight mb-0.5 text-center truncate">{card.name}{card.number ? ` #${card.number}` : ''}</p>
                <p className="text-slate-400 text-xs mb-0.5 text-center truncate">{card.set?.name}{card.rarity ? ` · ${card.rarity}` : ''}</p>
                {price != null && (
                  <span className="self-start text-xs font-semibold px-1.5 py-0.5 rounded-full bg-surface-700 text-slate-300 mt-1">
                    {format(price)} RAW
                  </span>
                )}
                <div className="mt-auto flex gap-1.5 pt-2">
                  {inPortfolio ? (
                    <div className="flex-1 flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg px-2.5 py-1.5">
                      <span className="text-accent text-xs font-bold">✓ Collection</span>
                      <button
                        onClick={() => handleRemove(card, 'collection')}
                        className="text-accent/50 hover:text-red-400 transition-colors text-base leading-none ml-1 flex-shrink-0"
                        title="Remove from Collection"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddModal({ card, section: 'collection' })}
                      className="flex-1 bg-accent hover:bg-accent-hover text-black text-xs font-bold py-1.5 rounded-lg transition-colors"
                    >
                      + Collection
                    </button>
                  )}
                  {inWatchlist ? (
                    <div className="flex-1 flex items-center justify-between bg-sky-500/10 border border-sky-500/30 rounded-lg px-2.5 py-1.5">
                      <span className="text-sky-400 text-xs font-bold">✓ Watchlist</span>
                      <button
                        onClick={() => handleRemove(card, 'watchlist')}
                        className="text-sky-400/50 hover:text-red-400 transition-colors text-base leading-none ml-1 flex-shrink-0"
                        title="Remove from Watchlist"
                      >×</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddModal({ card, section: 'watchlist' })}
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                    >
                      + Watchlist
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addModal && (
        <AddModal
          card={addModal.card}
          section={addModal.section}
          onAdd={handleCardAdded}
          onClose={() => setAddModal(null)}
        />
      )}

      {sealedAddModal && (
        <SealedAddModal
          product={sealedAddModal.product}
          section={sealedAddModal.section}
          onAdd={() => { handleCardAdded(); setSealedAddModal(null) }}
          onClose={() => setSealedAddModal(null)}
        />
      )}

      {lightboxCard && (
        <CardDetailModal
          card={lightboxCard}
          ownedCards={ownedCards}
          onAdd={handleCardAdded}
          onRemove={handleRemove}
          onClose={() => setLightboxCard(null)}
          onFilterByArtist={handleFilterByArtist}
        />
      )}
    </div>
  )
}
