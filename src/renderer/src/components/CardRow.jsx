import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import PriceChangeIndicator from './PriceChangeIndicator'
import Sparkline from './Sparkline'
import { useCurrency } from '../context/CurrencyContext'


const CONDITION_LABEL = {
  raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9',
  psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9'
}

const CONDITION_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}

function InlinePurchasePrice({ cardId, current, onSaved }) {
  const { format } = useCurrency()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e?.stopPropagation()
    const p = parseFloat(value)
    if (isNaN(p) || p <= 0) return
    setSaving(true)
    await window.api.updateCard(cardId, { purchasePrice: Math.round(p * 100) / 100 })
    onSaved()
    setEditing(false)
    setSaving(false)
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setValue(''); setEditing(true) }}
        className={`font-bold text-xl leading-tight ${current != null ? 'text-white' : 'text-slate-600 hover:text-slate-400 transition-colors'}`}
        title={current == null ? 'Click to add purchase price' : undefined}
      >
        {current != null ? format(current) : '—'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      <span className="text-slate-400 text-sm">$</span>
      <input
        autoFocus type="number" min="0.01" step="0.01" value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') setEditing(false) }}
        onBlur={() => { if (!saving && !value) setEditing(false) }}
        className="w-20 bg-surface-600 border border-surface-400 rounded px-2 py-0.5 text-sm text-white text-right focus:outline-none focus:border-accent"
        placeholder="0.00"
      />
      <button onClick={save} disabled={saving}
        className="bg-accent text-black text-xs px-2 py-0.5 rounded disabled:opacity-50">
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={(e) => { e.stopPropagation(); setEditing(false) }} className="text-slate-500 hover:text-white text-xs">✕</button>
    </div>
  )
}

function ManualPriceEntry({ cardId, onSaved }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(e) {
    e.stopPropagation()
    const p = parseFloat(value)
    if (isNaN(p) || p <= 0) return
    setSaving(true)
    await window.api.setManualPrice(cardId, p)
    onSaved()
    setOpen(false)
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="text-slate-500 hover:text-accent text-xs underline mt-1 block"
      >
        Enter price manually
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-slate-400 text-sm">$</span>
      <input
        autoFocus type="number" min="0.01" step="0.01" value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') setOpen(false) }}
        className="w-24 bg-surface-600 border border-surface-400 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-accent"
        placeholder="0.00"
      />
      <button onClick={save} disabled={saving}
        className="bg-accent text-black text-xs px-2 py-0.5 rounded disabled:opacity-50">
        {saving ? '…' : 'Save'}
      </button>
      <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-xs">✕</button>
    </div>
  )
}

const PCT_OPTIONS = Array.from({ length: 20 }, (_, i) => (i < 10 ? -(10 - i) * 5 : (i - 9) * 5))

function TargetPriceField({ label, value, pctValue, cardId, fieldName, onSaved, currentPrice }) {
  const [input, setInput] = useState(value != null ? String(value) : '')
  const [pct, setPct] = useState(pctValue != null ? String(pctValue) : '')
  const skipResetRef = useRef(false)

  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false
      return
    }
    setInput(value != null ? String(value) : '')
    setPct(pctValue != null ? String(pctValue) : '')
  }, [value, pctValue])

  const pctField = fieldName === 'targetBuyPrice' ? 'targetBuyPct' : 'targetSellPct'

  async function save() {
    const parsed = parseFloat(input)
    const newVal = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
    if (newVal === (value ?? null)) return
    setPct('')
    await window.api.updateCard(cardId, { [fieldName]: newVal, [pctField]: null })
    onSaved()
  }

  async function handlePctChange(e) {
    const val = e.target.value
    setPct(val)
    if (val === '') {
      setInput('')
      await window.api.updateCard(cardId, { [fieldName]: null, [pctField]: null })
      onSaved()
    } else {
      const p = parseFloat(val)
      if (!isNaN(p) && currentPrice != null) {
        const calculated = Math.round(currentPrice * (1 + p / 100) * 100) / 100
        setInput(String(calculated))
        skipResetRef.current = true
        await window.api.updateCard(cardId, { [fieldName]: calculated, [pctField]: p })
        onSaved()
      }
    }
  }

  return (
    <div>
      <p className={`text-sm font-medium mb-1 ${fieldName === 'targetBuyPrice' ? 'text-emerald-500' : 'text-red-400'}`}>{label}</p>
      <div className="flex items-center gap-1.5">
        {currentPrice != null && (
          <select
            value={pct}
            onChange={handlePctChange}
            className="flex-shrink-0 w-16 text-xs bg-surface-600 border border-surface-500 rounded px-1 py-1.5 text-slate-400 focus:outline-none focus:border-accent"
          >
            <option value="">%</option>
            {PCT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p > 0 ? `+${p}%` : `${p}%`}</option>
            ))}
          </select>
        )}
        <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
        <input
          type="number" min="0.01" step="0.01"
          value={input}
          onChange={(e) => { setInput(e.target.value); setPct('') }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setInput(value != null ? String(value) : '')
          }}
          placeholder="—"
          className="w-full bg-surface-700 border border-surface-600 rounded pl-6 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
        />
        </div>
      </div>
    </div>
  )
}

