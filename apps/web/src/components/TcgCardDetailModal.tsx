'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { trpc } from '@/trpc/react'
import type { TcgCard } from '@pokeprice/types'
import { filterHistoryByRange, formatVariants, type ChartRange } from '@/lib/priceUtils'

interface Props {
  card: TcgCard
  onClose: () => void
  onAdd: (card: TcgCard, section: 'portfolio' | 'watchlist') => void
}

function fmtUSD(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  const p = s.split('-')
  return p.length === 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : s
}

const RANGES: { label: string; value: ChartRange }[] = [
  { label: '1M', value: 30 },
  { label: '3M', value: 90 },
  { label: '6M', value: 180 },
  { label: '1Y', value: 365 },
  { label: 'YTD', value: 'ytd' },
  { label: 'All', value: 'all' },
]

export default function TcgCardDetailModal({ card, onClose, onAdd }: Props) {
  const [chartRange, setChartRange] = useState<ChartRange>(90)

  const { data, isLoading } = trpc.prices.forTcgCard.useQuery(
    { name: card.name, number: card.localId || undefined, setName: card.set.name || undefined, condition: 'raw' },
    { enabled: !!card.name, staleTime: 5 * 60 * 1000 }
  )

  const allHistory = data?.history ?? []
  const filteredHistory = filterHistoryByRange(allHistory, chartRange)
  const chartData = filteredHistory.map(p => ({ date: p.date, value: p.price }))

  const price = data?.price ?? null
  const changeDay = data?.changeDay ?? null

  const isUp = changeDay == null ? true : changeDay >= 0

  const imageUrl = card.image

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-4xl overflow-hidden flex max-h-[96vh]">

        {/* Left: card image */}
        <div className="flex-shrink-0 w-[320px] bg-surface-900 flex flex-col relative overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-0"
            style={{ background: 'linear-gradient(to top, rgba(245,158,11,0.10) 0%, transparent 100%)' }}
          />
          <div className="flex-1 min-h-0 p-6 flex items-center justify-center">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={card.name}
                width={280}
                height={390}
                className="max-h-[420px] w-full object-contain rounded-xl select-none relative z-10"
                unoptimized
              />
            ) : (
              <div className="w-full max-h-[420px] h-64 rounded-xl bg-surface-700 flex items-center justify-center text-slate-600 text-4xl relative z-10">?</div>
            )}
          </div>
        </div>

        {/* Right: info + chart + actions */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-[14px] flex-shrink-0 border-b border-surface-700/60">
            <h2 className="text-[18px] font-bold text-white leading-tight tracking-[-0.02em] min-w-0 pr-2 truncate">
              {card.name}
              {card.localId ? <span className="text-[14px] font-normal text-slate-400 ml-1.5">#{card.localId}</span> : null}
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 rounded-lg hover:bg-surface-700 text-slate-500 hover:text-slate-200 text-[15px] flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

            {/* Price hero */}
            <div className="px-6 py-4 border-b border-surface-700/60 flex items-end gap-4 flex-shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-1">
                  Market Price · Raw
                </p>
                {isLoading ? (
                  <p className="text-[36px] font-extrabold text-slate-600 leading-none">…</p>
                ) : price != null ? (
                  <p className="text-[36px] font-extrabold text-accent leading-none tracking-[-0.03em] tabular-nums">
                    {fmtUSD(price)}
                  </p>
                ) : (
                  <p className="text-[36px] font-extrabold text-slate-600 leading-none">—</p>
                )}
              </div>
              {changeDay != null && (
                <span className={`text-[13px] font-bold tabular-nums pb-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{changeDay.toFixed(1)}%
                </span>
              )}
              <span className="ml-auto text-[11px] text-slate-600 pb-1 self-end">Updated today</span>
            </div>

            {/* Metadata rows */}
            <div className="px-6 flex-shrink-0">
              <div className="flex items-baseline justify-between py-[9px] border-b border-surface-700/40">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em] flex-shrink-0 mr-4">Set</span>
                <span className="text-[13px] font-medium text-slate-200 text-right">{card.set.name || '—'}</span>
              </div>
              <div className="flex items-baseline justify-between py-[9px] border-b border-surface-700/40">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em] flex-shrink-0 mr-4">Rarity</span>
                <span className="text-[13px] font-medium text-slate-200 text-right">{card.rarity ?? '—'}</span>
              </div>
              <div className="flex items-baseline justify-between py-[9px] border-b border-surface-700/40">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em] flex-shrink-0 mr-4">Pokémon Type</span>
                <span className="text-[13px] font-medium text-slate-200 text-right">
                  {card.types && card.types.length > 0 ? card.types.join(', ') : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between py-[9px]">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em] flex-shrink-0 mr-4">Variant</span>
                <span className="text-[13px] font-medium text-slate-200 text-right">{formatVariants(card.variants)}</span>
              </div>
            </div>

            {/* Price chart */}
            <div className="px-6 pt-3 pb-5 border-t border-surface-700/60 flex-1 min-h-0">
              {/* Range buttons */}
              <div className="flex gap-1.5 mb-3">
                {RANGES.map(r => (
                  <button
                    key={String(r.value)}
                    onClick={() => setChartRange(r.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border ${
                      chartRange === r.value
                        ? 'bg-accent text-black border-accent'
                        : 'bg-transparent border-surface-600 text-slate-500 hover:text-slate-300 hover:border-surface-500'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div style={{ height: 160 }}>
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">Loading…</div>
                ) : chartData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id="tcg-price-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tickFormatter={fmtDate} interval="preserveStartEnd"
                        tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} height={16} />
                      <YAxis domain={['dataMin', 'dataMax']} hide />
                      <Tooltip
                        formatter={(v: number) => [fmtUSD(v), 'Price']}
                        labelFormatter={fmtDate}
                        contentStyle={{ background: '#1e2330', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        itemStyle={{ color: '#f59e0b' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2}
                        fill="url(#tcg-price-grad)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    {allHistory.length === 0 ? 'No price history available' : 'Not enough data for this range'}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex gap-3 px-6 pb-6 pt-4 flex-shrink-0 border-t border-surface-700/60">
            <button
              onClick={() => onAdd(card, 'portfolio')}
              className="flex-1 bg-accent hover:bg-accent-hover active:scale-[0.98] text-black text-[13px] font-bold py-[11px] rounded-lg transition-all"
            >
              + Add to Collection
            </button>
            <button
              onClick={() => onAdd(card, 'watchlist')}
              className="flex-1 bg-blue-900/40 hover:bg-blue-800/50 active:scale-[0.98] border border-blue-700/50 text-blue-300 text-[13px] font-semibold py-[11px] rounded-lg transition-all"
            >
              + Add to Watchlist
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
