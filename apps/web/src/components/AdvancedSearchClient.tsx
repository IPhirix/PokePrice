'use client'

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { trpc } from '@/trpc/react'
import type { CardCondition, TcgCard } from '@pokeprice/types'

type GradableCondition = Exclude<CardCondition, 'sealed'>

const CONDITIONS: { value: GradableCondition; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'psa10', label: 'PSA 10' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'cgc10', label: 'CGC 10' },
  { value: 'cgc9', label: 'CGC 9' },
]

const SERIES_ORDER = [
  'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY',
  'Black & White', 'HeartGold & SoulSilver', 'Diamond & Pearl',
  'Platinum', 'EX', 'E-Card', 'Neo', 'Gym', 'Base',
]

function AddModal({ card, onClose }: { card: TcgCard; onClose: () => void }) {
  const [condition, setCondition] = useState<GradableCondition>('raw')
  const [quantity, setQuantity] = useState(1)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [section, setSection] = useState<'portfolio' | 'watchlist'>('portfolio')
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState(false)

  const utils = trpc.useUtils()
  const addCard = trpc.cards.add.useMutation({
    onSuccess: () => {
      utils.portfolio.dashboard.invalidate()
      setDone(true)
    },
  })

  function submit() {
    setAdding(true)
    addCard.mutate({
      tcgId: card.id,
      name: card.name,
      setName: card.set.name,
      setId: card.set.id,
      number: card.localId || null,
      rarity: card.rarity ?? null,
      imageUrl: card.image,
      imageUrlLarge: card.image?.replace('/low.webp', '/high.webp') ?? null,
      condition,
      quantity,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      section,
    })
  }

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">{card.name} added</p>
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
        <div className="flex items-start gap-4">
          <div className="w-16 flex-shrink-0 rounded-lg overflow-hidden bg-surface-700" style={{ height: 88 }}>
            {card.image && <Image src={card.image} alt={card.name} width={64} height={88} className="object-cover w-full h-full" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold truncate">{card.name}</h2>
            <p className="text-slate-400 text-sm">{card.set.name}{card.localId ? ` · #${card.localId}` : ''}</p>
            {card.rarity && <p className="text-slate-500 text-xs mt-0.5">{card.rarity}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Section</label>
            <select value={section} onChange={e => setSection(e.target.value as 'portfolio' | 'watchlist')}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
              <option value="portfolio">Collection</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Condition</label>
            <select value={condition} onChange={e => setCondition(e.target.value as GradableCondition)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Quantity</label>
            <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Purchase Price ($)</label>
            <input type="number" min={0} step="0.01" placeholder="0.00" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent" />
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

export default function AdvancedSearchClient() {
  const [nameQuery, setNameQuery] = useState('')
  const [selectedSet, setSelectedSet] = useState('')
  const [selectedRarity, setSelectedRarity] = useState('')
  const [selectedCard, setSelectedCard] = useState<TcgCard | null>(null)
  const [debouncedName, setDebouncedName] = useState('')
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { data: sets = [], isLoading: setsLoading } = trpc.cards.listSets.useQuery(undefined, { staleTime: 3_600_000 })
  const { data: setCards = [], isFetching: setFetching } = trpc.cards.searchBySet.useQuery(
    { setId: selectedSet },
    { enabled: !!selectedSet, staleTime: 600_000 }
  )
  const { data: nameResults = [], isFetching: nameFetching } = trpc.cards.search.useQuery(
    debouncedName,
    { enabled: debouncedName.length >= 2, staleTime: 120_000 }
  )

  const handleNameInput = useCallback((val: string) => {
    setNameQuery(val)
    if (timer) clearTimeout(timer)
    const t = setTimeout(() => setDebouncedName(val), 400)
    setTimer(t)
  }, [timer])

  // Group sets by series for the select dropdown
  const groupedSets = useMemo(() => {
    const groups = new Map<string, typeof sets>()
    for (const s of sets) {
      const series = s.series || 'Other'
      if (!groups.has(series)) groups.set(series, [])
      groups.get(series)!.push(s)
    }
    const result: { series: string; sets: typeof sets }[] = []
    for (const s of SERIES_ORDER) {
      if (groups.has(s)) result.push({ series: s, sets: groups.get(s)! })
    }
    for (const [series, sList] of groups) {
      if (!SERIES_ORDER.includes(series)) result.push({ series, sets: sList })
    }
    return result
  }, [sets])

  // Unique rarities from set cards
  const rarities = useMemo(() => {
    const r = new Set<string>()
    setCards.forEach(c => { if (c.rarity) r.add(c.rarity) })
    return Array.from(r).sort()
  }, [setCards])

  // Apply rarity + name filter to set cards
  const filteredSetCards = useMemo(() => {
    let list = setCards
    if (selectedRarity) list = list.filter(c => c.rarity === selectedRarity)
    const q = nameQuery.trim().toLowerCase()
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q))
    return list
  }, [setCards, selectedRarity, nameQuery])

  const showSetResults = !!selectedSet
  const showNameResults = !selectedSet && debouncedName.length >= 2
  const results = showSetResults ? filteredSetCards : showNameResults ? nameResults : []
  const isFetching = showSetResults ? setFetching : nameFetching

  const inputCls = 'bg-surface-800 border border-surface-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent hover:border-surface-500 transition-colors'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Advanced Search</h1>
        <p className="text-slate-400 text-sm">Filter by set, rarity, or search by name across the entire catalog.</p>
      </div>

      {/* Filter bar */}
      <div className="bg-surface-800 border border-surface-600 rounded-2xl p-4 flex flex-wrap gap-3">
        {/* Name search */}
        <div className="flex-1 min-w-48 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={nameQuery}
            onChange={e => handleNameInput(e.target.value)}
            placeholder="Card name…"
            className={`w-full ${inputCls} pl-10`}
          />
        </div>

        {/* Set selector */}
        <div className="min-w-48">
          <select
            value={selectedSet}
            onChange={e => { setSelectedSet(e.target.value); setSelectedRarity('') }}
            className={`${inputCls} cursor-pointer w-full`}
            disabled={setsLoading}
          >
            <option value="">— All Sets —</option>
            {groupedSets.map(g => (
              <optgroup key={g.series} label={g.series}>
                {g.sets.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Rarity filter (only when set selected) */}
        {selectedSet && rarities.length > 0 && (
          <div className="min-w-40">
            <select
              value={selectedRarity}
              onChange={e => setSelectedRarity(e.target.value)}
              className={`${inputCls} cursor-pointer w-full`}
            >
              <option value="">— All Rarities —</option>
              {rarities.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}

        {/* Clear */}
        {(selectedSet || selectedRarity || nameQuery) && (
          <button
            onClick={() => { setSelectedSet(''); setSelectedRarity(''); setNameQuery(''); setDebouncedName('') }}
            className="px-3 py-2.5 text-sm text-slate-400 hover:text-white border border-surface-600 hover:border-surface-500 rounded-xl transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {isFetching && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {!isFetching && results.length > 0 && (
        <>
          <p className="text-xs text-slate-500">{results.length} card{results.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map(card => (
              <button
                key={card.id}
                onClick={() => setSelectedCard(card)}
                className="bg-surface-800 border border-surface-700 hover:border-surface-500 rounded-xl overflow-hidden text-left transition-all hover:scale-[1.02] cursor-pointer"
              >
                <div className="relative w-full bg-surface-700" style={{ paddingTop: '139%' }}>
                  {card.image ? (
                    <Image src={card.image} alt={card.name} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-2xl">?</div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-white text-xs font-semibold leading-tight truncate">{card.name}</p>
                  <p className="text-slate-500 text-[10px] mt-0.5 truncate">
                    {card.localId ? `#${card.localId}` : ''}{card.rarity ? ` · ${card.rarity}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {!isFetching && !showSetResults && !showNameResults && (
        <div className="text-center py-20 text-slate-600 text-sm">
          Select a set or type a name to search
        </div>
      )}

      {!isFetching && (showSetResults || showNameResults) && results.length === 0 && (
        <div className="text-center py-20 text-slate-600 text-sm">
          No cards found
        </div>
      )}

      {selectedCard && <AddModal card={selectedCard} onClose={() => setSelectedCard(null)} />}
    </div>
  )
}
