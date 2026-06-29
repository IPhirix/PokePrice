'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import { trpc } from '@/trpc/react'
import CardList from './CardList'
import type { Card, PortfolioStats } from '@pokeprice/types'

type Tab = 'collection' | 'watchlist'

function fmtUSD(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function sign(n: number) { return n >= 0 ? '+' : '−' }
function fmtDate(s: string) {
  const p = s.split('-')
  return p.length === 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : s
}

// ── Aggregate per-card histories into portfolio-level {date,value} series ────
function toPortfolioHistory(cards: Card[]) {
  const map = new Map<string, number>()
  for (const card of cards) {
    const qty = card.quantity || 1
    for (const h of card.recentHistory) {
      map.set(h.date, (map.get(h.date) ?? 0) + h.price * qty)
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))
}

function toPlHistory(cards: Card[], totalInvested: number) {
  const vh = toPortfolioHistory(cards)
  return vh.map(p => ({ date: p.date, value: Math.round((p.value - totalInvested) * 100) / 100 }))
}

function toRoiHistory(cards: Card[], totalInvested: number) {
  const vh = toPortfolioHistory(cards)
  return totalInvested > 0
    ? vh.map(p => ({ date: p.date, value: Math.round(((p.value - totalInvested) / totalInvested) * 10000) / 100 }))
    : []
}

function toDayChangeHistory(vh: { date: string; value: number }[]) {
  if (vh.length < 2) return []
  return vh.map((p, i) => i === 0 ? null : { date: p.date, value: Math.round((p.value - vh[i - 1].value) * 100) / 100 })
    .filter(Boolean) as { date: string; value: number }[]
}

// ── Recharts sparkline (mirrors desktop WidgetSparkline) ─────────────────────
const PLACEHOLDER = Array.from({ length: 14 }, (_, i) => ({
  value: 20 + (i / 13) * 28 + Math.sin(i * 0.9) * 4,
  date: '',
}))

function WidgetTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const val = payload[0].value as number
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs pointer-events-none">
      {p.date && <p className="text-slate-400 mb-0.5">{fmtDate(p.date)}</p>}
      <span className="text-white font-medium">{typeof val === 'number' ? fmtUSD(val) : val}</span>
    </div>
  )
}

