import { useState, useEffect, useRef, useMemo } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import BinderSelector from '../components/BinderSelector'
import PriceChart from '../components/PriceChart'

const CONDITIONS = [
  { value: 'raw',   label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9',  label: 'PSA 9' },
  { value: 'psa8',  label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9',  label: 'CGC 9' },
]

const RARITIES = [
  { value: '', label: 'All Rarities' },
  { value: 'ACE SPEC Rare', label: 'ACE SPEC Rare' },
  { value: 'Amazing Rare', label: 'Amazing Rare' },
  { value: 'Common', label: 'Common' },
  { value: 'Double Rare', label: 'Double Rare' },
  { value: 'Hyper Rare', label: 'Hyper Rare' },
  { value: 'Illustration Rare', label: 'Illustration Rare' },
  { value: 'Promo', label: 'Promo' },
  { value: 'Radiant Rare', label: 'Radiant Rare' },
  { value: 'Rare', label: 'Rare' },
  { value: 'Rare BREAK', label: 'Rare BREAK' },
  { value: 'Rare Holo', label: 'Rare Holo' },
  { value: 'Rare Prism Star', label: 'Rare Prism Star' },
  { value: 'Rare Secret', label: 'Rare Secret' },
  { value: 'Rare Ultra', label: 'Rare Ultra' },
  { value: 'Shiny Rare', label: 'Shiny Rare' },
  { value: 'Shiny Ultra Rare', label: 'Shiny Ultra Rare' },
  { value: 'Special Illustration Rare', label: 'Special Illustration Rare' },
  { value: 'Ultra Rare', label: 'Ultra Rare' },
  { value: 'Uncommon', label: 'Uncommon' },
]

let popularCache = null

const VARIANT_LABELS = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse Holo', firstEdition: '1st Edition', wPromo: 'Promo' }

const VARIANT_BADGE_LIST = [
  { key: 'normal',       label: 'Normal',    cls: 'bg-slate-600/80 text-slate-100' },
  { key: 'firstEdition', label: '1st Ed',    cls: 'bg-yellow-700/80 text-yellow-100' },
  { key: 'holo',         label: 'Holo',      cls: 'bg-blue-700/80 text-blue-100' },
  { key: 'reverse',      label: 'Rev. Holo', cls: 'bg-purple-700/80 text-purple-100' },
  { key: 'wPromo',       label: 'W Promo',   cls: 'bg-emerald-700/80 text-emerald-100' },
]

function VariantBadges({ variants, className = '' }) {
  const active = variants ? VARIANT_BADGE_LIST.filter((v) => variants[v.key]) : []
  if (!active.length) return null
  return (
    <div className={`flex flex-wrap gap-0.5 items-center ${className}`}>
      {active.map((v) => (
        <span key={v.key} className={`text-[10px] font-semibold px-1 py-0.5 rounded leading-none ${v.cls}`}>
          {v.label}
        </span>
      ))}
    </div>
  )
}

const ENERGY_TYPES = ['Colorless','Darkness','Dragon','Fairy','Fighting','Fire','Grass','Lightning','Metal','Psychic','Water']

function formatVariants(variants) {
  if (!variants) return '—'
  const active = Object.entries(variants).filter(([, v]) => v).map(([k]) => VARIANT_LABELS[k] || k)
  return active.length ? active.join(', ') : '—'
}

function cardPrice(card) {
  return card.cardmarket?.prices?.averageSellPrice
    ?? card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null
}

const FAV_KEY = 'pokeprice-favorites'
function getFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '{}') } catch { return {} } }
function saveFavs(f) { localStorage.setItem(FAV_KEY, JSON.stringify(f)); window.dispatchEvent(new Event('pokeprice-favs')) }