function InlineDatePicker({ cardId, current, onSaved }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  function toInputVal(dateStr) {
    if (!dateStr) return ''
    try { return new Date(dateStr).toISOString().split('T')[0] } catch { return '' }
  }

  function display(dateStr) {
    if (!dateStr) return 'Date added: —'
    return 'Date added: ' + new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  async function save() {
    if (!value) { setOpen(false); return }
    await window.api.updateCard(cardId, { addedDate: value })
    onSaved()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setValue(toInputVal(current)); setOpen(true) }}
        className="text-slate-600 text-sm mt-1 hover:text-slate-400 transition-colors block text-left"
        title="Click to edit date added"
      >
        {display(current)}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus type="date" value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setOpen(false) }}
        className="bg-surface-600 border border-surface-400 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent"
      />
      <button onClick={save} className="bg-accent text-black text-xs px-2 py-0.5 rounded">Save</button>
      <button onClick={(e) => { e.stopPropagation(); setOpen(false) }} className="text-slate-500 hover:text-white text-xs">✕</button>
    </div>
  )
}

function FitText({ text, className, minSize = 11, maxSize = 18 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.fontSize = `${maxSize}px`
    let size = maxSize
    while (el.scrollWidth > el.offsetWidth && size > minSize) {
      size--
      el.style.fontSize = `${size}px`
    }
  }, [text, maxSize, minSize])
  return <span ref={ref} className={className}>{text}</span>
}

function useFavNames() {
  const [favNames, setFavNames] = useState(() => {
    try { return Object.values(JSON.parse(localStorage.getItem('pokeprice-favorites') || '{}')) } catch { return [] }
  })
  useEffect(() => {
    const update = () => { try { setFavNames(Object.values(JSON.parse(localStorage.getItem('pokeprice-favorites') || '{}'))) } catch {} }
    window.addEventListener('pokeprice-favs', update)
    return () => window.removeEventListener('pokeprice-favs', update)
  }, [])
  return favNames
}

function Divider() {
  return (
    <div className="self-stretch flex items-center flex-shrink-0">
      <div className="w-px h-10 bg-surface-600 rounded-full" />
    </div>
  )
}

