'use client'

import { useState, useMemo } from 'react'
import { trpc } from '@/trpc/react'
import type { Card } from '@pokeprice/types'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Trade History ─────────────────────────────────────────────────────────────
function TradeHistory() {
  const utils = trpc.useUtils()
  const { data: trades = [], isLoading } = trpc.trades.list.useQuery(undefined, { staleTime: 30_000 })
  const deleteTrade = trpc.trades.delete.useMutation({ onSuccess: () => utils.trades.list.invalidate() })
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (isLoading) return (
    <div className="space-y-2">
      {[1, 2].map(i => <div key={i} className="h-16 bg-surface-700 rounded-xl animate-pulse" />)}
    </div>
  )

  if (trades.length === 0) return (
    <p className="text-slate-600 text-sm text-center py-8">No saved trades yet. Analyze a trade and save it below.</p>
  )

  return (
    <div className="space-y-3">
      {trades.map(trade => {
        const given = trade.cards_given as { name: string; currentPrice: number | null }[]
        const received = trade.cards_received as { name: string; currentPrice: number | null }[]
        const givingVal = given.reduce((s, c) => s + (c.currentPrice ?? 0), 0)
        const receivingVal = received.reduce((s, c) => s + (c.currentPrice ?? 0), 0)
        const diff = receivingVal - givingVal
        const diffColor = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'

        return (
          <div key={trade.id} className="bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-red-400 font-medium">{given.map(c => c.name).join(', ') || '—'}</span>
                <svg className="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="text-xs text-emerald-400 font-medium">{received.map(c => c.name).join(', ') || '—'}</span>
              </div>
              {trade.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{trade.notes}</p>}
              <p className="text-[10px] text-slate-600 mt-0.5">{fmtDate(trade.created_at)}</p>
            </div>
            <span className={`text-sm font-bold flex-shrink-0 ${diffColor}`}>
              {diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))}`}
            </span>
            {confirmDelete === trade.id ? (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { deleteTrade.mutate(trade.id); setConfirmDelete(null) }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
                <button onClick={() => setConfirmDelete(null)} className="text-xs text-slate-500 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(trade.id)}
                className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradeClient() {
  const [view, setView] = useState<'analyzer' | 'history'>('analyzer')
  const [giving, setGiving] = useState<Card[]>([])
  const [receiving, setReceiving] = useState<Card[]>([])
  const [pickerSide, setPickerSide] = useState<'giving' | 'receiving' | null>(null)
  const [filter, setFilter] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const utils = trpc.useUtils()
  const { data } = trpc.portfolio.dashboard.useQuery(undefined, { staleTime: 60_000 })
  const saveTrade = trpc.trades.save.useMutation({
    onSuccess: () => {
      utils.trades.list.invalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const allCards = useMemo(() => [...(data?.portfolio ?? []), ...(data?.watchlist ?? [])], [data])
  const filteredPicker = useMemo(() => {
    const q = filter.toLowerCase()
    return allCards.filter(c => !q || c.name.toLowerCase().includes(q) || (c.setName ?? '').toLowerCase().includes(q))
  }, [allCards, filter])

  const givingValue = giving.reduce((s, c) => s + (c.currentPrice ?? 0) * c.quantity, 0)
  const receivingValue = receiving.reduce((s, c) => s + (c.currentPrice ?? 0) * c.quantity, 0)
  const diff = receivingValue - givingValue
  const diffColor = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'

  function addToSide(card: Card) {
    if (!pickerSide) return
    if (pickerSide === 'giving') {
      if (!giving.find(c => c.id === card.id)) setGiving(prev => [...prev, card])
    } else {
      if (!receiving.find(c => c.id === card.id)) setReceiving(prev => [...prev, card])
    }
    setPickerSide(null)
    setFilter('')
  }

  function handleSave() {
    saveTrade.mutate({
      cardsGiven: giving.map(c => ({
        id: c.id, name: c.name, setName: c.setName, condition: c.condition,
        currentPrice: c.currentPrice, quantity: c.quantity, imageUrl: c.imageUrl,
      })),
      cardsReceived: receiving.map(c => ({
        id: c.id, name: c.name, setName: c.setName, condition: c.condition,
        currentPrice: c.currentPrice, quantity: c.quantity, imageUrl: c.imageUrl,
      })),
      notes: notes.trim() || null,
    })
  }

  function TradeSlot({ cards, side }: { cards: Card[]; side: 'giving' | 'receiving' }) {
    const color = side === 'giving' ? 'text-red-400' : 'text-emerald-400'
    const borderColor = side === 'giving' ? 'border-red-900/40' : 'border-emerald-900/40'
    const label = side === 'giving' ? 'You Give' : 'You Receive'
    const total = cards.reduce((s, c) => s + (c.currentPrice ?? 0) * c.quantity, 0)

    return (
      <div className={`flex-1 bg-surface-800 border ${borderColor} rounded-xl p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-semibold uppercase tracking-wider ${color}`}>{label}</h2>
          <span className="text-white font-bold">{fmt(total)}</span>
        </div>

        {cards.length === 0 && <p className="text-slate-600 text-xs text-center py-4">No cards added</p>}

        {cards.map(card => (
          <div key={card.id} className="flex items-center gap-3 bg-surface-700 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{card.name}</p>
              <p className="text-slate-500 text-[10px] truncate">{card.setName}</p>
            </div>
            <span className="text-slate-300 text-xs flex-shrink-0">{fmt(card.currentPrice)}</span>
            <button
              onClick={() => side === 'giving'
                ? setGiving(prev => prev.filter(c => c.id !== card.id))
                : setReceiving(prev => prev.filter(c => c.id !== card.id))}
              className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <button
          onClick={() => { setPickerSide(side); setFilter('') }}
          className="w-full py-2 border border-dashed border-surface-500 rounded-lg text-slate-500 hover:text-slate-300 hover:border-surface-400 text-xs transition-colors"
        >
          + Add card
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Header with tab toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Trade Analyzer</h1>
          <p className="text-slate-400 text-sm">Compare trade values using current market prices.</p>
        </div>
        <div className="flex items-center gap-0.5 bg-surface-800 border border-surface-600 rounded-lg p-0.5">
          {(['analyzer', 'history'] as const).map(v => (
            <button key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                view === v ? 'bg-surface-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {v === 'analyzer' ? 'Analyzer' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {view === 'history' && <TradeHistory />}

      {view === 'analyzer' && (
        <>
          <div className="flex gap-4 items-start">
            <TradeSlot cards={giving} side="giving" />

            <div className="flex-shrink-0 flex flex-col items-center justify-center pt-12 gap-2">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span className={`text-sm font-bold ${diffColor}`}>
                {diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${fmt(Math.abs(diff))}`}
              </span>
              <span className="text-[10px] text-slate-600">
                {diff > 0 ? 'in your favor' : diff < 0 ? 'against you' : ''}
              </span>
            </div>

            <TradeSlot cards={receiving} side="receiving" />
          </div>

          {(giving.length > 0 || receiving.length > 0) && (
            <div className="bg-surface-800 border border-surface-600 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Summary</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">You Give</p>
                  <p className="text-red-400 font-bold">{fmt(givingValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Net Difference</p>
                  <p className={`font-bold ${diffColor}`}>{diff >= 0 ? '+' : ''}{fmt(diff)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">You Receive</p>
                  <p className="text-emerald-400 font-bold">{fmt(receivingValue)}</p>
                </div>
              </div>

              {/* Notes + Save */}
              <div className="border-t border-surface-600 pt-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Trade notes…"
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saveTrade.isPending || (giving.length === 0 && receiving.length === 0)}
                    className="px-4 py-2 bg-accent hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saveTrade.isPending ? 'Saving…' : 'Save Trade'}
                  </button>
                  {saved && <span className="text-xs text-emerald-400">Trade saved to history.</span>}
                  <button
                    onClick={() => { setGiving([]); setReceiving([]); setNotes('') }}
                    className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Card picker modal */}
      {pickerSide && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setPickerSide(null)}>
          <div className="bg-surface-800 border border-surface-600 rounded-2xl p-5 w-full max-w-md max-h-[70vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between flex-shrink-0">
              <h3 className="text-white font-semibold text-sm">
                Pick card to {pickerSide === 'giving' ? 'give' : 'receive'}
              </h3>
              <button onClick={() => setPickerSide(null)} className="text-slate-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="flex-shrink-0 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              autoFocus
            />
            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {filteredPicker.map(card => (
                <button
                  key={card.id}
                  onClick={() => addToSide(card)}
                  className="w-full flex items-center gap-3 bg-surface-700 hover:bg-surface-600 rounded-lg px-3 py-2 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{card.name}</p>
                    <p className="text-slate-500 text-[10px] truncate">{card.setName}</p>
                  </div>
                  <span className="text-slate-300 text-xs flex-shrink-0">{fmt(card.currentPrice)}</span>
                </button>
              ))}
              {filteredPicker.length === 0 && <p className="text-slate-600 text-xs text-center py-6">No cards match</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