export function CardDetailModal({ card, ownedCards, onAdd, onRemove, onClose, onFilterByArtist }) {
  const { format } = useCurrency()
  const [addingSection, setAddingSection] = useState(null)
  const [favs, setFavs] = useState(getFavs)
  useEffect(() => {
    const update = () => setFavs(getFavs())
    window.addEventListener('pokeprice-favs', update)
    return () => window.removeEventListener('pokeprice-favs', update)
  }, [])
  const favKey = (card.name || '').toLowerCase().replace(/\s+/g, '-')
  const isFav = !!favs[favKey]
  function toggleFav() {
    const f = getFavs()
    if (f[favKey]) delete f[favKey]; else f[favKey] = card.name
    saveFavs(f)
    window.api.appendActivity({
      type: isFav ? 'pokemon_unfavorited' : 'pokemon_favorited',
      message: isFav ? `Unfavorited ${card.name}` : `Favorited ${card.name}`,
    }).catch(() => {})
  }
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const [inspecting, setInspecting] = useState(false)
  const [inspectTilt, setInspectTilt] = useState({ x: 0, y: 0 })
  const [priceHistory, setPriceHistory] = useState([])
  const [sbPrice, setSbPrice] = useState(null)
  const [sbHistory, setSbHistory] = useState([])
  const [chartRange, setChartRange] = useState(90)
  const imgRef = useRef(null)
  const inspectImgRef = useRef(null)

  const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
  const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
  const ownedEntry = ownedCards.find((c) => c.tcgId === card.id)
  const price = cardPrice(card) ?? (ownedEntry?.currentPrice ?? sbPrice ?? null)
  const displayHistory = ownedEntry?.id ? priceHistory : sbHistory

  useEffect(() => {
    setSbPrice(null)
    setSbHistory([])
    if (ownedEntry?.id) {
      window.api.getPriceHistory(ownedEntry.id).then(setPriceHistory).catch(() => {})
    } else {
      setPriceHistory([])
      if (card.name && card.number) {
        window.api.getPriceForTcgCard({ name: card.name, number: card.number, setName: card.set?.name })
          .then(({ current, history }) => {
            setSbPrice(current?.['Ungraded'] ?? null)
            setSbHistory(history ?? [])
          })
          .catch(() => {})
      }
    }
  }, [ownedEntry?.id, card.id])

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
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <button
                  onClick={toggleFav}
                  title={isFav ? `Unfavorite ${card.name}` : `Favorite ${card.name}`}
                  className={`flex-shrink-0 flex items-center justify-center text-2xl transition-colors ${isFav ? 'text-yellow-400 hover:text-yellow-300' : 'text-slate-600 hover:text-yellow-400'}`}
                >
                  {isFav ? '★' : '☆'}
                </button>
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
                  <p className="text-white text-sm">
                    {card.set
                      ? (card.set.series && card.set.series !== card.set.name
                          ? `${card.set.series} - ${card.set.name}`
                          : card.set.name || '—')
                      : '—'}
                  </p>
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
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Variant</p>
                  <p className="text-white text-sm">{formatVariants(card.variants)}</p>
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
                    history={displayHistory}
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
  const [alertPrice, setAlertPrice] = useState('')
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
      const parsedAlert = alertPrice !== '' ? parseFloat(alertPrice) : null
      const targets = {}
      if (parsedAlert != null && parsedAlert > 0) {
        targets.alertPrice = Math.round(parsedAlert * 100) / 100
      }

      if (newCard?.id && !targets.alertPrice) {
        const settings = await window.api.getSettings()
        const history = await window.api.getPriceHistory(newCard.id)
        const latestPrice = history[history.length - 1]?.price
        if (latestPrice != null) {
          if (settings.defaultAlertUpPct != null) {
            targets.alertPrice = Math.round(latestPrice * (1 + settings.defaultAlertUpPct / 100) * 100) / 100
            targets.alertPct = settings.defaultAlertUpPct
          } else if (settings.defaultAlertDownPct != null) {
            targets.alertPrice = Math.round(latestPrice * (1 - settings.defaultAlertDownPct / 100) * 100) / 100
            targets.alertPct = -settings.defaultAlertDownPct
          }
        }
      } else if (targets.alertPrice && newCard?.id) {
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-accent text-sm mb-1.5 block font-medium">Price Alert (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">$</span>
                  <input
                    type="number" min="0.01" step="0.01" value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                  />
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
  const [alertPrice, setAlertPrice] = useState('')
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
      const parsedAlert = alertPrice !== '' ? parseFloat(alertPrice) : null
      const targets = {}
      if (parsedAlert != null && parsedAlert > 0) {
        targets.alertPrice = Math.round(parsedAlert * 100) / 100
        const history = await window.api.getPriceHistory(newItem.id)
        const latestPrice = history[history.length - 1]?.price
        if (latestPrice != null) {
          targets.alertPct = Math.round((targets.alertPrice - latestPrice) / latestPrice * 1000) / 10
        }
      }
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">$</span>
                    <input
                      type="number" min="0.01" step="0.01" value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-accent text-sm mb-1.5 block font-medium">Price Alert (optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">$</span>
                  <input
                    type="number" min="0.01" step="0.01" value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-7 pr-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
                  />
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
  const [sortOrder,  setSortOrder]  = useState('released_desc')
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
  const [energyTypeFilter, setEnergyTypeFilter] = useState('')
  const [cardTypeFilter, setCardTypeFilter] = useState('')
  const [variationFilter, setVariationFilter] = useState('')
  const [illustratorFilter, setIllustratorFilter] = useState('')
  const [cardDetails, setCardDetails] = useState({})
  const [viewMode, setViewMode] = useState('grid')
  const [searchBinderPage, setSearchBinderPage] = useState(0)
  const [browsedBinderPage, setBrowsedBinderPage] = useState(0)
  const [binderCardOrder, setBinderCardOrder] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [confirmDeleteBinder, setConfirmDeleteBinder] = useState(false)
  const dragSrcRef = useRef(null)
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
      setMode('cards')
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
      .then((cards) => {
        // All cards in a set share the same series — stamp it directly so it shows immediately
        const series = browsedSet.series
        const withSeries = series
          ? cards.map((c) => c._divider ? c : { ...c, set: { ...c.set, series: c.set?.series || series } })
          : cards
        setResults(withSeries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [browsedSet])

  useEffect(() => {
    if (!browsedSet) return
    window.history.pushState({ pokeprice: 'browsedSet' }, '')
    function handlePopState() { setBrowsedSet(null) }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [browsedSet])

  useEffect(() => {
    if (!browsedBinder) return
    window.history.pushState({ pokeprice: 'browsedBinder' }, '')
    function handlePopState() { setBrowsedBinder(null) }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [browsedBinder])

  useEffect(() => {
    if (!browsedBinder) { setBinderCardOrder(null); setBrowsedBinderPage(0); setConfirmDeleteBinder(false); return }
    try {
      const key = `pokeprice-binder-order-${browsedBinder.section}-${encodeURIComponent(browsedBinder.name)}`
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      setBinderCardOrder(saved)
    } catch { setBinderCardOrder(null) }
    setBrowsedBinderPage(0)
  }, [browsedBinder])

  // Background-fetch full card details (list endpoint omits rarity, artist, series, variants)
  // — mirrors Pokedex's cardDetails pattern exactly
  useEffect(() => {
    setCardDetails({})
    const queue = results.filter((c) => !c._divider)
    if (!queue.length) return
    let cancelled = false
    const CONCURRENCY = 8

    async function worker() {
      while (queue.length && !cancelled) {
        const card = queue.shift()
        try {
          const fetched = await window.api.searchCardsAdvanced(`id:"${card.id}"`)
          if (!cancelled && fetched[0]) {
            const { rarity, artist, types, variants, set } = fetched[0]
            setCardDetails((prev) => ({ ...prev, [card.id]: { rarity, artist, types, variants, series: set?.series || '' } }))
          }
        } catch {}
      }
    }

    Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
    return () => { cancelled = true }
  }, [results])

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

  async function runSearch(name = nameQuery, set = setQuery, rar = rarity, artist = artistFilter, energyType = energyTypeFilter, cType = cardTypeFilter) {
    const extraParts = []
    if (set.trim())    extraParts.push(`set.name:"${set.trim()}"`)
    if (rar)           extraParts.push(`rarity:"${rar}"`)
    if (artist.trim()) extraParts.push(`artist:"${artist.trim()}"`)
    if (energyType)    extraParts.push(`types:"${energyType}"`)
    if (cType === 'Pokemon')    extraParts.push(`supertype:"Pokémon"`)
    else if (cType === 'Energy') extraParts.push(`supertype:"Energy"`)
    else if (cType === 'Item')   extraParts.push(`supertype:"Trainer" subtypes:"Item"`)
    else if (cType === 'Supporter') extraParts.push(`supertype:"Trainer" subtypes:"Supporter"`)
    else if (cType === 'Stadium')   extraParts.push(`supertype:"Trainer" subtypes:"Stadium"`)
    else if (cType === 'Tool')      extraParts.push(`supertype:"Trainer" subtypes:"Tool"`)

    const q = name.trim()
    if (!q && !extraParts.length) return

    // Append active dropdown filters to any query string
    const searchWith = (queryStr) =>
      window.api.searchCardsAdvanced([queryStr, ...extraParts].join(' ')).catch(() => [])

    setLoading(true)
    setError(null)
    setHasSearched(true)
    setSealedResults([])
    try {
      let merged = []

      if (!q) {
        // Filters only — no name query
        merged = await window.api.searchCardsAdvanced(extraParts.join(' ')).catch(() => [])
      } else {
        const hashMatch = q.match(/^(.*?)\s*#(\w+)\s*$/)
        if (hashMatch) {
          const namePart = hashMatch[1].trim()
          const rawNum = hashMatch[2]
          const targetNum = parseInt(rawNum, 10)
          const isNumeric = !isNaN(targetNum)
          if (namePart) {
            // Run both a direct name+number API query and a broader name-only query in parallel
            const [directMatches, allCards] = await Promise.all([
              searchWith(`name:"${namePart}*" number:"${rawNum}"`),
              searchWith(`name:"${namePart}*"`),
            ])
            const seen = new Set()
            const matched = []; const rest = []
            for (const c of directMatches) {
              if (!seen.has(c.id)) { seen.add(c.id); matched.push(c) }
            }
            for (const c of allCards) {
              if (seen.has(c.id)) continue
              seen.add(c.id)
              const cn = String(c.number || '')
              const hits = isNumeric ? parseInt(cn, 10) === targetNum : cn.toUpperCase() === rawNum.toUpperCase()
              ;(hits ? matched : rest).push(c)
            }
            merged = matched.length > 0 && rest.length > 0
              ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
              : [...matched, ...rest]
          } else {
            const numVariants = isNumeric
              ? [...new Set([rawNum, String(targetNum), String(targetNum).padStart(3, '0')])]
              : [rawNum]
            const seen = new Set()
            const batches = await Promise.all(numVariants.map((v) => searchWith(`number:"${v}"`)))
            for (const batch of batches) for (const c of batch) if (!seen.has(c.id)) { seen.add(c.id); merged.push(c) }
          }
        } else {
          const trailingMatch = q.match(/^(.+?)\s+(\d+)\s*$/)
          if (trailingMatch) {
            const namePart = trailingMatch[1].trim()
            const rawNum = trailingMatch[2]
            const targetNum = parseInt(rawNum, 10)
            const hasSetFilter = !!set.trim()
            // Only try trailing-as-set-name when no set is already selected in the dropdown
            const [allCards, setCards] = await Promise.all([
              searchWith(`name:"${namePart}*"`),
              hasSetFilter ? Promise.resolve([]) : searchWith(`name:"${namePart}*" set.name:"${rawNum}"`)
            ])
            const seen = new Set()
            const matched = []; const rest = []
            for (const c of allCards) if (parseInt(String(c.number || ''), 10) === targetNum && !seen.has(c.id)) { seen.add(c.id); matched.push(c) }
            for (const c of setCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
            for (const c of allCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
            merged = matched.length > 0 && rest.length > 0
              ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
              : [...matched, ...rest]
          } else {
            // Plain text — try name, set.name, and every word-split name+set combo
            const words = q.split(/\s+/)
            const hasSetFilter = !!set.trim()
            const allSearches = [searchWith(`name:"${q}*"`)]
            if (!hasSetFilter) {
              allSearches.push(searchWith(`set.name:"${q}"`))
              for (let i = 1; i < words.length; i++) {
                const namePart = words.slice(0, i).join(' ')
                const setPart = words.slice(i).join(' ')
                allSearches.push(searchWith(`name:"${namePart}*" set.name:"${setPart}"`))
              }
            }
            const seen = new Set()
            const batches = await Promise.all(allSearches)
            for (const batch of batches) for (const c of batch) if (!seen.has(c.id)) { seen.add(c.id); merged.push(c) }
          }
        }
      }

      if (rar) merged = merged.filter((c) => c._divider || c.rarity === rar)
      setResults(merged)
      // Always search sealed products in parallel when there's a name query
      if (q) runSealedSearch(q, true)
    } catch {
      setError('Search failed. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  async function openCardModal(card) {
    setLightboxCard(card)
    if (card.id && !card.rarity && !card.artist && !card.types?.length) {
      const results = await window.api.searchCardsAdvanced(`id:"${card.id}"`).catch(() => [])
      const fetched = results?.[0]
      if (fetched) {
        setLightboxCard((prev) => (prev?.id === card.id ? fetched : prev))
      }
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

  async function runSealedSearch(queryOverride, isSilent = false) {
    const q = (queryOverride ?? sealedQuery).trim()
    if (!q) return
    setSealedLoading(true)
    setSealedResults([])
    if (!isSilent) setError(null)
    try {
      const { products, error: err } = await window.api.searchSealed(q)
      if (err === 'no_token') {
        if (!isSilent) setError('PriceCharting API token required — add it in Settings.')
      } else {
        setSealedResults(products || [])
      }
    } catch {
      if (!isSilent) setError('Sealed product search failed.')
    } finally {
      setSealedLoading(false)
    }
  }

  const canSearch = nameQuery.trim() || setQuery.trim() || rarity || binderFilter || artistFilter.trim() || energyTypeFilter || cardTypeFilter

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

  // Mirror Pokedex visibleCards: spread cardDetails into each card, merge series into card.set
  const enrichedBaseResults = useMemo(() =>
    baseResults.map((c) => {
      if (c._divider) return c
      const detail = cardDetails[c.id]
      if (!detail) return c
      const { series: enrichedSeries, ...restDetail } = detail
      return {
        ...c,
        ...restDetail,
        set: enrichedSeries ? { ...c.set, series: enrichedSeries } : c.set,
      }
    }), [baseResults, cardDetails])

  const setStats = useMemo(() => {
    const stats = {}
    ownedCards.forEach((c) => {
      if (!c.setName) return
      if (c.section !== 'collection') return
      if (!stats[c.setName]) stats[c.setName] = { count: 0, value: 0 }
      stats[c.setName].count++
      stats[c.setName].value += c.currentPrice ?? 0
    })
    return stats
  }, [ownedCards])

  const allSeries = useMemo(() => {
    const s = new Set(
      allSets
        .map((s) => s.series)
        .filter((series) => {
          if (!series) return false
          const sl = series.toLowerCase()
          if (sl.includes('mcdonald') || sl.includes('pocket')) return false
          return true
        })
    )
    return Array.from(s).sort()
  }, [allSets])

  const allYears = useMemo(() => {
    const y = new Set(
      allSets.map((s) => (s.releaseDate || '').split('/')[0].split('-')[0]).filter(Boolean)
    )
    return Array.from(y).sort().reverse()
  }, [allSets])

  const setDateMap = useMemo(() => new Map(allSets.map((s) => [s.id, s.releaseDate || ''])), [allSets])

  const uniqueArtists = useMemo(() => {
    const vals = results.filter((c) => !c._divider).map((c) => cardDetails[c.id]?.artist || c.artist).filter(Boolean)
    return [...new Set(vals)].sort()
  }, [results, cardDetails])

  const setsFiltered = useMemo(() => {
    const q = setsQuery.trim().toLowerCase()
    return [...allSets]
      .filter((s) => {
        const nameLower = (s.name || '').toLowerCase()
        const seriesLower = (s.series || '').toLowerCase()
        if (nameLower.includes("mcdonald") || seriesLower.includes("mcdonald")) return false
        if (seriesLower.includes("pocket")) return false
        if (q && !nameLower.includes(q)) return false
        if (seriesFilter && s.series !== seriesFilter) return false
        if (yearFilter) {
          const year = (s.releaseDate || '').split('/')[0].split('-')[0]
          if (year !== yearFilter) return false
        }
        return true
      })
      .sort((a, b) => {
        const da = a.releaseDate ? new Date(a.releaseDate.replace(/\//g, '-')).getTime() : 0
        const db = b.releaseDate ? new Date(b.releaseDate.replace(/\//g, '-')).getTime() : 0
        return db - da
      })
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
      const coverImages = cards.map((c) => c.imageUrl).filter(Boolean).slice(0, 4)
      entries.push({ name, section: 'collection', count: cards.length, value: cards.reduce((s, c) => s + (c.currentPrice ?? 0), 0), coverImages })
    })
    watchlistBinders.forEach((name) => {
      const cards = ownedCards.filter((c) => (c.binder || c.folder) === name && (!c.section || c.section === 'watchlist'))
      const coverImages = cards.map((c) => c.imageUrl).filter(Boolean).slice(0, 4)
      entries.push({ name, section: 'watchlist', count: cards.length, value: cards.reduce((s, c) => s + (c.currentPrice ?? 0), 0), coverImages })
    })
    return entries.sort((a, b) => a.name.localeCompare(b.name) || a.section.localeCompare(b.section))
  }, [portfolioBinders, watchlistBinders, ownedCards])

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

  const orderedBinderCards = useMemo(() => {
    if (!browsedBinder || !binderCardOrder) return browsedBinderCards
    const posMap = new Map(binderCardOrder.map((id, idx) => [id, idx]))
    return [...browsedBinderCards].sort((a, b) => {
      const pa = posMap.has(a._owned?.id) ? posMap.get(a._owned.id) : Infinity
      const pb = posMap.has(b._owned?.id) ? posMap.get(b._owned.id) : Infinity
      return pa - pb
    })
  }, [browsedBinder, browsedBinderCards, binderCardOrder])

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

  const sortCompareFn = (a, b) => {
    if (sortOrder === 'name')         return a.name.localeCompare(b.name)
    if (sortOrder === 'set_asc') {
      const setCmp = (a.set?.name ?? '').localeCompare(b.set?.name ?? '')
      return setCmp !== 0 ? setCmp : parseCardNum(a.number) - parseCardNum(b.number)
    }
    if (sortOrder === 'number_asc')   return parseCardNum(a.number) - parseCardNum(b.number)
    if (sortOrder === 'number_desc')  return parseCardNum(b.number) - parseCardNum(a.number)
    if (sortOrder === 'price')        return (cardPrice(b) ?? -Infinity) - (cardPrice(a) ?? -Infinity)
    if (sortOrder === 'price_low')    return (cardPrice(a) ?? Infinity)  - (cardPrice(b) ?? Infinity)
    if (sortOrder === 'released_desc' || sortOrder === 'released_asc') {
      const da = setDateMap.get(a.set?.id) || ''
      const db = setDateMap.get(b.set?.id) || ''
      const cmp = db.localeCompare(da)
      return sortOrder === 'released_desc' ? cmp : -cmp
    }
    return 0
  }
  const _divIdx = enrichedBaseResults.findIndex((c) => c._divider)
  const sortedResults = _divIdx === -1
    ? [...enrichedBaseResults].sort(sortCompareFn)
    : [
        ...[...enrichedBaseResults.slice(0, _divIdx)].sort(sortCompareFn),
        { _divider: true, id: '__divider__' },
        ...[...enrichedBaseResults.slice(_divIdx + 1)].sort(sortCompareFn),
      ]

  const displayResults = useMemo(() => {
    let base = sortedResults
    if (variationFilter) {
      base = base.filter((card) => card._divider || card.variants?.[variationFilter] === true)
    }
    if (illustratorFilter) {
      base = base.filter((card) => card._divider || card.artist === illustratorFilter)
    }
    if (!browsedSet) return base
    return base.filter((card) => {
      if (card._divider) return true
      if (setRarityFilter && card.rarity !== setRarityFilter) return false
      if (setCollectionFilter === 'owned')      return ownedCards.some((c) => c.tcgId === card.id)
      if (setCollectionFilter === 'collection') return ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
      if (setCollectionFilter === 'watchlist')  return ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
      if (setCollectionFilter === 'not_owned')  return !ownedCards.some((c) => c.tcgId === card.id)
      return true
    })
  }, [sortedResults, variationFilter, illustratorFilter, setRarityFilter, setCollectionFilter, ownedCards, browsedSet])

  return (
    <div>
      {/* ── Search / filter bar — always visible ── */}
      <div className="bg-surface-800 border border-surface-600 rounded-xl p-4 mb-5">
        <div className="flex flex-col gap-3">

          {/* ── Row 1: mode toggle + primary search controls ── */}
          <div className="flex gap-3 items-end flex-wrap">

            {/* Mode toggle — always leftmost */}
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

            {/* Cards mode — row 1 */}
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
                        placeholder="Search by name or code (e.g. SWSH)…"
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
                        .filter((s) => {
                          const q = setSearch.toLowerCase()
                          return s.name.toLowerCase().includes(q) || (s.ptcgoCode || '').toLowerCase().includes(q)
                        })
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSetQuery(s.name); setSetDropdownOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-600 transition-colors flex items-center justify-between gap-2 ${setQuery === s.name ? 'text-accent' : 'text-white'}`}
                          >
                            <span className="truncate">{s.name}</span>
                            {s.ptcgoCode && <span className="text-slate-500 text-xs flex-shrink-0">{s.ptcgoCode}</span>}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
              <div className="w-48 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Sort By</label>
                <select
                  value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="released_desc">Released (Newest First)</option>
                  <option value="released_asc">Released (Oldest First)</option>
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
                  className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  {loading ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                    </svg>
                  )}
                  <span>{loading ? 'Searching…' : 'Search'}</span>
                </button>
                <button
                  onClick={() => {
                    setNameQuery('')
                    setSetQuery('')
                    setRarity('')
                    setBinderFilter('')
                    setArtistFilter('')
                    setEnergyTypeFilter('')
                    setCardTypeFilter('')
                    setVariationFilter('')
                    setIllustratorFilter('')
                    setSortOrder('released_desc')
                    setError(null)
                    loadPopular()
                  }}
                  className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-slate-300 font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </>}

            {/* Sets mode */}
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

            {/* Sealed mode */}
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

            {/* Binders mode */}
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

          {/* ── Row 2: secondary filters (Items mode only) ── */}
          {mode === 'cards' && (
            <div className="flex gap-3 items-end flex-wrap">
              <div className="w-52 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Rarity</label>
                <select
                  value={rarity} onChange={(e) => {
                    const v = e.target.value
                    setRarity(v)
                    if (hasSearched && (nameQuery.trim() || setQuery.trim() || v || artistFilter.trim())) {
                      runSearch(nameQuery, setQuery, v, artistFilter)
                    }
                  }}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  {RARITIES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="w-44 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Variations</label>
                <select
                  value={variationFilter} onChange={(e) => setVariationFilter(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">All Variations</option>
                  <option value="normal">Normal</option>
                  <option value="holo">Holo</option>
                  <option value="reverse">Reverse Holo</option>
                  <option value="firstEdition">1st Edition</option>
                  <option value="wPromo">W Promo</option>
                </select>
              </div>
              <div className="w-44 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Energy Type</label>
                <select
                  value={energyTypeFilter} onChange={(e) => {
                    const v = e.target.value
                    setEnergyTypeFilter(v)
                    if (hasSearched && (nameQuery.trim() || setQuery.trim() || rarity || artistFilter.trim() || v || cardTypeFilter)) {
                      runSearch(nameQuery, setQuery, rarity, artistFilter, v, cardTypeFilter)
                    }
                  }}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">All Types</option>
                  {ENERGY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="w-44 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Card Type</label>
                <select
                  value={cardTypeFilter} onChange={(e) => {
                    const v = e.target.value
                    setCardTypeFilter(v)
                    if (hasSearched && (nameQuery.trim() || setQuery.trim() || rarity || artistFilter.trim() || energyTypeFilter || v)) {
                      runSearch(nameQuery, setQuery, rarity, artistFilter, energyTypeFilter, v)
                    }
                  }}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">All Card Types</option>
                  <option value="Pokemon">Pokémon</option>
                  <option value="Energy">Energy</option>
                  <option value="Item">Item</option>
                  <option value="Supporter">Supporter</option>
                  <option value="Stadium">Stadium</option>
                  <option value="Tool">Tool</option>
                </select>
              </div>
              <div className="w-48 flex-shrink-0">
                <label className="text-slate-400 text-xs mb-1.5 block uppercase tracking-wider font-medium">Illustrator</label>
                <select
                  value={illustratorFilter} onChange={(e) => setIllustratorFilter(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">All Illustrators</option>
                  {uniqueArtists.map((a) => <option key={a} value={a}>{a}</option>)}
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
              <div className="ml-auto flex items-center self-end flex-shrink-0">
                <div className="flex items-center rounded-lg border border-surface-600 overflow-hidden text-xs">
                  {[
                    { mode: 'grid', label: 'Grid', icon: (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                        <rect x="1" y="1" width="6" height="6" rx="1" />
                        <rect x="9" y="1" width="6" height="6" rx="1" />
                        <rect x="1" y="9" width="6" height="6" rx="1" />
                        <rect x="9" y="9" width="6" height="6" rx="1" />
                      </svg>
                    )},
                    { mode: 'table', label: 'Table', icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                      </svg>
                    )},
                    { mode: 'binder', label: 'Binder', icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    )},
                  ].map((v) => (
                    <button
                      key={v.mode}
                      onClick={() => { setViewMode(v.mode); setSearchBinderPage(0) }}
                      className={`flex items-center gap-1.5 px-3 py-2 font-medium transition-colors ${
                        viewMode === v.mode
                          ? 'bg-surface-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-surface-700 bg-surface-800'
                      }`}
                    >
                      {v.icon}
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                      <p className="text-white font-bold text-center text-sm">{set.name}</p>
                      {set.images?.logo && (
                        <img
                          src={set.images.logo}
                          alt={set.name}
                          className="absolute inset-0 max-h-full max-w-full object-contain m-auto p-4"
                          onError={(e) => (e.target.style.display = 'none')}
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-white text-sm font-semibold truncate mb-1.5">
                        {set.series && set.series !== set.name && (
                          <span className="text-slate-400 font-normal">{set.series} - </span>
                        )}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {bindersFiltered.map((binder) => (
                <button
                  key={`${binder.section}:${binder.name}`}
                  onClick={() => setBrowsedBinder({ name: binder.name, section: binder.section })}
                  className="group relative rounded-2xl overflow-hidden bg-surface-800 border border-surface-700 hover:border-accent/60 transition-all shadow-lg hover:shadow-2xl hover:scale-[1.025] text-left"
                >
                  {/* Cover image area */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: '3/4' }}>
                    {binder.coverImages.length === 0 ? (
                      <div className="w-full h-full bg-surface-900 flex items-center justify-center">
                        <svg className="w-16 h-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    ) : binder.coverImages.length === 1 ? (
                      <img
                        src={binder.coverImages[0]}
                        alt={binder.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    ) : (
                      <div className={`grid h-full ${binder.coverImages.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
                        {binder.coverImages.slice(0, 4).map((img, idx) => (
                          <div key={idx} className="overflow-hidden">
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => (e.target.style.display = 'none')}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Bottom gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
                    {/* Section badge */}
                    <div className="absolute top-3 right-3">
                      {binder.section === 'collection'
                        ? <span className="bg-accent text-black text-[11px] font-bold px-2.5 py-1 rounded-full shadow">Collection</span>
                        : <span className="bg-sky-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow">Watchlist</span>
                      }
                    </div>
                    {/* Card count overlay — bottom left */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-white font-bold text-base leading-tight truncate drop-shadow-lg">{binder.name}</p>
                      <p className="text-white/70 text-xs mt-0.5 drop-shadow">{binder.count} {binder.count === 1 ? 'card' : 'cards'}</p>
                    </div>
                  </div>
                  {/* Info row */}
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <p className="text-slate-400 text-xs truncate">Total value</p>
                    <p className="text-accent font-bold text-sm flex-shrink-0">{format(binder.value)}</p>
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
            onClick={() => { setBrowsedBinder(null); setConfirmDeleteBinder(false) }}
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
          {confirmDeleteBinder ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-slate-300 text-xs">Delete binder?</span>
              <button
                onClick={async () => {
                  await window.api.deleteBinder(browsedBinder.section, browsedBinder.name)
                  const [col, watch] = await Promise.all([
                    window.api.listBinders('collection'),
                    window.api.listBinders('watchlist'),
                  ])
                  setPortfolioBinders(col)
                  setWatchlistBinders(watch)
                  setBrowsedBinder(null)
                  setConfirmDeleteBinder(false)
                }}
                className="px-2.5 py-1 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDeleteBinder(false)}
                className="px-2.5 py-1 bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteBinder(true)}
              className="flex-shrink-0 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete binder"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
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
              <option value="released_desc">Released (Newest First)</option>
              <option value="released_asc">Released (Oldest First)</option>
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
                const name = product.name || product['product-name'] || 'Unknown'
                const category = product.setName || product['console-name'] || 'Sealed Product'
                const displayPrice = product.prices?.market ?? null
                const alreadyOwned = ownedCards.some((c) => c.name === (product.name || product['product-name']))
                return (
                  <div
                    key={product.tcgPlayerId || product.id}
                    className={`bg-surface-800 border rounded-xl px-4 py-3 flex items-center gap-4 ${alreadyOwned ? 'border-emerald-500/50' : 'border-surface-600'}`}
                  >
                    <div className="w-14 h-14 flex-shrink-0 bg-surface-700 rounded-lg overflow-hidden relative flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-500 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {(product.imageUrl || product.image || product.img || product['image-url'] || product.thumbnail) && (
                        <img
                          src={product.imageUrl || product.image || product.img || product['image-url'] || product.thumbnail}
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


      {mode === 'cards' && !binderFilter && hasSearched && !loading && results.length === 0 && !error && (
        !sealedLoading && sealedResults.length === 0
          ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <p className="text-lg">No results found</p>
              <p className="text-sm mt-1">Try adjusting your search terms</p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-2">No cards found</p>
          )
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

      {/* Binder browse — binder page view with drag-to-reorder */}
      {mode === 'folders' && browsedBinder && orderedBinderCards.length > 0 && (() => {
        const SLOTS = 9
        const pageCount = Math.ceil(orderedBinderCards.length / SLOTS)
        const pageSlice = orderedBinderCards.slice(browsedBinderPage * SLOTS, (browsedBinderPage + 1) * SLOTS)

        function handleDragStart(e, absoluteIdx) {
          dragSrcRef.current = absoluteIdx
          e.dataTransfer.effectAllowed = 'move'
        }

        function handleDragOver(e, absoluteIdx) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDragOverIdx(absoluteIdx)
        }

        function handleDrop(e, absoluteIdx) {
          e.preventDefault()
          const srcIdx = dragSrcRef.current
          if (srcIdx == null || srcIdx === absoluteIdx) { setDragOverIdx(null); return }
          const updated = [...orderedBinderCards]
          const [moved] = updated.splice(srcIdx, 1)
          updated.splice(absoluteIdx, 0, moved)
          const orderIds = updated.map((c) => c._owned?.id).filter(Boolean)
          setBinderCardOrder(orderIds)
          const key = `pokeprice-binder-order-${browsedBinder.section}-${encodeURIComponent(browsedBinder.name)}`
          localStorage.setItem(key, JSON.stringify(orderIds))
          dragSrcRef.current = null
          setDragOverIdx(null)
        }

        function handleDragEnd() {
          dragSrcRef.current = null
          setDragOverIdx(null)
        }

        return (
          <div className="flex flex-col items-center gap-5">
            <p className="text-slate-600 text-xs self-end">Drag cards to rearrange</p>
            <div
              className="bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl p-3"
              style={{ height: '62vh', aspectRatio: '5/7', maxWidth: '440px' }}
            >
              <div className="grid grid-cols-3 grid-rows-3 gap-2 h-full">
                {Array.from({ length: SLOTS }).map((_, slotIdx) => {
                  const absoluteIdx = browsedBinderPage * SLOTS + slotIdx
                  const card = pageSlice[slotIdx]
                  if (!card) {
                    return (
                      <div
                        key={slotIdx}
                        className={`rounded-lg border-2 border-dashed transition-colors ${dragOverIdx === absoluteIdx ? 'border-accent/70 bg-accent/5' : 'border-surface-700 bg-surface-800/30'}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(absoluteIdx) }}
                        onDrop={(e) => handleDrop(e, absoluteIdx)}
                        onDragLeave={() => setDragOverIdx(null)}
                      />
                    )
                  }
                  const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
                  const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
                  return (
                    <div
                      key={card._owned?.id ?? card.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, absoluteIdx)}
                      onDragOver={(e) => handleDragOver(e, absoluteIdx)}
                      onDrop={(e) => handleDrop(e, absoluteIdx)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={() => setDragOverIdx(null)}
                      className={`rounded-lg overflow-hidden relative transition-all cursor-grab active:cursor-grabbing select-none bg-surface-800 ring-1 ${
                        dragOverIdx === absoluteIdx && dragSrcRef.current !== absoluteIdx
                          ? 'ring-accent scale-[1.04] z-10'
                          : 'ring-surface-600 hover:ring-accent/50 hover:scale-[1.03] hover:z-10'
                      }`}
                      onClick={() => openCardModal(card)}
                      style={{ opacity: dragSrcRef.current === absoluteIdx ? 0.4 : 1 }}
                    >
                      {card.images?.small
                        ? <img src={card.images.small} alt={card.name} className="w-full h-full object-cover" onError={(e) => (e.target.style.display = 'none')} />
                        : <div className="w-full h-full bg-surface-700 flex items-center justify-center text-slate-600 text-[10px]">No img</div>
                      }
                      {(inPortfolio || inWatchlist) && (
                        <div className="absolute top-1 right-1 flex flex-col gap-0.5 pointer-events-none">
                          {inPortfolio && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-accent text-black leading-none">Coll.</span>}
                          {inWatchlist && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-sky-500 text-white leading-none">Watch.</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBrowsedBinderPage((p) => Math.max(0, p - 1))}
                  disabled={browsedBinderPage === 0}
                  className="px-4 py-2 rounded-lg border border-surface-600 text-slate-400 hover:text-white hover:border-surface-500 disabled:opacity-30 transition-all text-sm"
                >← Prev</button>
                <span className="text-slate-500 text-sm">Page {browsedBinderPage + 1} of {pageCount}</span>
                <button
                  onClick={() => setBrowsedBinderPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={browsedBinderPage === pageCount - 1}
                  className="px-4 py-2 rounded-lg border border-surface-600 text-slate-400 hover:text-white hover:border-surface-500 disabled:opacity-30 transition-all text-sm"
                >Next →</button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Cards mode + set browse: view toggle + results */}
      {!loading && baseResults.length > 0 && (mode === 'cards' || browsedSet) && (
        <>
          {/* ── Grid view ── */}
          {(viewMode === 'grid' || browsedSet) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayResults.map((card) => {
                if (card._divider) {
                  return (
                    <div key="__divider__" className="col-span-full flex items-center gap-3 py-2 select-none">
                      <div className="flex-1 h-px bg-surface-600" />
                      <span className="text-xs text-slate-500 font-medium">Similar Items</span>
                      <div className="flex-1 h-px bg-surface-600" />
                    </div>
                  )
                }
                const price = cardPrice(card)
                const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
                const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
                const isFav = favNames.some((n) => { const cn = (card.name || '').toLowerCase(); const fn = (n || '').toLowerCase(); return fn && (cn === fn || cn.includes(fn)) })
                return (
                  <div key={card.id} onClick={() => openCardModal(card)} className="relative border border-surface-600 hover:border-surface-400 rounded-xl p-2 bg-surface-800 transition-colors cursor-pointer">
                    {isFav && (
                      <span className="absolute top-2 left-2 text-yellow-400 text-xl leading-none pointer-events-none z-10">★</span>
                    )}
                    {(inPortfolio || inWatchlist) && (
                      <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5 z-10 pointer-events-none">
                        {inPortfolio && <span className="text-[11px] font-bold px-2 py-1 rounded bg-accent text-black leading-none">Collection</span>}
                        {inWatchlist && <span className="text-[11px] font-bold px-2 py-1 rounded bg-sky-500 text-white leading-none">Watchlist</span>}
                      </div>
                    )}
                    <div className="aspect-[5/7] w-full">
                      {card.images?.small ? (
                        <img
                          src={card.images.small} alt={card.name}
                          className="w-full h-full object-contain rounded-lg"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}
                        />
                      ) : null}
                      <div style={{ display: card.images?.small ? 'none' : 'flex' }} className="w-full h-full bg-surface-700 rounded-lg flex-col items-center justify-center text-slate-600 gap-1">
                        <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                          <rect x="1" y="1" width="26" height="34" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="14" cy="15" r="5" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M5 28 Q14 22 23 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        <span className="text-xs">No image</span>
                      </div>
                    </div>
                    <div className="mt-2 px-0.5">
                      <p className="text-white text-xs font-semibold leading-tight text-center truncate">
                        {card.name}{card.number ? <span className="text-slate-400 font-normal"> #{card.number}</span> : ''}
                      </p>
                      <p className="text-slate-500 text-xs text-center truncate mt-0.5">
                        {card.set?.series && card.set.series !== card.set?.name
                          ? `${card.set.series} - ${card.set.name}`
                          : card.set?.name || ''}
                      </p>
                      <VariantBadges variants={card.variants} className="justify-center mt-0.5" />
                      {price != null && (
                        <p className="text-slate-300 text-xs font-semibold text-center mt-1">{format(price)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Table view ── */}
          {viewMode === 'table' && !browsedSet && (
            <div className="bg-surface-800 border border-surface-600 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="text-left text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Card</th>
                    <th className="text-left text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Set</th>
                    <th className="text-left text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Rarity</th>
                    <th className="text-left text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Illustrator</th>
                    <th className="text-left text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Variants</th>
                    <th className="text-right text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Price</th>
                    <th className="text-right text-slate-500 text-xs uppercase tracking-wider px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayResults.map((card) => {
                    if (card._divider) {
                      return (
                        <tr key="__divider__"><td colSpan={7} className="px-4 py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-surface-700" />
                            <span className="text-xs text-slate-600 font-medium">Similar Items</span>
                            <div className="flex-1 h-px bg-surface-700" />
                          </div>
                        </td></tr>
                      )
                    }
                    const price = cardPrice(card)
                    const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
                    const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
                    return (
                      <tr key={card.id} onClick={() => openCardModal(card)} className="border-b border-surface-700 last:border-0 hover:bg-surface-700/50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <img src={card.images?.small} alt={card.name} className="w-10 h-14 object-contain rounded flex-shrink-0" onError={(e) => (e.target.style.display = 'none')} />
                            <div>
                              <p className="text-white text-sm font-semibold leading-tight">{card.name}</p>
                              {card.number && <p className="text-slate-500 text-xs">#{card.number}</p>}
                              <div className="flex gap-1 mt-1">
                                {inPortfolio && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent text-black leading-none">Collection</span>}
                                {inWatchlist && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500 text-white leading-none">Watchlist</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-sm">
                          {card.set?.series && card.set.series !== card.set?.name
                            ? `${card.set.series} - ${card.set.name}`
                            : card.set?.name || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-sm">{card.rarity || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-sm">{card.artist || '—'}</td>
                        <td className="px-4 py-2.5"><VariantBadges variants={card.variants} /></td>
                        <td className="px-4 py-2.5 text-right">
                          {price != null ? <span className="text-accent font-semibold text-sm">{format(price)}</span> : <span className="text-slate-600 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-end">
                            {inPortfolio ? (
                              <span className="text-xs text-accent font-semibold px-2 py-1 rounded bg-accent/10 border border-accent/30">✓ Collection</span>
                            ) : (
                              <button onClick={() => setAddModal({ card, section: 'collection' })} className="text-xs font-bold px-2 py-1 rounded bg-accent hover:bg-accent-hover text-black transition-colors whitespace-nowrap">+ Collection</button>
                            )}
                            {inWatchlist ? (
                              <span className="text-xs text-sky-400 font-semibold px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30">✓ Watchlist</span>
                            ) : (
                              <button onClick={() => setAddModal({ card, section: 'watchlist' })} className="text-xs font-bold px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors whitespace-nowrap">+ Watchlist</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Binder view ── */}
          {viewMode === 'binder' && !browsedSet && (() => {
            const binderCards = displayResults.filter((c) => !c._divider)
            const BINDER_PER_PAGE = 9
            const pageCount = Math.ceil(binderCards.length / BINDER_PER_PAGE)
            const pageSlice = binderCards.slice(searchBinderPage * BINDER_PER_PAGE, (searchBinderPage + 1) * BINDER_PER_PAGE)
            return (
              <div className="w-full flex flex-col items-center gap-4">
                <div
                  className="bg-surface-900 rounded-xl border border-surface-700 shadow-2xl p-2"
                  style={{ height: '60vh', aspectRatio: '5/7', maxWidth: '420px' }}
                >
                  <div className="grid grid-cols-3 grid-rows-3 gap-1.5 h-full">
                    {Array.from({ length: BINDER_PER_PAGE }).map((_, i) => {
                      const card = pageSlice[i]
                      if (!card) return <div key={i} className="rounded border border-dashed border-surface-700 bg-surface-800/40" />
                      const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
                      const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
                      return (
                        <button
                          key={card.id}
                          onClick={() => openCardModal(card)}
                          className="rounded overflow-hidden relative transition-all hover:scale-[1.03] hover:z-10 bg-surface-800 ring-1 ring-surface-600 hover:ring-accent/60"
                        >
                          <img src={card.images?.small} alt={card.name} className="w-full h-full object-cover" onError={(e) => (e.target.style.display = 'none')} />
                          {(inPortfolio || inWatchlist) && (
                            <div className="absolute top-1 right-1 flex flex-col gap-0.5 pointer-events-none">
                              {inPortfolio && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-accent text-black leading-none">Coll.</span>}
                              {inWatchlist && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500 text-white leading-none">Watch.</span>}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSearchBinderPage((p) => Math.max(0, p - 1))} disabled={searchBinderPage === 0} className="px-4 py-2 rounded-lg border border-surface-600 text-slate-400 hover:text-white hover:border-surface-500 disabled:opacity-30 transition-all text-sm">← Prev</button>
                    <span className="text-slate-500 text-sm">Page {searchBinderPage + 1} of {pageCount}</span>
                    <button onClick={() => setSearchBinderPage((p) => Math.min(pageCount - 1, p + 1))} disabled={searchBinderPage === pageCount - 1} className="px-4 py-2 rounded-lg border border-surface-600 text-slate-400 hover:text-white hover:border-surface-500 disabled:opacity-30 transition-all text-sm">Next →</button>
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* ── Sealed Products section — always shown in Items mode when results exist ── */}
      {mode === 'cards' && (sealedLoading || sealedResults.length > 0) && nameQuery.trim() && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-surface-700" />
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Sealed Products
            </span>
            <div className="flex-1 h-px bg-surface-700" />
          </div>
          {sealedLoading && (
            <div className="flex items-center justify-center py-6 gap-2.5 text-slate-500">
              <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin flex-shrink-0" />
              <span className="text-sm">Searching sealed products…</span>
            </div>
          )}
          {!sealedLoading && (
            <div className="flex flex-col gap-2">
              {sealedResults.map((product) => {
                const productName = product.name || product['product-name'] || 'Unknown'
                const category = product.setName || product['console-name'] || 'Sealed Product'
                const displayPrice = product.prices?.market ?? null
                const alreadyOwned = ownedCards.some((c) => c.name === (product.name || product['product-name']))
                const imgSrc = product.imageUrl || product.image || product.img || product['image-url'] || product.thumbnail
                return (
                  <div
                    key={product.tcgPlayerId || product.id}
                    className={`bg-surface-800 border rounded-xl px-4 py-3 flex items-center gap-4 ${alreadyOwned ? 'border-emerald-500/50' : 'border-surface-600'}`}
                  >
                    <div className="w-14 h-14 flex-shrink-0 bg-surface-700 rounded-lg overflow-hidden relative flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-500 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      {imgSrc && (
                        <img src={imgSrc} alt={productName} className="w-full h-full object-contain relative z-10" onError={(e) => e.target.remove()} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{productName}</p>
                      <p className="text-slate-500 text-xs">{category}</p>
                    </div>
                    {displayPrice != null && (
                      <p className="text-accent font-bold text-sm flex-shrink-0">{format(displayPrice)}</p>
                    )}
                    {alreadyOwned && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 flex-shrink-0">Owned</span>
                    )}
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setSealedAddModal({ product, section: 'collection' })} className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-black text-xs font-bold rounded-lg transition-colors whitespace-nowrap">+ Collection</button>
                      <button onClick={() => setSealedAddModal({ product, section: 'watchlist' })} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">+ Watchlist</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
