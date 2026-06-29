'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { trpc } from '@/trpc/react'

const KEYWORD_HINTS = [
  'Elite Trainer Box', 'Booster Box', 'Booster Bundle', 'Booster Pack',
  'Collection Box', 'Premium Collection', 'Tin', 'Theme Deck',
]

interface SealedProduct {
  pricechartingId: string
  name: string
  setName: string
  imageUrl: string | null
  currentPrice: number | null
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Add modal ─────────────────────────────────────────────────────────────────
function AddSealedModal({ product, onClose }: { product: SealedProduct; onClose: () => void }) {
  const [section, setSection] = useState<'portfolio' | 'watchlist'>('portfolio')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [binder, setBinder] = useState('')
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  const utils = trpc.useUtils()
  const addCard = trpc.cards.add.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate()
      setDone(true)
    },
  })

  const { data: profile } = trpc.profiles.get.useQuery()
  const binderOptions = profile?.binderLists ?? []

  function submit() {
    setAdding(true)
    addCard.mutate({
      tcgId: null,
      name: product.name,
      setName: product.setName,
      setId: null,
      number: null,
      rarity: null,
      imageUrl: product.imageUrl,
      imageUrlLarge: product.imageUrl,
      condition: 'sealed',
      quantity: 1,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      section,
      type: 'sealed',
      pricechartingId: product.pricechartingId,
      currentPrice: product.currentPrice,
    })
  }

  const inputCls = 'w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent'
  const labelCls = 'text-xs text-slate-400 mb-1 block'

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">{product.name}</p>
          <p className="text-slate-400 text-sm mb-6">Added to your {section}.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-accent/20 border border-accent/40 text-accent rounded-xl font-medium text-sm hover:bg-accent/30 transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        {/* Product header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-surface-700 border border-surface-600">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="w-full h-full object-contain" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">?</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold leading-tight text-sm">{product.name}</h2>
            <p className="text-slate-400 text-xs mt-0.5">{product.setName}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-xs bg-blue-900/40 border border-blue-700/40 text-blue-300 px-2 py-0.5 rounded-full font-medium">Sealed</span>
              <span className="text-accent font-semibold text-sm">{fmt(product.currentPrice)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Add to</label>
            <select value={section} onChange={e => setSection(e.target.value as 'portfolio' | 'watchlist')} className={inputCls}>
              <option value="portfolio">Collection</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Purchase Price ($)</label>
            <input type="number" min={0} step="0.01" placeholder="0.00" value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Binder (optional)</label>
            {binderOptions.length > 0 ? (
              <select value={binder} onChange={e => setBinder(e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                {binderOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Binder name" value={binder}
                onChange={e => setBinder(e.target.value)} className={inputCls} />
            )}
          </div>
        </div>

        {addCard.error && <p className="text-red-400 text-xs">{addCard.error.message}</p>}

        <button onClick={submit} disabled={adding}
          className="w-full py-2.5 bg-accent text-black font-semibold rounded-xl text-sm hover:bg-amber-400 transition-colors disabled:opacity-50">
          {adding ? 'Adding…' : `Add to ${section === 'portfolio' ? 'Collection' : 'Watchlist'}`}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SealedSearchClient() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<SealedProduct | null>(null)

  const handleInput = useCallback((val: string) => {
    setQuery(val)
    if (timer) clearTimeout(timer)
    const t = setTimeout(() => setDebouncedQuery(val), 600)
    setTimer(t)
  }, [timer])

  const { data: results = [], isFetching } = trpc.cards.searchSealed.useQuery(debouncedQuery, {
    enabled: debouncedQuery.trim().length >= 3,
    staleTime: 300_000,
  })

  const hasKeyword = KEYWORD_HINTS.some(k => query.toLowerCase().includes(k.toLowerCase()))
    || query.toLowerCase().includes('etb') || query.toLowerCase().includes(' bb ')

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Add Sealed Product</h1>
        <p className="text-slate-400 text-sm">Search ETBs, booster boxes, tins, and other sealed products.</p>
      </div>

      {/* Keyword hints */}
      <div className="flex flex-wrap gap-1.5">
        {KEYWORD_HINTS.map(k => (
          <button
            key={k}
            onClick={() => handleInput(k + ' ')}
            className="text-xs px-2.5 py-1 bg-surface-700 border border-surface-600 hover:border-accent/50 hover:text-accent text-slate-400 rounded-lg transition-colors"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="e.g. Scarlet &amp; Violet Elite Trainer Box"
          className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
          autoFocus
        />
        {isFetching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          </span>
        )}
      </div>

      {/* Guidance */}
      {!isFetching && debouncedQuery.length >= 3 && !hasKeyword && results.length === 0 && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 text-sm text-amber-300">
          <p className="font-medium mb-1">Include a product type keyword</p>
          <p className="text-amber-400/70 text-xs">Try: "Scarlet &amp; Violet <strong>Elite Trainer Box</strong>" or "Paldea Evolved <strong>Booster Box</strong>"</p>
        </div>
      )}

      {/* No results */}
      {!isFetching && debouncedQuery.length >= 3 && hasKeyword && results.length === 0 && (
        <div className="text-center py-12 text-slate-500 text-sm">
          No products found for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <p className="text-xs text-slate-500">{results.length} product{results.length !== 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {results.map(product => (
              <button
                key={product.pricechartingId}
                onClick={() => setSelectedProduct(product)}
                className="w-full flex items-center gap-4 bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl px-4 py-3 text-left transition-all cursor-pointer"
              >
                {/* Image */}
                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-surface-700 border border-surface-600">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} width={48} height={48}
                      className="w-full h-full object-contain" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">?</div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{product.name}</p>
                  <p className="text-slate-500 text-xs truncate">{product.setName}</p>
                </div>
                {/* Price */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-accent font-bold">{fmt(product.currentPrice)}</p>
                  <p className="text-slate-600 text-xs mt-0.5">market</p>
                </div>
                {/* Add button */}
                <div className="flex-shrink-0 px-3 py-1.5 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-900/50 transition-colors">
                  Add
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {debouncedQuery.length < 3 && !isFetching && (
        <div className="text-center py-16 text-slate-600 text-sm">
          Type a product name with a keyword (ETB, Booster Box, Tin…)
        </div>
      )}

      {selectedProduct && (
        <AddSealedModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  )
}