function WidgetSparkline({ data, color, gradId, zeroLine = false }: {
  data: { date: string; value: number }[]
  color: string
  gradId: string
  zeroLine?: boolean
}) {
  if (!data || data.length < 2) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={PLACEHOLDER} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={`${gradId}-ph`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1e293b" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 80]} hide />
          <Area type="monotone" dataKey="value" stroke="#243044" strokeWidth={1.5}
            fill={`url(#${gradId}-ph)`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  const GREEN = '#34d399'
  const RED = '#f87171'
  let strokeColor = color
  let fillGrad = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  )
  let lineGrad = null as React.ReactNode
  let refLine = null as React.ReactNode
  let yDomain: any = ['dataMin', 'dataMax']

  if (zeroLine) {
    const vals = data.map(d => d.value)
    const minVal = Math.min(...vals)
    const maxVal = Math.max(...vals)
    const domainMin = Math.min(0, minVal)
    const domainMax = Math.max(0, maxVal)
    yDomain = [domainMin, domainMax]
    const range = domainMax - domainMin
    const zeroPct = range > 0 ? ((domainMax / range) * 100).toFixed(1) + '%' : '0%'
    const mixed = minVal < 0 && maxVal > 0

    if (mixed) {
      strokeColor = `url(#${gradId}-ln)`
      fillGrad = (
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
          <stop offset={zeroPct} stopColor={GREEN} stopOpacity={0.1} />
          <stop offset={zeroPct} stopColor={RED} stopOpacity={0.1} />
          <stop offset="100%" stopColor={RED} stopOpacity={0.28} />
        </linearGradient>
      )
      lineGrad = (
        <linearGradient id={`${gradId}-ln`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} />
          <stop offset={zeroPct} stopColor={GREEN} />
          <stop offset={zeroPct} stopColor={RED} />
          <stop offset="100%" stopColor={RED} />
        </linearGradient>
      )
    } else {
      const clr = maxVal <= 0 ? RED : GREEN
      strokeColor = clr
      fillGrad = (
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={clr} stopOpacity={0.3} />
          <stop offset="95%" stopColor={clr} stopOpacity={0.02} />
        </linearGradient>
      )
    }
    refLine = <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" strokeWidth={1} />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
        <defs>
          {fillGrad}
          {lineGrad}
        </defs>
        <XAxis dataKey="date" tickFormatter={fmtDate} interval="preserveStartEnd"
          tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} height={16} />
        <YAxis domain={yDomain} hide />
        {refLine}
        <Tooltip content={<WidgetTooltipContent />} />
        <Area type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={2}
          fill={`url(#${gradId})`} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Widget tile (mirrors desktop Widget component exactly) ────────────────────
function Widget({ label, data, color, gradId, zeroLine = false, children }: {
  label: string
  data: { date: string; value: number }[]
  color: string
  gradId: string
  zeroLine?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative bg-surface-800 border border-surface-600 rounded-xl p-2 flex gap-3 overflow-hidden cursor-pointer hover:border-surface-500 transition-colors">
      <div className="w-32 flex-shrink-0 flex flex-col justify-start overflow-hidden pl-3">
        <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium leading-tight">{label}</p>
        <div className="flex-1 flex flex-col justify-center items-start">
          {children}
        </div>
      </div>
      <div className="flex-1 min-h-0 opacity-80">
        <WidgetSparkline data={data} color={color} gradId={gradId} zeroLine={zeroLine} />
      </div>
    </div>
  )
}

// ── CSV export helper ─────────────────────────────────────────────────────────
function exportCsv(cards: Card[], filename: string) {
  const headers = ['Name', 'Set', 'Number', 'Condition', 'Quantity', 'Purchase Price', 'Market Price', 'P&L', '1D %', '1W %', '1M %']
  const rows = cards.map(c => {
    const pl = c.currentPrice != null && c.purchasePrice != null ? c.currentPrice - c.purchasePrice : null
    return [
      c.name,
      c.setName ?? '',
      c.number ?? '',
      c.condition,
      c.quantity,
      c.purchasePrice ?? '',
      c.currentPrice ?? '',
      pl != null ? pl.toFixed(2) : '',
      c.changeDay != null ? c.changeDay.toFixed(1) : '',
      c.changeWeek != null ? c.changeWeek.toFixed(1) : '',
      c.changeMonth != null ? c.changeMonth.toFixed(1) : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`)
  })
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function DashboardClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'collection') as Tab
  const [filter, setFilter] = useState('')
  const [viewMode, setViewMode] = useState<'detailed' | 'table'>('detailed')
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filterCondition, setFilterCondition] = useState<string>('')
  const [filterBinder, setFilterBinder] = useState<string>('')

  const utils = trpc.useUtils()
  const { data, isLoading, error } = trpc.portfolio.dashboard.useQuery(undefined, { staleTime: 60_000 })
  const removeCard = trpc.cards.remove.useMutation({ onSuccess: () => utils.portfolio.dashboard.invalidate() })

  // Supabase Realtime — invalidate dashboard query when desktop syncs a change
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
        utils.portfolio.dashboard.invalidate()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlists' }, () => {
        utils.portfolio.dashboard.invalidate()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [utils])

  const allPortfolio = data?.portfolio ?? []
  const cards: Card[] = tab === 'collection' ? allPortfolio : (data?.watchlist ?? [])
  const stats: PortfolioStats | undefined = data?.stats

  const totalInvested = stats?.totalCost ?? 0
  const totalValue = stats?.totalValue ?? 0
  const totalGain = stats?.totalGain ?? 0
  const dayChange = stats?.dayChange ?? 0
  const dayPos = dayChange > 0
  const dayNeg = dayChange < 0
  const dayColor = dayPos ? 'text-emerald-400' : dayNeg ? 'text-red-400' : 'text-slate-400'
  const dayArrow = dayPos ? '▲' : dayNeg ? '▼' : ''
  const profitColor = totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'
  const roiColor = (stats?.totalGainPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
  const plColor = totalGain >= 0 ? '#34d399' : '#f87171'

  const alertsUp = allPortfolio.filter(c => c.targetSellPrice != null).length
  const alertsDown = allPortfolio.filter(c => c.targetBuyPrice != null).length

  const vh = useMemo(() => toPortfolioHistory(allPortfolio), [allPortfolio])
  const plHist = useMemo(() => totalInvested > 0 ? toPlHistory(allPortfolio, totalInvested) : [], [allPortfolio, totalInvested])
  const roiHist = useMemo(() => totalInvested > 0 ? toRoiHistory(allPortfolio, totalInvested) : [], [allPortfolio, totalInvested])
  const dayHist = useMemo(() => toDayChangeHistory(vh), [vh])

  const binderOptions = useMemo(() => {
    const s = new Set<string>()
    cards.forEach(c => { if (c.binder) s.add(c.binder) })
    return Array.from(s).sort()
  }, [cards])

  const filtered = useMemo(() => {
    let list = cards
    const q = filter.trim().toLowerCase()
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.setName ?? '').toLowerCase().includes(q) ||
      (c.number ?? '').toLowerCase().includes(q)
    )
    if (filterCondition) list = list.filter(c => c.condition === filterCondition)
    if (filterBinder) list = list.filter(c => (c.binder ?? '') === filterBinder)
    return list
  }, [cards, filter, filterCondition, filterBinder])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => (b.currentPrice ?? 0) - (a.currentPrice ?? 0)),
    [filtered]
  )

  const activeFilters = [filterCondition, filterBinder].filter(Boolean).length

  function switchTab(t: Tab) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('tab', t)
    router.push(`/?${p}`)
    setFilter('')
    setBulkMode(false)
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAll() { setSelected(new Set(sorted.map(c => c.id))) }
  function clearSelection() { setSelected(new Set()); setBulkMode(false) }

  async function bulkRemove() {
    for (const id of selected) { await removeCard.mutateAsync(id) }
    clearSelection()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">Failed to load: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">

      {/* ── 3×2 Tiles — exact desktop grid ────────────────────────────────── */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-6 py-3"
        style={{ gridAutoRows: '132px' }}
      >
        {/* Collection Value */}
        <Widget label="Collection Value" data={vh} color="#f59e0b" gradId="pw-val">
          <p className="text-2xl font-bold text-white">{stats ? fmtUSD(totalValue) : '—'}</p>
          <p className="text-slate-400 text-xs mt-0.5">{stats?.cardCount ?? 0} cards with data</p>
        </Widget>

        {/* Today's Change */}
        <Widget label="Today's Change" data={dayHist} color={dayPos ? '#34d399' : dayNeg ? '#f87171' : '#64748b'} gradId="pw-day" zeroLine>
          <p className={`text-2xl font-bold ${dayColor}`}>
            {dayArrow}{dayArrow ? ' ' : ''}{stats ? fmtUSD(Math.abs(dayChange)) : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">vs yesterday</p>
        </Widget>

        {/* Cards Tracked — 3-column layout, no sparkline (same as desktop) */}
        <div className="relative bg-surface-800 border border-surface-600 rounded-xl p-2 pl-5 overflow-hidden flex flex-col justify-start">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium">Cards Tracked</p>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-0">
              <div className="flex-1 flex flex-col items-center">
                <p className="text-2xl font-bold text-white leading-tight">{stats?.cardCount ?? 0}</p>
                <p className="text-slate-500 text-xs mt-0.5">Total</p>
              </div>
              <div className="w-px self-stretch bg-surface-600 rounded-full mx-1 flex-shrink-0" />
              <div className="flex-1 flex flex-col items-center rounded-lg py-1">
                <p className={`text-2xl font-bold leading-tight ${alertsUp > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{alertsUp}</p>
                <p className="text-slate-500 text-xs mt-0.5 text-center">↑ Alerts</p>
              </div>
              <div className="w-px self-stretch bg-surface-600 rounded-full mx-1 flex-shrink-0" />
              <div className="flex-1 flex flex-col items-center rounded-lg py-1">
                <p className={`text-2xl font-bold leading-tight ${alertsDown > 0 ? 'text-red-400' : 'text-slate-500'}`}>{alertsDown}</p>
                <p className="text-slate-500 text-xs mt-0.5 text-center">↓ Alerts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Invested */}
        <Widget label="Total Invested" data={[]} color="#64748b" gradId="pw-inv">
          <p className="text-2xl font-bold text-white">
            {stats && totalInvested > 0 ? fmtUSD(totalInvested) : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">
            {stats ? `${allPortfolio.filter(c => c.purchasePrice != null).length} of ${allPortfolio.length} cards` : '—'}
          </p>
        </Widget>

        {/* Total P&L */}
        <Widget label="Total P&L" data={plHist} color={plColor} gradId="pw-pl" zeroLine>
          <p className={`text-2xl font-bold ${profitColor}`}>
            {stats && totalInvested > 0 ? `${sign(totalGain)}${fmtUSD(Math.abs(totalGain))}` : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">vs cost basis</p>
        </Widget>

        {/* Return (ROI) */}
        <Widget label="Return (ROI)" data={roiHist} color={plColor} gradId="pw-roi" zeroLine>
          <p className={`text-2xl font-bold ${roiColor}`}>
            {stats && totalInvested > 0
              ? `${sign(stats.totalGainPct)}${Math.abs(stats.totalGainPct).toFixed(1)}%`
              : '—'}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">total return</p>
        </Widget>
      </div>

      {/* ── Collection sub-bar ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-6 py-3">
        {/* Title */}
        <h2 className="text-white font-bold text-xl whitespace-nowrap">
          {tab === 'collection' ? 'My Collection' : 'My Watchlist'}
        </h2>

        {/* Add buttons */}
        {tab === 'collection' ? (
          <Link href="/search" className="px-4 py-1.5 bg-accent hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
            + Add to Collection
          </Link>
        ) : (
          <Link href="/search" className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
            + Add to Watchlist
          </Link>
        )}
        <Link href="/sealed" className="px-4 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/50 hover:border-blue-600 text-blue-300 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
          + Add Sealed
        </Link>

        {/* Bulk Edit */}
        {!bulkMode ? (
          <button
            disabled={sorted.length === 0}
            onClick={() => setBulkMode(true)}
            className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-40 border border-red-700/50 hover:border-red-600 text-red-400 hover:text-red-300 text-sm font-medium rounded-lg transition-colors"
          >
            Bulk Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{selected.size} selected</span>
            <button onClick={selectAll} className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-surface-700 rounded transition-colors">All</button>
            <button
              onClick={bulkRemove}
              disabled={selected.size === 0 || removeCard.isPending}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {removeCard.isPending ? 'Removing…' : `Remove (${selected.size})`}
            </button>
            <button onClick={clearSelection} className="px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-surface-900 border border-surface-600 rounded-lg p-0.5 flex-shrink-0 ml-auto">
          {(['detailed', 'table'] as const).map(v => (
            <button key={v}
              onClick={() => setViewMode(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${viewMode === v ? 'bg-surface-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {v === 'detailed' ? 'Detailed' : 'Table'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="relative">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-sm font-medium rounded-lg transition-colors ${
              activeFilters > 0
                ? 'bg-accent/10 border-accent/50 text-accent'
                : 'bg-surface-700 border-surface-500 text-slate-300 hover:text-white hover:bg-surface-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2" />
            </svg>
            Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
            <svg className={`w-3 h-3 flex-shrink-0 transition-transform ${showFilters ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showFilters && (
            <div className="absolute right-0 top-full mt-1 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl z-50 min-w-[220px] p-3 space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Condition</label>
                <select
                  value={filterCondition}
                  onChange={e => setFilterCondition(e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
                >
                  <option value="">All conditions</option>
                  {['raw', 'psa10', 'psa9', 'psa8', 'cgc10', 'cgc9'].map(c => (
                    <option key={c} value={c}>{c === 'raw' ? 'Raw' : c.replace(/^([a-z]+)(\d+)$/, (_, g, n) => `${g.toUpperCase()} ${n}`)}</option>
                  ))}
                </select>
              </div>
              {binderOptions.length > 0 && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Binder</label>
                  <select
                    value={filterBinder}
                    onChange={e => setFilterBinder(e.target.value)}
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">All binders</option>
                    {binderOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}
              {activeFilters > 0 && (
                <button
                  onClick={() => { setFilterCondition(''); setFilterBinder('') }}
                  className="w-full text-xs text-slate-400 hover:text-white py-1 text-center transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <button
          disabled={sorted.length === 0}
          onClick={() => exportCsv(sorted, `pokeprice-${tab}-${new Date().toISOString().slice(0,10)}.csv`)}
          className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 text-sm font-medium rounded-lg transition-colors"
        >
          Export
        </button>

        {/* Share — placeholder (needs backend URL generation) */}
        <button
          disabled={sorted.length === 0}
          className="px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 border border-violet-500/50 hover:border-violet-400 text-violet-400 hover:text-violet-300 text-sm font-medium rounded-lg transition-colors"
        >
          Share
        </button>
      </div>

      {/* Bottom border — same as desktop mx-6 inset */}
      <div className="flex-shrink-0 border-b border-surface-700 mx-6" />

      {/* ── Card list ─────────────────────────────────────────────────────── */}
      <div className="flex-1" onClick={() => showFilters && setShowFilters(false)}>
        {isLoading && !data ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-800 border-b border-surface-700 animate-pulse" />
            ))}
          </div>
        ) : (
          <CardList
            cards={sorted}
            soldCards={data?.sold ?? []}
            viewMode={viewMode}
            bulkMode={bulkMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            emptyMessage={
              filter || activeFilters > 0
                ? `No cards match current filters`
                : tab === 'collection'
                  ? 'Your collection is empty — click Add to Collection to get started.'
                  : 'Your watchlist is empty.'
            }
          />
        )}
      </div>
    </div>
  )
}