const TRADE_CONDITION_LABELS = { raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9' }

function SellModal({ card, onClose, onSold }) {
  const { format } = useCurrency()
  const [salePrice, setSalePrice] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [isTrade, setIsTrade] = useState(false)
  const [tradeCards, setTradeCards] = useState([])
  const [saving, setSaving] = useState(false)

  const purchasePrice = card.purchasePrice ?? null
  const salePriceNum = parseFloat(salePrice)
  const previewPL = !isNaN(salePriceNum) && salePriceNum > 0 && purchasePrice != null
    ? salePriceNum - purchasePrice : null

  async function handleSell() {
    if (isNaN(salePriceNum) || salePriceNum <= 0) return
    setSaving(true)
    try {
      await window.api.sellCard(card.id, {
        salePrice: Math.round(salePriceNum * 100) / 100,
        saleDate,
        isTrade,
        tradeCardsReceived: isTrade ? tradeCards.filter((c) => c.name.trim()) : []
      })
      onClose()
      onSold()
    } catch (err) {
      console.error('Failed to record sale:', err)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-surface-600 flex items-center gap-3">
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.name} className="w-8 h-11 object-contain rounded flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{card.name}</h2>
            <p className="text-slate-500 text-xs truncate">{card.setName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center flex-shrink-0">✕</button>
        </div>

        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Sale Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
              <input
                autoFocus
                type="number" min="0.01" step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSell() }}
                placeholder="0.00"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              />
            </div>
            {previewPL != null && (
              <p className={`text-xs mt-1 ${previewPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                P&L: {previewPL >= 0 ? '+' : '−'}${Math.abs(previewPL).toFixed(2)} vs paid {format(purchasePrice)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Sale Date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setIsTrade((v) => !v)}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${isTrade ? 'bg-accent border-accent' : 'border-surface-400 bg-surface-700'}`}>
                {isTrade && (
                  <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-slate-300 text-sm">This was a trade</span>
            </label>
          </div>

          {isTrade && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-sm font-medium">Cards Received</p>
                <button
                  onClick={() => setTradeCards((prev) => [...prev, { name: '', condition: 'raw', estimatedValue: '' }])}
                  className="text-xs px-2 py-1 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded transition-colors"
                >
                  + Add Card
                </button>
              </div>
              {tradeCards.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-3">No cards added yet — click Add Card</p>
              )}
              <div className="space-y-2">
                {tradeCards.map((tc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tc.name}
                      onChange={(e) => setTradeCards((prev) => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                      placeholder="Card name"
                      className="flex-1 bg-surface-700 border border-surface-500 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                    />
                    <select
                      value={tc.condition}
                      onChange={(e) => setTradeCards((prev) => prev.map((c, i) => i === idx ? { ...c, condition: e.target.value } : c))}
                      className="w-20 bg-surface-700 border border-surface-500 rounded px-1 py-1.5 text-xs text-slate-300 focus:outline-none"
                    >
                      {Object.entries(TRADE_CONDITION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={tc.estimatedValue}
                        onChange={(e) => setTradeCards((prev) => prev.map((c, i) => i === idx ? { ...c, estimatedValue: e.target.value } : c))}
                        placeholder="0.00"
                        className="w-full bg-surface-700 border border-surface-500 rounded pl-5 pr-1 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                    <button
                      onClick={() => setTradeCards((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-600 hover:text-red-400 text-sm leading-none flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-surface-600 flex gap-3">
          <button
            onClick={handleSell}
            disabled={saving || !salePrice || isNaN(salePriceNum) || salePriceNum <= 0}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Mark as Sold'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardRow({ card, onRemove, onRefresh, onCardClick, confirmRemove = true, showPlPct = false, onTogglePlPct, showDollarChanges = false, onToggleDollarChanges, bulkMode = false, isSelected = false, onToggleSelect }) {
  const navigate = useNavigate()
  const { format } = useCurrency()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [sellModalOpen, setSellModalOpen] = useState(false)
  const favNames = useFavNames()

  const condLabel = CONDITION_LABEL[card.condition] || card.condition
  const condColor = CONDITION_COLOR[card.condition] || 'bg-slate-700 text-slate-300'
  const isPortfolio = card.section === 'collection'

  const marketPrice = card.currentPrice ?? null
  const purchasePrice = card.purchasePrice ?? null
  const profit = marketPrice != null && purchasePrice != null ? marketPrice - purchasePrice : null
  const roi = profit != null && purchasePrice > 0 ? (profit / purchasePrice) * 100 : null

  const isFavCard = favNames.some((n) => {
    const cn = (card.name || '').toLowerCase()
    const fn = (n || '').toLowerCase()
    if (!fn) return false
    return cn === fn ||
      cn.startsWith(fn + ' ') || cn.startsWith(fn + '-') ||
      cn.includes(' ' + fn + ' ') || cn.includes(' ' + fn + '-') || cn.endsWith(' ' + fn)
  })

  const dollarChangeDay   = marketPrice != null && card.changeDay   != null ? marketPrice * card.changeDay   / 100 : null
  const dollarChangeWeek  = marketPrice != null && card.changeWeek  != null ? marketPrice * card.changeWeek  / 100 : null
  const dollarChangeMonth = marketPrice != null && card.changeMonth != null ? marketPrice * card.changeMonth / 100 : null

  const avg30 = (() => {
    if (!card.recentHistory?.length) return null
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const pts = card.recentHistory.filter(h => new Date(h.date).getTime() >= cutoff)
    if (!pts.length) return null
    return pts.reduce((s, h) => s + h.price, 0) / pts.length
  })()

  function toggleDollarChanges(e) { e.stopPropagation(); onToggleDollarChanges?.() }

  const isBuyAlert = card.targetBuyPrice != null && marketPrice != null && marketPrice <= card.targetBuyPrice
  const isSellAlert = card.targetSellPrice != null && marketPrice != null && marketPrice >= card.targetSellPrice
  const isAlerted = isBuyAlert || isSellAlert

  return (
    <div
      className={`flex items-center gap-5 bg-surface-800 border rounded-xl px-5 py-[10px] mb-3 transition-all group cursor-pointer ${
        bulkMode && isSelected
          ? 'border-red-500 bg-red-900/10'
          : 'border-surface-600 hover:border-surface-500 hover:bg-surface-700/50'
      }`}
      onClick={() => bulkMode ? onToggleSelect?.(card.id) : (onCardClick ? onCardClick(card) : navigate(`/card/${card.id}`, { state: { fromTab: card.section || 'watchlist' } }))}
    >
      {bulkMode && (
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect?.(card.id)}
            className="w-5 h-5 accent-red-500 cursor-pointer"
          />
        </div>
      )}
      {/* Card image */}
      <div className={`w-24 h-36 flex-shrink-0 flex items-center justify-center bg-surface-900 rounded-xl overflow-hidden border-2 ${
        isSellAlert ? 'border-red-400' : isBuyAlert ? 'border-emerald-400' : 'border-transparent'
      }`}>
        {card.imageUrl ? (
          <img src={card.imageUrl} alt={card.name}
            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200" />
        ) : (
          <div className="text-slate-600 text-xs text-center px-2">No image</div>
        )}
      </div>

      <Divider />

      {/* Card identity */}
      <div className="w-64 flex-shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 min-w-0">
          <FitText text={card.name} className="text-white font-bold leading-tight min-w-0 overflow-hidden whitespace-nowrap" maxSize={18} minSize={11} />
          <span className={`text-xs px-4 py-0.5 rounded-full font-semibold flex-shrink-0 ${condColor}`}>
            {condLabel}
          </span>
          {isFavCard && <span className="text-yellow-400 text-sm leading-none flex-shrink-0">★</span>}
        </div>
        <p className="text-slate-400 text-base truncate mb-0.5">{card.setName}</p>
        {card.number && (
          <p className="text-slate-500 text-sm">
            #{card.number}{card.rarity ? ` · ${card.rarity}` : ''}
          </p>
        )}
        {(card.binder || card.folder) && (
          <p className="mt-1">
            <span className="inline-flex items-center gap-1 text-xs px-4 py-0.5 rounded-full bg-surface-700 text-slate-400 border border-surface-600">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
              {card.binder || card.folder}
            </span>
          </p>
        )}
        <InlineDatePicker cardId={card.id} current={card.addedDate} onSaved={onRefresh} />
      </div>

      <Divider />

      {/* Sparkline + Price Alerts + Pricing */}
      <div className="flex-1 flex items-center gap-5 min-w-0">
        <div className="flex-1 self-stretch flex items-center gap-5 min-w-[200px]">
          {/* Stacked % / $ changes — click any to toggle */}
          <div className="flex flex-col items-center justify-center gap-2 w-28 flex-shrink-0" title="Click to toggle % / $">
            <PriceChangeIndicator value={card.changeDay}   label="1D" size="md" showDollar={showDollarChanges} dollarValue={dollarChangeDay}   onClick={toggleDollarChanges} />
            <PriceChangeIndicator value={card.changeWeek}  label="1W" size="md" showDollar={showDollarChanges} dollarValue={dollarChangeWeek}  onClick={toggleDollarChanges} />
            <PriceChangeIndicator value={card.changeMonth} label="1M" size="md" showDollar={showDollarChanges} dollarValue={dollarChangeMonth} onClick={toggleDollarChanges} />
          </div>
          <Divider />

          {/* Chart */}
          <div className="flex-1 self-stretch min-h-0">
            <Sparkline history={card.recentHistory || []} cardId={card.id} height="100%" />
          </div>
        </div>

        <Divider />

        <div className="w-36 flex-shrink-0 space-y-2" onClick={(e) => e.stopPropagation()}>
          <TargetPriceField label="Buy Price Alert" value={card.targetBuyPrice} pctValue={card.targetBuyPct} cardId={card.id} fieldName="targetBuyPrice" onSaved={onRefresh} currentPrice={marketPrice} />
          <TargetPriceField label="Sell Price Alert" value={card.targetSellPrice} pctValue={card.targetSellPct} cardId={card.id} fieldName="targetSellPrice" onSaved={onRefresh} currentPrice={marketPrice} />
        </div>

        <Divider />

        <div className="w-36 flex-shrink-0 text-right">
        {isPortfolio ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-slate-500 text-xs shrink-0">Paid</span>
              <InlinePurchasePrice cardId={card.id} current={purchasePrice} onSaved={onRefresh} />
            </div>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-slate-500 text-xs shrink-0">Market</span>
              <span className="text-accent font-bold text-xl leading-tight">
                {marketPrice != null ? format(marketPrice) : '—'}
              </span>
            </div>
            <div>
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-slate-500 text-xs shrink-0">P&L</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePlPct?.() }}
                  className={`font-bold text-xl leading-tight transition-opacity hover:opacity-70 ${(showPlPct ? (roi ?? 0) : (profit ?? 0)) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  title="Click to toggle $ / %"
                >
                  {showPlPct
                    ? (roi != null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—')
                    : (profit != null ? `${profit >= 0 ? '+' : '−'}${format(Math.abs(profit))}` : '—')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {marketPrice != null ? (
              <>
                <p className="text-slate-500 text-xs mb-0.5">Market · {condLabel}</p>
                <p className="text-accent font-bold text-3xl leading-tight">
                  {format(marketPrice)}
                </p>
                <p className="text-slate-500 text-xs mt-1"><span className="text-slate-400">30D Avg</span> <span className="text-slate-300 font-medium">{avg30 != null ? format(avg30) : '—'}</span></p>
              </>
            ) : (
              <div className="mb-1">
                <p className="text-slate-500 text-xs mb-0.5">Market · {condLabel}</p>
                <p className="text-slate-600 text-xl">—</p>
                <ManualPriceEntry cardId={card.id} onSaved={onRefresh} />
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Action column: alert pills pinned to top, ✕ centered */}
      {!bulkMode && (
        <div
          className="flex-shrink-0 self-stretch flex flex-col items-center justify-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          {isAlerted && (
            <div className="absolute top-0 flex flex-col items-center gap-0.5 pt-1">
              {isBuyAlert && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/50 text-emerald-300 tracking-wide whitespace-nowrap">
                  BUY
                </span>
              )}
              {isSellAlert && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-400/15 border border-red-400/50 text-red-300 tracking-wide whitespace-nowrap">
                  SELL
                </span>
              )}
            </div>
          )}

          {confirmingRemove && (
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 flex items-center gap-2 z-10 whitespace-nowrap shadow-xl">
              {isPortfolio ? (
                <>
                  <span className="text-slate-300 text-xs font-medium">What happened?</span>
                  <button
                    onClick={() => { setConfirmingRemove(false); setSellModalOpen(true) }}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                  >
                    Sold
                  </button>
                  <button
                    onClick={() => onRemove(card.id)}
                    className="bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs px-2.5 py-1 rounded transition-colors"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-300 text-xs font-medium">Remove card?</span>
                  <button
                    onClick={() => onRemove(card.id)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                onClick={() => setConfirmingRemove(false)}
                className="bg-surface-600 hover:bg-surface-500 text-slate-300 text-xs px-2.5 py-1 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={() => setConfirmingRemove(true)}
            className="text-slate-600 hover:text-red-400 transition-colors text-xl leading-none"
            title="Remove card"
          >
            ✕
          </button>
        </div>
      )}

      {sellModalOpen && (
        <SellModal card={card} onClose={() => setSellModalOpen(false)} onSold={onRefresh} />
      )}
    </div>
  )
}
