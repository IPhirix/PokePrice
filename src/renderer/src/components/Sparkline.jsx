import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'

function fmtDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  if (p.price == null) return null
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs">
      {p.date && <p className="text-slate-400 mb-0.5">{fmtDate(p.date)}</p>}
      <p className="text-white font-medium">${p.price.toFixed(2)}</p>
    </div>
  )
}

const PLACEHOLDER_DATA = Array.from({ length: 14 }, (_, i) => ({
  price: 20 + (i / 13) * 28 + Math.sin(i * 0.9) * 4
}))

export default function Sparkline({ history, cardId, height = 56 }) {
  const trimmed = useMemo(() => {
    if (!history?.length) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return history.filter((h) => h.date >= cutoffStr)
  }, [history])

  if (trimmed.length <= 1) {
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

  const first = trimmed[0].price
  const last = trimmed[trimmed.length - 1].price
  const color = last >= first ? '#34d399' : '#f87171'

  const data = trimmed.map((p) => ({ date: p.date, price: p.price }))
  const prices = trimmed.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.12 || max * 0.05 || 1
  const domainMin = min - pad
  const domainMax = max + pad
  const yTicks = [0, 1, 2, 3].map((i) => domainMin + (i / 3) * (domainMax - domainMin))
  const xTicks = Array.from({ length: 9 }, (_, i) => data[Math.floor(i * (data.length - 1) / 8)]?.date).filter(Boolean)
  const gradId = `sg-${cardId}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 2, left: 2 }}>
        <defs>
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
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
