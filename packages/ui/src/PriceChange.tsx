interface PriceChangeProps {
  value: number | null | undefined
  label?: string
  size?: 'xs' | 'sm'
}

export default function PriceChange({ value, label, size = 'sm' }: PriceChangeProps) {
  const textSize = size === 'xs' ? 'text-xs' : 'text-sm'

  if (value == null) {
    return (
      <div className="flex items-center gap-1.5">
        {label && <span className="text-slate-500 text-xs w-4 flex-shrink-0">{label}</span>}
        <span className={`text-slate-600 ${textSize}`}>—</span>
      </div>
    )
  }

  const pos = value >= 0
  const color = value === 0 ? 'text-slate-400' : pos ? 'text-emerald-400' : 'text-red-400'
  const arrow = value === 0 ? '' : pos ? '▲ ' : '▼ '

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-slate-500 text-xs w-4 flex-shrink-0">{label}</span>}
      <span className={`font-semibold tabular-nums ${textSize} ${color}`}>
        {arrow}{Math.abs(value).toFixed(1)}%
      </span>
    </div>
  )
}
