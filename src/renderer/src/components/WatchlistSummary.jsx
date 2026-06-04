import { useMemo, useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { CardDetailModal } from '../pages/SearchPage'
import { useCurrency } from '../context/CurrencyContext'

const GRADED_CONDITIONS = new Set(['psa10', 'psa9', 'psa8', 'cgc10', 'cgc9'])

function AreaTip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs pointer-events-none">
      <p className="text-slate-400 mb-0.5">{payload[0].payload.name}</p>
      <p className="text-white font-medium">{payload[0].value}</p>
    </div>
  )
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

    // All cards with a price alert set; triggered ones sorted first
    const allAlertCards = cards.filter(c => c.alertPrice != null)
    const isTriggered = (c) => {
      if (c.currentPrice == null) return false
      const isUp = c.alertPct != null ? c.alertPct > 0 : c.alertPrice > c.currentPrice
      return isUp ? c.currentPrice >= c.alertPrice : c.currentPrice <= c.alertPrice
    }
    allAlertCards.sort((a, b) => Number(isTriggered(b)) - Number(isTriggered(a)))

    return { itemsOverTime, rawCount, gradedCount, sealedCount, allAlertCards, isTriggered }
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
                  <Tooltip content={<AreaTip />} />
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

        {/* Tile 3 – Price Alerts */}
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-2 flex flex-col">
          <p className="text-slate-500 text-xs uppercase tracking-wider font-medium flex-shrink-0 leading-none">Price Alerts</p>
          {stats.allAlertCards.length === 0 ? (
            <p className="text-slate-600 text-xs mt-2">No price alerts set</p>
          ) : (
            <div className="flex-1 min-h-0 flex gap-3 pt-2.5">
              {/* Count */}
              <div className="flex-shrink-0 flex flex-col justify-center items-center text-center w-12">
                <p className="text-5xl font-bold text-white leading-none">{stats.allAlertCards.length}</p>
                <p className="text-slate-400 text-sm mt-1 leading-none">alerts</p>
              </div>
              {/* Table */}
              <div className="flex-1 min-w-0 flex flex-col mt-3 pr-2">
              <div className="flex items-center gap-2 pb-1 border-b border-surface-700 flex-shrink-0">
                <div className="flex-1 min-w-0 flex gap-2">
                  <span className="w-1/3 text-slate-400 text-[9px] uppercase tracking-wider">Card</span>
                  <span className="flex-1 text-slate-400 text-[9px] uppercase tracking-wider">Series / Set</span>
                </div>
                <span className="w-14 flex-shrink-0 text-slate-400 text-[9px] uppercase tracking-wider">Cond</span>
                <span className="w-14 flex-shrink-0 text-slate-400 text-[9px] uppercase tracking-wider">Alert $</span>
                <span className="w-14 flex-shrink-0 text-slate-400 text-[9px] uppercase tracking-wider">Diff</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
                {stats.allAlertCards.map((card) => {
                  const triggered = stats.isTriggered(card)
                  const setInfo = allSets.find(s => s.id === card.setId || s.name === card.setName)
                  const series = setInfo?.series || null
                  const cond = card.condition || 'raw'
                  const condLabel = cond === 'raw' ? 'Raw'
                    : cond === 'psa10' ? 'PSA 10'
                    : cond === 'psa9'  ? 'PSA 9'
                    : cond === 'psa8'  ? 'PSA 8'
                    : cond === 'cgc10' ? 'CGC 10'
                    : cond === 'cgc9'  ? 'CGC 9'
                    : cond
                  return (
                    <button
                      key={card.id}
                      onClick={() => openCard(card)}
                      className="w-full flex items-center gap-2 hover:bg-surface-700 rounded px-0.5 py-1 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0 flex gap-2">
                        <span className={`w-1/3 min-w-0 truncate text-xs font-medium group-hover:text-sky-300 transition-colors ${triggered ? 'text-accent' : 'text-white'}`}>
                          {card.name}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-xs text-slate-400">
                          {series ? `${series} - ${card.setName}` : card.setName}
                        </span>
                      </div>
                      <span className="w-14 flex-shrink-0 text-slate-400 text-[11px]">{condLabel}</span>
                      <span className={`w-14 flex-shrink-0 text-xs font-semibold ${triggered ? 'text-accent' : 'text-slate-300'}`}>
                        {format(card.alertPrice)}
                      </span>
                      {(() => {
                        const diff = card.currentPrice != null ? card.currentPrice - card.alertPrice : null
                        const diffText = diff != null ? (diff >= 0 ? '+' : '') + format(diff) : '—'
                        const diffColor = diff == null ? 'text-slate-600' : diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'
                        return (
                          <span className={`w-14 flex-shrink-0 text-xs font-medium ${diffColor}`}>
                            {diffText}
                          </span>
                        )
                      })()}
                    </button>
                  )
                })}
              </div>
              </div>
            </div>
          )}
        </div>

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
