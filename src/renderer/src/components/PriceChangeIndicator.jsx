import { useCurrency } from '../context/CurrencyContext'

export default function PriceChangeIndicator({ value, label, size = 'sm', showDollar = false, dollarValue, onClick }) {
  const { format } = useCurrency()

  if (value === null || value === undefined) {
    return (
      <div className={`flex items-center gap-1.5 ${onClick ? 'cursor-pointer select-none' : ''}`} onClick={onClick}>
        <span className={`text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded font-medium text-right ${size === 'sm' ? 'text-xs min-w-[3.5rem]' : 'text-sm min-w-[4.5rem]'}`}>
          {showDollar ? '—' : '0.00%'}
        </span>
        {label && <span className="text-slate-500 text-xs">{label}</span>}
      </div>
    )
  }

  const isPositive = value > 0
  const isZero = value === 0
  const color = isZero ? 'text-slate-400' : isPositive ? 'text-emerald-400' : 'text-red-400'
  const bg = isZero ? 'bg-slate-700' : isPositive ? 'bg-emerald-900/40' : 'bg-red-900/40'
  const arrow = isZero ? '' : isPositive ? '▲' : '▼'

  const displayText = showDollar && dollarValue != null
    ? `${arrow}${arrow ? ' ' : ''}${format(Math.abs(dollarValue))}`
    : `${arrow}${arrow ? ' ' : ''}${Math.abs(value).toFixed(2)}%`

  return (
    <div className={`flex items-center gap-1.5 ${onClick ? 'cursor-pointer select-none' : ''}`} onClick={onClick}>
      <span className={`${color} ${bg} px-1.5 py-0.5 rounded font-medium text-right ${size === 'sm' ? 'text-xs min-w-[3.5rem]' : 'text-sm min-w-[4.5rem]'}`}>
        {displayText}
      </span>
      {label && <span className="text-slate-500 text-xs">{label}</span>}
    </div>
  )
}
