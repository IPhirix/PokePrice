import { useEffect, useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { useCurrency } from '../context/CurrencyContext'

const PLACEHOLDER_WAVE = Array.from({ length: 14 }, (_, i) => ({
  value: 20 + (i / 13) * 28 + Math.sin(i * 0.9) * 4
}))

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`
}

function WidgetTooltip({ active, payload, labelKey = 'date', formatter }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const rawLabel = p[labelKey]
  const displayLabel = labelKey === 'date' && rawLabel ? fmtDate(rawLabel) : rawLabel
  const val = payload[0].value
  return (
    <div className="bg-surface-700 border border-surface-500 rounded px-2 py-1 text-xs pointer-events-none">
      {displayLabel && <p className="text-slate-400 mb-0.5">{displayLabel}</p>}
      <span className="text-white font-medium">{formatter ? formatter(val) : val}</span>
    </div>
  )
}

function WidgetSparkline({ data, dataKey = 'value', color, gradId, type = 'area', formatter, expanded = false, zeroLine = false }) {
  if (!data || data.length < 2) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={PLACEHOLDER_WAVE} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
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

  const xInterval = expanded
    ? Math.max(0, Math.floor(data.length / 6) - 1)
    : 'preserveStartEnd'

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: 4 }} barCategoryGap="15%">
          <XAxis
            dataKey="name"
            interval={xInterval}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            height={16}
          />
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            content={<WidgetTooltip labelKey="name" formatter={formatter} />}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const GREEN = '#34d399'
  const RED = '#f87171'

  let yDomain = ['dataMin', 'dataMax']
  let strokeColor = color
  let activeDotColor = color
  let fillGradDef = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
    </linearGradient>
  )
  let lineGradDef = null
  let refLine = null

  if (zeroLine) {
    const vals = data.map(d => d[dataKey]).filter(v => v != null)
    const minVal = Math.min(...vals)
    const maxVal = Math.max(...vals)
    const lastVal = vals[vals.length - 1]
    const domainMin = Math.min(0, minVal)
    const domainMax = Math.max(0, maxVal)
    yDomain = [domainMin, domainMax]

    const range = domainMax - domainMin
    const zeroPct = range > 0 ? ((domainMax / range) * 100).toFixed(1) + '%' : '0%'

    const mixed = minVal < 0 && maxVal > 0

    if (mixed) {
      strokeColor = `url(#${gradId}-ln)`
      activeDotColor = lastVal >= 0 ? GREEN : RED
      fillGradDef = (
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GREEN} stopOpacity={0.28} />
          <stop offset={zeroPct} stopColor={GREEN} stopOpacity={0.1} />
          <stop offset={zeroPct} stopColor={RED} stopOpacity={0.1} />
          <stop offset="100%" stopColor={RED} stopOpacity={0.28} />
        </linearGradient>
      )
      lineGradDef = (
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
      activeDotColor = clr
      fillGradDef = (
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
          {fillGradDef}
          {lineGradDef}
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          interval={xInterval}
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          height={16}
        />
        <YAxis domain={yDomain} hide />
        {refLine}
        <Tooltip content={<WidgetTooltip labelKey="date" formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={strokeColor}
          strokeWidth={expanded ? 2.5 : 2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: expanded ? 4 : 3, fill: activeDotColor }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}

function ExpandedModal({ tile, onClose }) {
  if (!tile) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-surface-800 border border-surface-600 rounded-2xl p-6 w-[640px] max-w-[92vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-1">{tile.label}</p>
            <p className={`text-3xl font-bold ${tile.valueColor || 'text-white'}`}>{tile.currentValue}</p>
            {tile.subtitle && <p className="text-slate-500 text-xs mt-1">{tile.subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 -mr-1 -mt-1"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-64">
          <WidgetSparkline
            data={tile.chart}
            dataKey={tile.dataKey || 'value'}
            color={tile.color}
            gradId={`${tile.gradId}-exp`}
            type={tile.chartType || 'area'}
            formatter={tile.formatter}
            zeroLine={tile.zeroLine || false}
            expanded={true}
          />
        </div>
      </div>
    </div>
  )
}

function Widget({ label, chart, gradId, color, chartType = 'area', dataKey = 'value', formatter, zeroLine = false, onExpand, children }) {
  return (
    <div className={`relative bg-surface-800 border border-surface-600 rounded-xl p-2 flex gap-3 overflow-hidden ${onExpand ? 'cursor-pointer hover:border-surface-500 transition-colors' : ''}`} onClick={onExpand}>
      <div className="w-32 flex-shrink-0 flex flex-col justify-center overflow-hidden">
        <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-medium truncate">{label}</p>
        {children}
      </div>
      <div className="flex-1 min-h-0 opacity-80">
        <WidgetSparkline data={chart} dataKey={dataKey} color={color} gradId={gradId} type={chartType} formatter={formatter} zeroLine={zeroLine} />
      </div>
    </div>
  )
}

const EMPTY_DATA = {
  totalValue: 0, totalDayChange: 0, totalInvested: null,
  totalProfit: null, totalROI: null, portfolioCount: 0,
  cardsWithPrice: 0, cardsWithCost: 0, buyAlertCount: 0,
  sellAlertCount: 0, valueHistory: [], investedHistory: [], cardDataCounts: [],
}

export default function PortfolioSummary({ refreshKey, binderFilter, hideValues, alertFilter, onAlertFilter }) {
  const [data, setData] = useState(EMPTY_DATA)
  const [expandedTile, setExpandedTile] = useState(null)
  const { format } = useCurrency()
  const fmt = (n) => hideValues ? '——' : n != null ? format(Math.abs(n)) : '—'

  useEffect(() => {
    window.api.getPortfolio(binderFilter || null).then(setData)
  }, [refreshKey, binderFilter])

  const dayPos = data.totalDayChange > 0, dayNeg = data.totalDayChange < 0
  const dayColor = dayPos ? 'text-emerald-400' : dayNeg ? 'text-red-400' : 'text-slate-400'
  const dayArrow = dayPos ? '▲' : dayNeg ? '▼' : ''

  // Combined P&L = unrealized (current holdings) + realized (sold cards)
  const hasRealized = data.realizedPnL != null && data.realizedPnL !== 0
  const combinedPnL = data.totalProfit != null || data.realizedPnL != null
    ? (data.totalProfit ?? 0) + (data.realizedPnL ?? 0) : null

  const profitColor = combinedPnL == null ? 'text-slate-400' : combinedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
  const roiColor = data.totalROI == null ? 'text-slate-400' : data.totalROI >= 0 ? 'text-emerald-400' : 'text-red-400'

  const vh = data.valueHistory || []

  const plHistory = data.totalInvested != null && vh.length > 1
    ? vh.map((p) => ({ date: p.date, value: Math.round((p.value - data.totalInvested + (data.realizedPnL ?? 0)) * 100) / 100 }))
    : []
  const roiHistory = data.totalInvested != null && vh.length > 1 && data.totalInvested > 0
    ? vh.map((p) => ({ date: p.date, value: Math.round(((p.value - data.totalInvested) / data.totalInvested) * 10000) / 100 }))
    : []
  const dayChangeHistory = vh.length > 1
    ? vh.map((p, i) => ({ date: p.date, value: i === 0 ? 0 : Math.round((p.value - vh[i - 1].value) * 100) / 100 })).slice(1)
    : []

  const plColor = combinedPnL == null || combinedPnL >= 0 ? '#34d399' : '#f87171'
  const roiChartColor = data.totalROI == null || data.totalROI >= 0 ? '#34d399' : '#f87171'

  const fmtChange = (v) => v != null ? (v >= 0 ? '+' : '−') + format(Math.abs(v)) : '—'
  const fmtPct = (v) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(1) + '%' : '—'
  const fmtCount = (v) => `${v} cards`

  const expand = (config) => setExpandedTile(config)

  return (
    <>
      <div className="grid grid-cols-3 gap-3 px-6 pb-2" style={{ gridAutoRows: '132px' }}>
        {/* Collection Value */}
        <Widget
          label="Collection Value" chart={vh} gradId="pw-val" color="#f59e0b"
          formatter={(v) => format(v)}
          onExpand={() => expand({
            label: 'Collection Value', chart: vh, color: '#f59e0b', gradId: 'pw-val',
            currentValue: fmt(data.totalValue), subtitle: `${data.cardsWithPrice} cards with price data`,
            valueColor: 'text-white', formatter: (v) => format(v),
          })}
        >
          <p className="text-2xl font-bold text-white">{fmt(data.totalValue)}</p>
          <p className="text-slate-600 text-xs mt-0.5">{data.cardsWithPrice} card{data.cardsWithPrice !== 1 ? 's' : ''} with data</p>
        </Widget>

        {/* Today's Change */}
        <Widget
          label="Today's Change" chart={dayChangeHistory} gradId="pw-day"
          color={dayPos ? '#34d399' : dayNeg ? '#f87171' : '#64748b'}
          formatter={fmtChange} zeroLine={true}
          onExpand={dayChangeHistory.length > 1 ? () => expand({
            label: "Today's Change", chart: dayChangeHistory, gradId: 'pw-day',
            color: dayPos ? '#34d399' : dayNeg ? '#f87171' : '#64748b',
            currentValue: `${dayArrow}${dayArrow ? ' ' : ''}${fmt(data.totalDayChange)}`,
            subtitle: 'vs yesterday', valueColor: dayColor, formatter: fmtChange, zeroLine: true,
          }) : null}
        >
          <p className={`text-2xl font-bold ${dayColor}`}>
            {dayArrow}{dayArrow ? ' ' : ''}{fmt(data.totalDayChange)}
          </p>
          <p className="text-slate-600 text-xs mt-0.5">vs yesterday</p>
        </Widget>

        {/* Cards Tracked */}
        <div className="relative bg-surface-800 border border-surface-600 rounded-xl p-2 overflow-hidden flex flex-col justify-center">
          <p className="text-slate-500 text-xs mb-2.5 uppercase tracking-wider font-medium">Cards Tracked</p>
          <div className="flex items-center gap-0">
            <div className="flex-1 flex flex-col items-center">
              <p className="text-2xl font-bold text-white leading-tight">{data.portfolioCount}</p>
              <p className="text-slate-500 text-xs mt-0.5">Total</p>
            </div>
            <div className="w-px self-stretch bg-surface-600 rounded-full mx-1 flex-shrink-0" />
            <button
              onClick={() => onAlertFilter?.('buy')}
              disabled={!data.buyAlertCount}
              className={`flex-1 flex flex-col items-center rounded-lg py-1 transition-colors ${data.buyAlertCount > 0 ? 'cursor-pointer hover:bg-emerald-900/20' : 'cursor-default'} ${alertFilter === 'buy' ? 'ring-1 ring-emerald-500/50 bg-emerald-900/20' : ''}`}
            >
              <p className={`text-2xl font-bold leading-tight ${data.buyAlertCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {data.buyAlertCount ?? 0}
              </p>
              <p className="text-slate-500 text-xs mt-0.5 text-center">Cards to Buy</p>
            </button>
            <div className="w-px self-stretch bg-surface-600 rounded-full mx-1 flex-shrink-0" />
            <button
              onClick={() => onAlertFilter?.('sell')}
              disabled={!data.sellAlertCount}
              className={`flex-1 flex flex-col items-center rounded-lg py-1 transition-colors ${data.sellAlertCount > 0 ? 'cursor-pointer hover:bg-red-900/20' : 'cursor-default'} ${alertFilter === 'sell' ? 'ring-1 ring-red-500/50 bg-red-900/20' : ''}`}
            >
              <p className={`text-2xl font-bold leading-tight ${data.sellAlertCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {data.sellAlertCount ?? 0}
              </p>
              <p className="text-slate-500 text-xs mt-0.5 text-center">Cards to Sell</p>
            </button>
          </div>
        </div>

        {/* Total Invested */}
        <Widget
          label="Total Invested" chart={data.investedHistory || []} gradId="pw-inv" color="#64748b"
          formatter={(v) => format(v)}
          onExpand={(data.investedHistory?.length > 1) ? () => expand({
            label: 'Total Invested', chart: data.investedHistory, color: '#64748b', gradId: 'pw-inv',
            currentValue: hideValues ? '——' : data.totalInvested != null ? format(data.totalInvested) : '—',
            subtitle: `${data.cardsWithCost} of ${data.portfolioCount} cards with cost`,
            valueColor: 'text-white', formatter: (v) => format(v),
          }) : null}
        >
          <p className="text-2xl font-bold text-white">
            {hideValues ? '——' : data.totalInvested != null ? format(data.totalInvested) : '—'}
          </p>
          <p className="text-slate-600 text-xs mt-0.5">{data.cardsWithCost} of {data.portfolioCount} card{data.portfolioCount !== 1 ? 's' : ''}</p>
        </Widget>

        {/* Total P&L */}
        <Widget
          label="Total P&L" chart={plHistory} gradId="pw-pl" color={plColor}
          formatter={fmtChange} zeroLine={true}
          onExpand={plHistory.length > 1 ? () => expand({
            label: 'Total P&L', chart: plHistory, color: plColor, gradId: 'pw-pl',
            currentValue: `${combinedPnL != null ? (combinedPnL >= 0 ? '+' : '−') : ''}${fmt(combinedPnL != null ? Math.abs(combinedPnL) : null)}`,
            subtitle: hasRealized ? 'unrealized + realized' : 'vs cost basis',
            valueColor: profitColor, formatter: fmtChange, zeroLine: true,
          }) : null}
        >
          <p className={`text-2xl font-bold ${profitColor}`}>
            {combinedPnL != null ? (combinedPnL >= 0 ? '+' : '−') : ''}{fmt(combinedPnL != null ? Math.abs(combinedPnL) : null)}
          </p>
          <p className="text-slate-600 text-xs mt-0.5">{hasRealized ? 'unrealized + realized' : 'vs cost basis'}</p>
        </Widget>

        {/* Return ROI */}
        <Widget
          label="Return (ROI)" chart={roiHistory} gradId="pw-roi" color={roiChartColor}
          formatter={fmtPct} zeroLine={true}
          onExpand={roiHistory.length > 1 ? () => expand({
            label: 'Return (ROI)', chart: roiHistory, color: roiChartColor, gradId: 'pw-roi',
            currentValue: hideValues ? '——' : data.totalROI != null ? (data.totalROI >= 0 ? '+' : '') + data.totalROI.toFixed(1) + '%' : '—',
            subtitle: 'total return', valueColor: roiColor, formatter: fmtPct, zeroLine: true,
          }) : null}
        >
          <p className={`text-2xl font-bold ${roiColor}`}>
            {hideValues ? '——' : data.totalROI != null ? (data.totalROI >= 0 ? '+' : '') + data.totalROI.toFixed(1) + '%' : '—'}
          </p>
          <p className="text-slate-600 text-xs mt-0.5">total return</p>
        </Widget>

      </div>

      <ExpandedModal tile={expandedTile} onClose={() => setExpandedTile(null)} />
    </>
  )
}
