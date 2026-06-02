import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts'

const RANGES = [
  { label: '1M',  days: 30 },
  { label: '3M',  days: 90 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
  { label: 'YTD', days: 'ytd' },
  { label: 'All', days: Infinity }
]

// Deterministic seeded PRNG so synthetic data stays stable across renders
function seededRand(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// Generates 90 days of realistic synthetic price history before anchorDate.
// Uses a seeded RNG so the result is identical every render for the same card.
function generateSynthetic(basePrice, anchorDate, days = 90) {
  const parts = anchorDate.split('-')
  const seed = parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2]) + Math.round(basePrice * 100)
  const rand = seededRand(seed)

  const entries = []
  let price = basePrice
  for (let i = days; i >= 1; i--) {
    const d = new Date(anchorDate + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const date = d.toISOString().split('T')[0]
    // Bounded random walk: ±2% per day, slight mean-reversion toward basePrice
    const drift = (rand() - 0.5) * 0.04 * price + (basePrice - price) * 0.02
    price = Math.max(0.01, Math.round((price + drift) * 100) / 100)
    entries.push({ date, price, synthetic: true })
  }
  return entries
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const price = p.realPrice ?? p.syntheticPrice
  if (price == null) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-slate-400 text-xs mb-0.5">{p.fullDate}</p>
      <p className="text-white font-bold text-base">${price.toFixed(2)}</p>
      {p.isSynthetic ? (
        <p className="text-slate-500 text-xs mt-0.5">Estimated</p>
      ) : p.source ? (
        <p className="text-slate-500 text-xs mt-0.5">
          {p.source === 'manual' ? 'Manual' : 'PriceCharting'}
        </p>
      ) : null}
    </div>
  )
}

function formatXLabel(dateStr, totalDays) {
  const [, month, day] = dateStr.split('-')
  if (totalDays <= 90) return `${month}/${day}`
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(month, 10) - 1]} ${day}`
}

const PLACEHOLDER_WAVE = Array.from({ length: 20 }, (_, i) => ({
  date: String(i),
  price: 50 + Math.sin(i * 0.5) * 9 + Math.sin(i * 1.2) * 4
}))

export default function PriceChart({ history, range, onRangeChange, conditionSlot, showRangeButtons = true }) {
  // Prepend 90 days of synthetic data before the first real data point
  const combined = useMemo(() => {
    if (!history || history.length === 0) return []
    const synthetic = generateSynthetic(history[0].price, history[0].date, 90)
    return [...synthetic, ...history]
  }, [history?.[0]?.price, history?.[0]?.date, history?.length])

  if (!history || history.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {showRangeButtons && (
          <div className="flex items-center gap-1 mb-4 flex-wrap flex-shrink-0">
            {RANGES.map((r) => (
              <button key={r.label} disabled
                className="px-3 py-1 rounded text-xs font-medium bg-surface-600 text-slate-700 cursor-default">
                {r.label}
              </button>
            ))}
            {conditionSlot ? (
              <div className="ml-auto flex gap-1">{conditionSlot}</div>
            ) : (
              <span className="ml-auto text-slate-700 text-xs self-center">No data yet</span>
            )}
          </div>
        )}
        <div className="relative flex-1 min-h-[180px] pt-2 pb-1 px-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={PLACEHOLDER_WAVE} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="pcGradPh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1e293b" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#0d1424" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'transparent' }} tickLine={false} axisLine={false} />
              <YAxis domain={[35, 65]} tick={{ fill: 'transparent' }} tickLine={false} axisLine={false} width={52} />
              <Area type="monotone" dataKey="price" stroke="#243044" strokeWidth={2}
                fill="url(#pcGradPh)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-600 text-sm">History builds daily</p>
          </div>
        </div>
      </div>
    )
  }

  const cutoff = range === Infinity
    ? null
    : range === 'ytd'
    ? `${new Date().getFullYear()}-01-01`
    : (() => { const d = new Date(); d.setDate(d.getDate() - range); return d.toISOString().split('T')[0] })()

  const filtered = cutoff ? combined.filter((p) => p.date >= cutoff) : combined

  if (filtered.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {showRangeButtons && (
          <div className="flex items-center gap-1 mb-4 flex-wrap flex-shrink-0">
            {RANGES.map((r) => (
              <button key={r.label} onClick={() => onRangeChange(r.days)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${range === r.days ? 'bg-accent text-black' : 'bg-surface-600 text-slate-400 hover:bg-surface-500'}`}>
                {r.label}
              </button>
            ))}
            {conditionSlot && <div className="ml-auto flex gap-1">{conditionSlot}</div>}
          </div>
        )}
        <div className="flex items-center justify-center flex-1 min-h-[180px] text-slate-600 text-sm">
          No data in this range
        </div>
      </div>
    )
  }

  const totalDays = (range === Infinity || range === 'ytd')
    ? Math.ceil((new Date(filtered[filtered.length - 1].date) - new Date(filtered[0].date)) / 86400000)
    : range

  const data = filtered.map((p) => ({
    date: formatXLabel(p.date, totalDays),
    fullDate: p.date,
    price: p.price,
    source: p.source,
    isSynthetic: !!p.synthetic,
    syntheticPrice: p.synthetic ? p.price : undefined,
    realPrice: !p.synthetic ? p.price : undefined
  }))

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.12 || max * 0.05 || 1

  // Color based on real data trend only
  const realPrices = data.filter((d) => !d.isSynthetic).map((d) => d.price)
  const first = realPrices[0] ?? prices[0]
  const last = realPrices[realPrices.length - 1] ?? prices[prices.length - 1]
  const color = last >= first ? '#34d399' : '#f87171'

  const tickInterval = data.length > 60 ? Math.floor(data.length / 8) : data.length > 20 ? Math.floor(data.length / 6) : 'preserveStartEnd'

  // Find the formatted date of the first real data point for the transition marker
  const firstRealDate = data.find((d) => !d.isSynthetic)?.date
  const hasSynthetic = data.some((d) => d.isSynthetic)

  return (
    <div className="h-full flex flex-col">
      {showRangeButtons && (
        <div className="flex items-center gap-1 mb-4 flex-wrap flex-shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => onRangeChange(r.days)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                range === r.days
                  ? 'bg-accent text-black'
                  : 'bg-surface-600 text-slate-400 hover:bg-surface-500'
              }`}
            >
              {r.label}
            </button>
          ))}

          {conditionSlot && (
            <div className="ml-auto flex gap-1">
              {conditionSlot}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-[180px] pt-2 pb-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="pcGradSynth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              padding={{ left: 16, right: 16 }}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fill: '#64748b', fontSize: 11, textAnchor: 'start', dx: 4 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
              width={0}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Synthetic (estimated) segment — gray dashed */}
            <Area
              type="monotone"
              dataKey="syntheticPrice"
              stroke="#4b5563"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="url(#pcGradSynth)"
              dot={false}
              activeDot={{ r: 3, fill: '#6b7280', strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Real data segment — colored solid */}
            <Area
              type="monotone"
              dataKey="realPrice"
              stroke={color}
              strokeWidth={2}
              fill="url(#pcGrad)"
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Transition marker where live data begins */}
            {hasSynthetic && firstRealDate && (
              <ReferenceLine
                x={firstRealDate}
                stroke="#334155"
                strokeDasharray="3 3"
                label={{ value: 'Live data', position: 'insideTopRight', fill: '#475569', fontSize: 10, dy: -4 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
