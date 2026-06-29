'use client'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  strokeWidth?: number
}

export default function Sparkline({ data, width = 200, height = 40, color, fill = true, strokeWidth = 1.5 }: SparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const pts = data.map((v, i): [number, number] => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / range) * (height - pad * 2),
  ])

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const isUp = data[data.length - 1] >= data[0]
  const lineColor = color ?? (isUp ? '#34d399' : '#f87171')

  const areaPath = fill
    ? [
        `M${pts[0][0]},${height}`,
        pts.map(([x, y]) => `L${x},${y}`).join(' '),
        `L${pts[pts.length - 1][0]},${height}`,
        'Z',
      ].join(' ')
    : null

  const fillId = `sf-${Math.random().toString(36).slice(2)}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {fill && (
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {areaPath && <path d={areaPath} fill={`url(#${fillId})`} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
