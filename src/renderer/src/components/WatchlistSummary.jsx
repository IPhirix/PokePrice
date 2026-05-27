import { useMemo, useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LabelList
} from 'recharts'
import { CardDetailModal } from '../pages/SearchPage'
import { useCurrency } from '../context/CurrencyContext'

const COND_LABELS = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }
const DOT_COLORS = ['#38bdf8', '#a78bfa', '#f59e0b', '#34d399', '#f87171', '#fb923c', '#e879f9', '#94a3b8']

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
    const itemsOverTime = Object.entries(dayCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        cumSum += v
        const d = new Date(k + 'T12:00:00')
        return { name: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: cumSum }
      })

    // Count by condition/grade
    const typeCounts = {}
    for (const c of cards) {
      const cond = c.condition || 'raw'
      typeCounts[cond] = (typeCounts[cond] || 0) + 1
    }
    const itemTypes = Object.entries(typeCounts)
      .map(([k, v]) => ({ name: COND_LABELS[k] || k, value: v }))
      .sort((a, b) => b.value - a.value)

    // Top 6 Pokémon by extracted base name (vertical bar chart)
    const pokeCounts = {}
    for (const c of cards) {
      const n = extractPokemonName(c.name)
      pokeCounts[n] = (pokeCounts[n] || 0) + 1
    }
    const pokemonTop = Object.entries(pokeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    // All sets — store setId for metadata lookup, no slice cap
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

    // Cards at or under buy price alert
    const alertCards = cards.filter(c =>
      c.currentPrice != null && c.targetBuyPrice != null && c.currentPrice <= c.targetBuyPrice
    )
    const alertSet = cards.filter(c => c.targetBuyPrice != null).length

    return { itemsOverTime, itemTypes, pokemonTop, setBreakdown, setTotal, alertCards, alertSet }
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

        {/* Tile 1 – Count of Watchlist Items (daily area chart, portfolio style) */}
        <div className="relative bg-surface-800 border border-surface-600 rounded-xl p-2 flex gap-3 overflow-hidden">
          <div className="flex-shrink-0 min-w-0 flex flex-col justify-center">
            <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium">Count of Watchlist Items</p>
            <p className="text-2xl font-bold text-white">
              {cards.length}
              <span className="text-slate-500 text-sm font-normal"> items</span>
            </p>
            <p className="text-slate-600 text-xs mt-0.5">
              {stats.itemsOverTime.length} day{stats.itemsOverTime.length !== 1 ? 's' : ''} with additions
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
                  dot={false}
                  activeDot={{ r: 3, fill: '#38bdf8' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tile 2 – Item types */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-medium flex-shrink-0">Item Types</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.itemTypes} margin={{ top: 0, right: 2, bottom: 0, left: 2 }} barCategoryGap="20%">
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
                <Bar dataKey="value" fill="#a78bfa" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tile 3 – Pokémon count (vertical bar chart with count labels) */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-medium flex-shrink-0">Pokémon Count</p>
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

        {/* Tile 4 – Set breakdown (scrollable 5-column table) */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">Set Breakdown</p>
            <span className="text-slate-400 text-xs font-medium">
              {stats.setBreakdown.length} unique set{stats.setBreakdown.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {stats.setBreakdown.map((d, i) => {
              const setInfo = allSets.find(s => s.id === d.setId || s.name === d.name)
              const series = setInfo?.series || ''
              const releaseDate = fmtSetDate(setInfo?.releaseDate)
              return (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                  />
                  {/* Col 1 – Set name */}
                  <span className="flex-1 min-w-0 truncate text-slate-300 text-[11px]">{d.name}</span>
                  {/* Col 2 – Parent series */}
                  <span className="w-[72px] flex-shrink-0 truncate text-slate-500 text-[10px]">{series}</span>
                  {/* Col 3 – Release date */}
                  <span className="w-[46px] flex-shrink-0 text-slate-500 text-[10px] text-right">{releaseDate}</span>
                  {/* Col 4 – Progress bar */}
                  <div className="w-10 h-1 bg-surface-700 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stats.setTotal > 0 ? (d.value / stats.setTotal) * 100 : 0}%`,
                        background: DOT_COLORS[i % DOT_COLORS.length],
                      }}
                    />
                  </div>
                  {/* Col 5 – Count */}
                  <span className="w-4 flex-shrink-0 text-slate-500 text-[10px] text-right">{d.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tile 5 – At or under buy price (4-column table with headers) */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium">At or Under Buy Price</p>
            {stats.alertCards.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                {stats.alertCards.length}
              </span>
            )}
          </div>
          {stats.alertCards.length === 0 ? (
            <p className="text-slate-600 text-xs mt-1">
              {stats.alertSet > 0
                ? `${stats.alertSet} alert${stats.alertSet !== 1 ? 's' : ''} set · none triggered`
                : 'No buy alerts set'}
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-1.5 pb-1.5 mb-1 border-b border-surface-700 flex-shrink-0">
                <span className="w-[72px] flex-shrink-0 text-slate-600 text-[9px] uppercase tracking-wider">Set</span>
                <span className="flex-1 text-slate-600 text-[9px] uppercase tracking-wider">Card</span>
                <span className="w-12 flex-shrink-0 text-slate-600 text-[9px] uppercase tracking-wider text-right">1W %</span>
                <span className="w-[58px] flex-shrink-0 text-slate-600 text-[9px] uppercase tracking-wider text-right">Price</span>
              </div>
              {/* Rows */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-0.5">
                {stats.alertCards.map((card) => {
                  const pct = card.changeWeek
                  const pctText = pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' : '—'
                  const pctColor = pct == null ? 'text-slate-600' : pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-slate-400'
                  return (
                    <button
                      key={card.id}
                      onClick={() => openCard(card)}
                      className="w-full flex items-center gap-1.5 hover:bg-surface-700 rounded px-1 py-1 transition-colors text-left group"
                    >
                      <span className="w-[72px] flex-shrink-0 truncate text-slate-500 text-[10px]">
                        {card.setName}
                      </span>
                      <div className="flex-1 min-w-0 truncate">
                        <span className="text-white text-[11px] font-medium group-hover:text-sky-300 transition-colors">
                          {card.name}
                        </span>
                        {card.number && (
                          <span className="text-slate-600 text-[10px] ml-1">#{card.number}</span>
                        )}
                      </div>
                      <span className={`w-12 flex-shrink-0 text-[10px] text-right ${pctColor}`}>{pctText}</span>
                      <span className="w-[58px] flex-shrink-0 text-emerald-400 text-[11px] font-semibold text-right">
                        {card.currentPrice != null ? format(card.currentPrice) : '—'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Tile 6 – Blank (reserved) */}
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
