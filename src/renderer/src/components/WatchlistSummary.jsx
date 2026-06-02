import { useMemo, useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, Tooltip, LabelList
} from 'recharts'
import { CardDetailModal } from '../pages/SearchPage'
import { useCurrency } from '../context/CurrencyContext'

const DOT_COLORS = ['#38bdf8', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#fb923c', '#e879f9', '#94a3b8']
const GRADED_CONDITIONS = new Set(['psa10', 'psa9', 'psa8', 'cgc10', 'cgc9'])

function BarTip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs pointer-events-none">
      <p className="text-slate-400 mb-0.5">{payload[0].payload.name}</p>
      <p className="text-white font-medium">{payload[0].value}</p>
    </div>
  )
}

function extractPokemonName(name) {
  return name
    .replace(/\s+(VMAX|VSTAR|VUNION|V|GX|EX|ex|Prime|LEGEND|TAG TEAM)(\s.*)?$/i, '')
    .replace(/[-–](GX|EX|V|ex)(\s.*)?$/i, '')
    .trim()
}

function fmtSetDate(releaseDate) {
  if (!releaseDate) return ''
  try {
    const iso = releaseDate.replace(/\//g, '-')
    const d = new Date(iso + 'T12:00:00')
    return `${d.toLocaleDateString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
  } catch { return '' }
}

function abbrevSeries(series) {
  if (!series) return ''
  const words = series.split(/[\s&\-–]+/).filter(w => w.length > 0 && w !== '&')
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 4)
}

function buildSyntheticCard(card) {
  return {
    id: card.tcgId,
    name: card.name,
    images: { small: card.imageUrl, large: card.imageUrlLarge || card.imageUrl },
    set: { name: card.setName },
    number: card.number,
    rarity: card.rarity,
    tcgplayer: card.currentPrice != null
      ? { prices: { normal: { market: card.currentPrice } } }
      : null,
  }
}

export default function WatchlistSummary({ cards, onRefresh }) {
  const { format } = useCurrency()
  const [modalCard, setModalCard] = useState(null)
  const [allSets, setAllSets] = useState([])

  useEffect(() => {
    window.api.listSets().then(setAllSets).catch(() => {})
  }, [])

  const stats = useMemo(() => {
    // Daily cumulative — one data point per day cards were added
    const dayCounts = {}
    for (const card of cards) {
      if (!card.addedDate) continue
      const d = new Date(card.addedDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      dayCounts[key] = (dayCounts[key] || 0) + 1
    }
    let cumSum = 0
    const sortedKeys = Object.keys(dayCounts).sort()
    const itemsOverTime = sortedKeys.map((k) => {
      cumSum += dayCounts[k]
      const d = new Date(k + 'T12:00:00')
      return { name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: cumSum, isAdded: true }
    })
    const todayKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })()
    if (itemsOverTime.length > 0 && sortedKeys[sortedKeys.length - 1] !== todayKey) {
      const todayLabel = new Date(todayKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      itemsOverTime.push({ name: todayLabel, value: cumSum })
    }

    // Raw / Graded / Sealed counts
    let rawCount = 0, gradedCount = 0, sealedCount = 0
    for (const c of cards) {
      const cond = c.condition || 'raw'
      if (cond === 'raw') rawCount++
      else if (GRADED_CONDITIONS.has(cond)) gradedCount++
      else sealedCount++
    }

    // Top 6 Pokémon by extracted base name
    const pokeCounts = {}
    for (const c of cards) {
      const n = extractPokemonName(c.name)
      pokeCounts[n] = (pokeCounts[n] || 0) + 1
    }
    const pokemonTop = Object.entries(pokeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    // All sets — no slice cap
    const setCounts = {}
    for (const c of cards) {
      const key = c.setName || 'Unknown'
      if (!setCounts[key]) setCounts[key] = { count: 0, setId: c.setId }
      setCounts[key].count++
    }
    const setBreakdown = Object.entries(setCounts)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([name, { count, setId }]) => ({ name, value: count, setId }))
    const setTotal = setBreakdown.reduce((s, d) => s + d.value, 0)

    // Cards with triggered price alerts
    const alertCards = cards.filter(c => {
      if (c.alertPrice == null || c.currentPrice == null) return false
      const isUp = c.alertPct != null ? c.alertPct > 0 : c.alertPrice > c.currentPrice
      return isUp ? c.currentPrice >= c.alertPrice : c.currentPrice <= c.alertPrice
    })
    const alertSet = cards.filter(c => c.alertPrice != null).length

    return { itemsOverTime, rawCount, gradedCount, sealedCount, pokemonTop, setBreakdown, setTotal, alertCards, alertSet }
  }, [cards])

  async function openCard(alertCardEntry) {
    try {
      const results = await window.api.searchCardsAdvanced(`id:"${alertCardEntry.tcgId}"`)
      setModalCard(results?.[0] ?? buildSyntheticCard(alertCardEntry))
    } catch {
      setModalCard(buildSyntheticCard(alertCardEntry))
    }
  }

  async function handleModalRemove(tcgCard, section) {
    const owned = cards.find((c) =>
      c.tcgId === tcgCard.id &&
      (section === 'collection' ? c.section === 'collection' : (!c.section || c.section === 'watchlist'))
    )
    if (!owned) return
    await window.api.removeCard(owned.id)
    setModalCard(null)
    onRefresh?.()
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 px-6 pb-2" style={{ gridAutoRows: '132px' }}>

        {/* Tile 1 – Count of Watchlist Items */}
        <div className="relative bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col overflow-hidden">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium flex-shrink-0">Count of Watchlist Items</p>
          <div className="flex-1 min-h-0 flex gap-4">
            <div className="flex-shrink-0 flex flex-col justify-center items-center text-center w-16">
              <p className="text-5xl font-bold text-white leading-none">{cards.length}</p>
              <p className="text-slate-400 text-sm mt-1 leading-none">items</p>
              <p className="text-slate-600 text-[10px] mt-1.5 leading-none">
                ~{stats.itemsOverTime.length > 0 ? (cards.length / stats.itemsOverTime.length).toFixed(1) : '—'} avg/day
              </p>
            </div>
            <div className="flex-1 min-h-0 opacity-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.itemsOverTime} margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                  <defs>
                    <linearGradient id="wl-time-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    height={14}
                    interval="preserveStartEnd"
                  />
                  <YAxis domain={[0, 'dataMax']} hide />
                  <Tooltip content={<BarTip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fill="url(#wl-time-grad)"
                    dot={(dotProps) => {
                      const { cx, cy, payload } = dotProps
                      if (!payload?.isAdded) return null
                      return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="#ffffff" stroke="#38bdf8" strokeWidth={1} />
                    }}
                    activeDot={{ r: 3, fill: '#38bdf8' }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tile 2 – Item Types: Raw / Graded / Sealed */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium flex-shrink-0">Item Types</p>
          <div className="flex-1 flex items-center">
            {[
              { label: 'Raw', value: stats.rawCount },
              { label: 'Graded', value: stats.gradedCount },
              { label: 'Sealed', value: stats.sealedCount },
            ].map(({ label, value }, i) => (
              <div
                key={label}
                className={`flex-1 flex flex-col items-center justify-center${i > 0 ? ' border-l border-surface-600' : ''}`}
              >
                <span className="text-2xl font-bold text-white leading-none">{value}</span>
                <span className="text-xs text-slate-500 mt-1.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tile 3 – Pokémon Count */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium flex-shrink-0">Pokémon Count</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.pokemonTop} margin={{ top: 14, right: 2, bottom: 0, left: 2 }} barCategoryGap="20%">
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  height={14}
                  interval={0}
                />
                <YAxis hide />
                <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="value" fill="#f59e0b" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="value" position="top" style={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tile 4 – Set Breakdown */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium flex-shrink-0">Set Breakdown</p>
          <div className="flex-1 min-h-0 flex gap-6">
            <div className="flex-shrink-0 flex flex-col justify-center items-center text-center w-16">
              <p className="text-5xl font-bold text-white leading-none">{cards.length}</p>
              <p className="text-slate-400 text-sm mt-1 leading-none">items</p>
              <p className="text-slate-600 text-[10px] mt-1.5 leading-none">
                ~{stats.itemsOverTime.length > 0 ? (cards.length / stats.itemsOverTime.length).toFixed(1) : '—'} avg/day
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.setBreakdown} margin={{ top: 14, right: 2, bottom: 0, left: 2 }} barCategoryGap="20%">
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    height={14}
                    interval={0}
                    tickFormatter={(v) => v.length > 6 ? v.slice(0, 6) + '…' : v}
                  />
                  <YAxis hide />
                  <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="top" style={{ fill: '#94a3b8', fontSize: 9, fontWeight: 500 }} />
                    {stats.setBreakdown.map((_, i) => (
                      <Cell key={i} fill={DOT_COLORS[i % DOT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tile 5 – Price Alerts Active */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs uppercase tracking-wider font-medium flex-shrink-0 leading-none">Price Alerts Active</p>
          {stats.alertCards.length > 0 ? (
            <p className="text-lg font-bold text-accent mt-1 mb-1 flex-shrink-0 leading-none">
              {stats.alertCards.length}
              <span className="text-slate-500 text-sm font-normal ml-1">triggered</span>
            </p>
          ) : (
            <p className="text-slate-600 text-xs mt-1 flex-shrink-0">
              {stats.alertSet > 0
                ? `${stats.alertSet} alert${stats.alertSet !== 1 ? 's' : ''} set · none triggered`
                : 'No price alerts set'}
            </p>
          )}
          {stats.alertCards.length > 0 && (
            <>
              <div className="flex items-center gap-1 pb-1 mb-0.5 border-b border-surface-700 flex-shrink-0">
                <span className="w-8 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider">Ser</span>
                <span className="w-12 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider">Set</span>
                <span className="flex-1 text-slate-600 text-[8px] uppercase tracking-wider">Card</span>
                <span className="w-5 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider text-center">#</span>
                <span className="w-8 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider text-right">1W%</span>
                <span className="w-10 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider text-right">1W$</span>
                <span className="w-12 flex-shrink-0 text-slate-600 text-[8px] uppercase tracking-wider text-right">Price</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {stats.alertCards.map((card) => {
                  const pct = card.changeWeek
                  const pctText = pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' : '—'
                  const pctColor = pct == null ? 'text-slate-600' : pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-slate-400'
                  const weekDollar = pct != null && card.currentPrice != null ? card.currentPrice * pct / 100 : null
                  const weekDollarText = weekDollar != null
                    ? (weekDollar > 0 ? '+' : weekDollar < 0 ? '-' : '') + format(Math.abs(weekDollar))
                    : '—'
                  const weekDollarColor = weekDollar == null ? 'text-slate-600' : weekDollar > 0 ? 'text-emerald-400' : weekDollar < 0 ? 'text-red-400' : 'text-slate-400'
                  const setInfo = allSets.find(s => s.id === card.setId || s.name === card.setName)
                  const series = abbrevSeries(setInfo?.series)
                  return (
                    <button
                      key={card.id}
                      onClick={() => openCard(card)}
                      className="w-full flex items-center gap-1 hover:bg-surface-700 rounded px-0.5 py-0.5 transition-colors text-left group"
                    >
                      <span className="w-8 flex-shrink-0 truncate text-slate-500 text-[9px] font-medium">{series || '—'}</span>
                      <span className="w-12 flex-shrink-0 truncate text-slate-400 text-[10px]">{card.setName}</span>
                      <span className="flex-1 min-w-0 truncate text-white text-[10px] font-medium group-hover:text-sky-300 transition-colors">
                        {card.name}
                      </span>
                      <span className="w-5 flex-shrink-0 text-slate-600 text-[9px] text-center truncate">
                        {card.number ? `#${card.number}` : '—'}
                      </span>
                      <span className={`w-8 flex-shrink-0 text-[10px] text-right ${pctColor}`}>{pctText}</span>
                      <span className={`w-10 flex-shrink-0 text-[9px] text-right ${weekDollarColor}`}>{weekDollarText}</span>
                      <span className="w-12 flex-shrink-0 text-accent text-[10px] font-semibold text-right">
                        {card.currentPrice != null ? format(card.currentPrice) : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Tile 6 – Blank */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2" />

      </div>

      {modalCard && (
        <CardDetailModal
          card={modalCard}
          ownedCards={cards}
          onAdd={() => { onRefresh?.(); setModalCard(null) }}
          onRemove={handleModalRemove}
          onClose={() => setModalCard(null)}
        />
      )}
    </>
  )
}
