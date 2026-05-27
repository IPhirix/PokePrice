import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'

function seededRand(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

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
    const drift = (rand() - 0.5) * 0.04 * price + (basePrice - price) * 0.02
    price = Math.max(0.01, Math.round((price + drift) * 100) / 100)
    entries.push({ date, price, synthetic: true })
  }
  return entries
}

function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const price = p.realPrice ?? p.syntheticPrice
  if (price == null) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs">
      {p.date && <p className="text-slate-400 mb-0.5">{fmtDate(p.date)}</p>}
      <p className="text-white font-medium">${price.toFixed(2)}</p>
      {p.isSynthetic && <p className="text-slate-500 text-[10px] mt-0.5">Estimated</p>}
    </div>
  )
}

const PLACEHOLDER_DATA = Array.from({ length: 14 }, (_, i) => ({
  price: 20 + (i / 13) * 28 + Math.sin(i * 0.9) * 4
}))

export default function Sparkline({ history, cardId, height = 56 }) {
  const combined = useMemo(() => {
    if (!history || history.length === 0) return []
    const synthetic = generateSynthetic(history[0].price, history[0].date, 90)
    return [...synthetic, ...history]
  }, [history?.[0]?.price, history?.[0]?.date, history?.length])

  if (!history || history.length <= 1) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={PLACEHOLDER_DATA} margin={{ top: 4, right: 4, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="spark-ph" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1e293b" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
          <YAxis domain={[0, 80]} hide />
          <Area type="monotone" dataKey="price" stroke="#293548" strokeWidth={1.5}
            fill="url(#spark-ph)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  const first = history[0].price
  const last = history[history.length - 1].price
  const color = last >= first ? '#34d399' : '#f87171'

  const data = combined.map((p) => ({
    date: p.date,
    isSynthetic: !!p.synthetic,
    syntheticPrice: p.synthetic ? p.price : undefined,
    realPrice: !p.synthetic ? p.price : undefined,
  }))

  const prices = combined.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.12 || max * 0.05 || 1
  const domainMin = min - pad
  const domainMax = max + pad
  const yTicks = [0, 1, 2, 3].map((i) => domainMin + (i / 3) * (domainMax - domainMin))
  const xTicks = Array.from({ length: 9 }, (_, i) => data[Math.floor(i * (data.length - 1) / 8)]?.date).filter(Boolean)

  const firstRealDate = data.find((d) => !d.isSynthetic)?.date
  const hasSynthetic = data.some((d) => d.isSynthetic)
  const gradId = `sg-${cardId}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`${gradId}-synth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6b7280" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2535" vertical={false} />
        <XAxis
          dataKey="date"
          ticks={xTicks}
          tickFormatter={fmtDate}
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          height={16}
        />
        <YAxis
          domain={[domainMin, domainMax]}
          ticks={yTicks}
          tick={{ fill: '#64748b', fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
          width={36}
        />
        <Tooltip content={<SparkTooltip />} />
        <Area
          type="monotone"
          dataKey="syntheticPrice"
          stroke="#4b5563"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill={`url(#${gradId}-synth)`}
          dot={false}
          activeDot={{ r: 2, fill: '#6b7280', strokeWidth: 0 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="realPrice"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
          connectNulls={false}
        />
        {hasSynthetic && firstRealDate && (
          <ReferenceLine
            x={firstRealDate}
            stroke="#334155"
            strokeDasharray="3 3"
            label={{ value: 'Live', position: 'insideTopRight', fill: '#475569', fontSize: 9, dy: -4 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
