import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function seriesFromSetId(id) {
  if (!id) return ''
  if (id.startsWith('sv'))   return 'Scarlet & Violet'
  if (id.startsWith('swsh')) return 'Sword & Shield'
  if (id.startsWith('sm'))   return 'Sun & Moon'
  if (id.startsWith('xy'))   return 'XY'
  if (id.startsWith('bw'))   return 'Black & White'
  if (id.startsWith('hgss')) return 'HeartGold & SoulSilver'
  if (id.startsWith('dp'))   return 'Diamond & Pearl'
  if (id.startsWith('ex'))   return 'EX'
  if (id.startsWith('pop'))  return 'POP'
  if (id.startsWith('neo'))  return 'Neo'
  if (id.startsWith('gym'))  return 'Gym'
  if (id.startsWith('base')) return 'Base'
  return ''
}

function PriceSpinner() {
  return (
    <svg className="w-3 h-3 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
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

  async function save() {
    const parsed = parseFloat(input)
    const newVal = !isNaN(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
    if (newVal === (value ?? null)) return
    const newPct = newVal != null && currentPrice != null
      ? Math.round((newVal - currentPrice) / currentPrice * 1000) / 10
      : null
    setPct(newPct != null ? String(newPct) : '')
    await window.api.updateCard(cardId, { alertPrice: newVal, alertPct: newPct })
    onSaved()
  }

  async function handlePctChange(e) {
    const val = e.target.value
    setPct(val)
    if (val === '') {
      setInput('')
      await window.api.updateCard(cardId, { alertPrice: null, alertPct: null })
      onSaved()
    } else {
      const p = parseFloat(val)
      if (!isNaN(p)) {
        if (currentPrice != null) {
          const calculated = Math.round(currentPrice * (1 + p / 100) * 100) / 100
          setInput(String(calculated))
          skipResetRef.current = true
          await window.api.updateCard(cardId, { alertPrice: calculated, alertPct: p })
        } else {
          await window.api.updateCard(cardId, { alertPrice: null, alertPct: p })
        }
        onSaved()
      }
    }
  }

  return (
    <div>
      <p className="text-sm font-medium mb-1 text-accent">{label}</p>
      <div className="flex items-center gap-1.5">
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

function InlineBinderPicker({ card, onSaved, onBinderFilter }) {
  const [open, setOpen] = useState(false)
  const [binders, setBinders] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [dupError, setDupError] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const section = card.section || 'watchlist'
    window.api.listBinders(section).then(setBinders).catch(() => {})
  }, [open, card.section])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setShowNew(false)
        setNewName('')
        setDupError(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function assignBinder(name) {
    setSaving(true)
    await window.api.updateCard(card.id, { binder: name || null })
    onSaved()
    setOpen(false)
    setShowNew(false)
    setNewName('')
    setSaving(false)
  }

  async function createAndAssign() {
    const name = newName.trim()
    if (!name) return
    if (binders.some((b) => b.toLowerCase() === name.toLowerCase())) { setDupError(true); return }
    setSaving(true)
    setDupError(false)
    await window.api.addBinder(card.section || 'watchlist', name)
    await assignBinder(name)
  }

  const hasBinder = !!(card.binder || card.folder)

  return (
    <div className="relative" ref={ref}>
      {hasBinder ? (
        <div className="inline-flex items-center gap-0 rounded-full bg-surface-700 border border-surface-600 overflow-hidden text-xs text-slate-400">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
            className="flex items-center pl-2 pr-1 py-0.5 hover:bg-surface-600 hover:text-white transition-colors"
            title="Change binder"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 9h20" />
              <path d="M7 4v5" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onBinderFilter?.(card.binder || card.folder) }}
            className="pr-2 py-0.5 hover:bg-surface-600 hover:text-white transition-colors"
            title={`Filter by "${card.binder || card.folder}"`}
          >
            {card.binder || card.folder}
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-surface-500 text-slate-600 hover:text-slate-400 hover:border-surface-400 transition-colors"
          title="Add to Binder"
        >
          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add to Binder
        </button>
      )}

      {open && (
        <div
          className="absolute left-0 top-full mt-1 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl z-50 min-w-[180px] py-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {!showNew ? (
            <>
              {hasBinder && (
                <button
                  onClick={() => assignBinder('')}
                  disabled={saving}
                  className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:bg-surface-700 hover:text-white transition-colors"
                >
                  Remove from binder
                </button>
              )}
              {binders.length > 0 && (
                <div className={hasBinder ? 'border-t border-surface-700 mt-1 pt-1' : ''}>
                  {binders.map((b) => (
                    <button
                      key={b}
                      onClick={() => assignBinder(b)}
                      disabled={saving || b === (card.binder || card.folder)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        b === (card.binder || card.folder)
                          ? 'text-accent cursor-default'
                          : 'text-slate-300 hover:bg-surface-700 hover:text-white disabled:opacity-50'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-surface-700 mt-1 pt-1">
                <button
                  onClick={() => setShowNew(true)}
                  className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-surface-700 hover:text-white transition-colors"
                >
                  + New binder…
                </button>
              </div>
            </>
          ) : (
            <div className="px-3 py-2 space-y-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setDupError(false) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createAndAssign()
                  if (e.key === 'Escape') { setShowNew(false); setNewName(''); setDupError(false) }
                }}
                placeholder="Binder name…"
                className={`w-full bg-surface-700 border rounded px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none ${dupError ? 'border-red-500' : 'border-surface-500 focus:border-accent'}`}
              />
              {dupError && <p className="text-red-400 text-xs">Already exists</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={createAndAssign}
                  disabled={!newName.trim() || saving}
                  className="flex-1 bg-accent disabled:opacity-50 text-black text-xs font-bold py-1.5 rounded transition-colors"
                >
                  {saving ? '…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowNew(false); setNewName(''); setDupError(false) }}
                  className="px-2 text-slate-500 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InlineDatePicker({ cardId, current, onSaved }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  function toInputVal(dateStr) {
    if (!dateStr) return ''
    return dateStr.split('T')[0]
  }

  function display(dateStr) {
    if (!dateStr) return 'Date added: —'
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
    return 'Date added: ' + new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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


const ALL_CONDITIONS_ORDERED = [
  { key: 'raw',   label: 'Raw' },
  { key: 'psa8',  label: 'PSA 8' },
  { key: 'psa9',  label: 'PSA 9' },
  { key: 'psa10', label: 'PSA 10' },
  { key: 'cgc9',  label: 'CGC 9' },
  { key: 'cgc10', label: 'CGC 10' },
]

function TradeSearch({ onAdd, onCancel }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchCommitted, setSearchCommitted] = useState(false)
  const [selected, setSelected] = useState(null)
  const [condition, setCondition] = useState('raw')
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0)
    window.api.getSettings().then((s) => { if (s.defaultCondition) setCondition(s.defaultCondition) }).catch(() => {})
  }, [])

  async function search() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearchCommitted(true)
    setSelected(null)
    setPptProduct(null)
    try {
      // "Charizard #4" — explicit card number with hash
      const hashMatch = q.match(/^(.*?)\s*#(\w+)\s*$/)
      if (hashMatch) {
        const name = hashMatch[1].trim()
        const rawNum = hashMatch[2]
        const targetNum = parseInt(rawNum, 10)
        const isNumeric = !isNaN(targetNum)
        if (name) {
          const allCards = await window.api.searchCardsAdvanced(`name:"${name}*"`).catch(() => [])
          const matched = []; const rest = []
          for (const c of allCards) {
            const cn = String(c.number || '')
            const hits = isNumeric ? parseInt(cn, 10) === targetNum : cn.toUpperCase() === rawNum.toUpperCase()
            if (hits) matched.push(c); else rest.push(c)
          }
          setResults(matched.length > 0 && rest.length > 0
            ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
            : [...matched, ...rest])
        } else {
          const numVariants = isNumeric
            ? [...new Set([rawNum, String(targetNum), String(targetNum).padStart(3, '0')])]
            : [rawNum]
          const batches = await Promise.all(numVariants.map((v) =>
            window.api.searchCardsAdvanced(`number:"${v}"`).catch(() => [])
          ))
          const seen = new Set(); const merged = []
          for (const batch of batches) for (const c of batch) if (!seen.has(c.id)) { seen.add(c.id); merged.push(c) }
          setResults(merged)
        }
        return
      }
      // "Charizard 4" — trailing number may be card number
      const trailingMatch = q.match(/^(.+?)\s+(\d+)\s*$/)
      if (trailingMatch) {
        const name = trailingMatch[1].trim()
        const rawNum = trailingMatch[2]
        const targetNum = parseInt(rawNum, 10)
        const [allCards, setCards] = await Promise.all([
          window.api.searchCardsAdvanced(`name:"${name}*"`).catch(() => []),
          window.api.searchCardsAdvanced(`name:"${name}*" set.name:"${rawNum}"`).catch(() => [])
        ])
        const seen = new Set(); const matched = []; const rest = []
        for (const c of allCards) if (parseInt(String(c.number || ''), 10) === targetNum && !seen.has(c.id)) { seen.add(c.id); matched.push(c) }
        for (const c of setCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
        for (const c of allCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
        setResults(matched.length > 0 && rest.length > 0
          ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
          : [...matched, ...rest])
        return
      }
      // Plain text — search by name, set name, and word-split name+set combos in parallel
      const words = q.split(/\s+/)
      const allSearches = [
        window.api.searchCardsAdvanced(`name:"${q}*"`).catch(() => []),
        window.api.searchCardsAdvanced(`set.name:"${q}"`).catch(() => []),
      ]
      for (let i = 1; i < words.length; i++) {
        const namePart = words.slice(0, i).join(' ')
        const setPart = words.slice(i).join(' ')
        allSearches.push(window.api.searchCardsAdvanced(`name:"${namePart}*" set.name:"${setPart}"`).catch(() => []))
      }
      const allBatches = await Promise.all(allSearches)
      const seen = new Set(); const merged = []
      for (const batch of allBatches) for (const card of batch) if (!seen.has(card.id)) { seen.add(card.id); merged.push(card) }
      setResults(merged)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function selectCard(card) {
    setSelected(card)
    setFetchingPrice(true)
    setFetchingPrice(false)
  }

  function handleAdd() {
    if (!selected) return
    const marketPrice = null
    onAdd({
      name: selected.name,
      tcgId: selected.id,
      setName: selected.set?.name || '',
      setId: selected.set?.id || '',
      number: selected.number || '',
      rarity: selected.rarity || '',
      imageUrl: selected.images?.small || '',
      imageUrlLarge: selected.images?.large || '',
      condition,
      marketPrice: marketPrice ?? null,
    })
  }

  return (
    <div className="border border-surface-500 rounded-xl bg-surface-900 overflow-hidden">
      <div className="flex gap-2 p-3 border-b border-surface-700">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearchCommitted(false) }}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search by name, set, or card # (e.g. Charizard #4)…"
          className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
        />
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="px-4 py-2.5 bg-accent hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-lg text-sm transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          {searching ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          )}
          {searching ? 'Searching' : 'Search'}
        </button>
        <button onClick={onCancel} className="px-2 text-slate-500 hover:text-white text-lg transition-colors">✕</button>
      </div>

      {!selected ? (
        <div className="max-h-72 overflow-y-auto">
          {searching && <p className="text-slate-500 text-sm text-center py-8">Searching…</p>}
          {!searching && searchCommitted && results.length === 0 && (
            <p className="text-slate-600 text-sm text-center py-8">No cards found</p>
          )}
          {!searching && !searchCommitted && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-700">
              <svg className="w-8 h-8 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p className="text-sm">Search to find a card</p>
            </div>
          )}
          {results.slice(0, 40).map((card) => {
            if (card._divider) {
              return (
                <div key="__divider__" className="flex items-center gap-3 px-4 py-2 select-none">
                  <div className="flex-1 h-px bg-surface-600" />
                  <span className="text-xs text-slate-500 font-medium">Similar Items</span>
                  <div className="flex-1 h-px bg-surface-600" />
                </div>
              )
            }
            return (
              <button
                key={card.id}
                onClick={() => selectCard(card)}
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-700 text-left border-b border-surface-700 last:border-0 transition-colors"
              >
                {card.images?.small ? (
                  <img src={card.images.small} alt={card.name} className="w-14 h-[77px] object-contain rounded flex-shrink-0" />
                ) : (
                  <div className="w-14 h-[77px] bg-surface-700 rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-base font-semibold truncate">
                    {card.name}{card.number ? <span className="text-slate-400 font-normal"> #{card.number}</span> : ''}
                  </p>
                  <p className="text-slate-400 text-sm mt-0.5">{[card.set?.series, card.set?.name].filter(Boolean).join(' - ')}</p>
                  {card.rarity && <p className="text-slate-500 text-sm mt-0.5">{card.rarity}</p>}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700">
            <button onClick={() => { setSelected(null); setPptProduct(null) }} className="text-slate-400 hover:text-white text-sm flex-shrink-0">‹ Back</button>
            {selected.images?.small && (
              <img src={selected.images.small} alt={selected.name} className="w-12 h-[66px] object-contain rounded flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-base font-semibold truncate">{selected.name}</p>
              <p className="text-slate-400 text-sm truncate">{[selected.set?.series, selected.set?.name].filter(Boolean).join(' - ')}</p>
            </div>
            {fetchingPrice && <span className="text-slate-500 text-sm flex-shrink-0">Getting price…</span>}
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-slate-400 text-sm mb-1.5 block">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-base text-white focus:outline-none focus:border-accent"
              >
                {ALL_CONDITIONS_ORDERED.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAdd}
              className="w-full bg-accent hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg text-base transition-colors"
            >
              Add to Trade
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SellModal({ card, onClose, onSold }) {
  const { format } = useCurrency()
  const [salePrice, setSalePrice] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const purchasePrice = card.purchasePrice ?? null
  const salePriceNum = parseFloat(salePrice)
  const previewPL = !isNaN(salePriceNum) && salePrice !== '' && purchasePrice != null
    ? salePriceNum - purchasePrice : null
  const canSubmit = !isNaN(salePriceNum) && salePriceNum > 0

  async function handleSell() {
    if (!canSubmit) return
    setSaving(true)
    try {
      await window.api.sellCard(card.id, {
        salePrice: Math.round(salePriceNum * 100) / 100,
        saleDate,
        isTrade: false,
        tradeCardsReceived: []
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
        <div className="px-6 py-5 border-b border-surface-600 flex items-center gap-5">
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.name} className="w-16 h-[90px] object-contain rounded-lg flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{card.name}</h2>
            <p className="text-slate-400 text-sm truncate mt-0.5">
              {(() => {
                const series = card.setSeries || seriesFromSetId(card.setId)
                return series && series !== card.setName ? `${series} - ${card.setName}` : card.setName
              })()}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center flex-shrink-0 self-start">✕</button>
        </div>

        <div className="p-6 space-y-4">
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
        </div>

        <div className="px-5 py-4 border-t border-surface-600 flex gap-3">
          <button
            onClick={handleSell}
            disabled={saving || !canSubmit}
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

function TradeModal({ card, onClose, onTraded }) {
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0])
  const [cashReceived, setCashReceived] = useState('')
  const [receivedCards, setReceivedCards] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleTrade() {
    setSaving(true)
    try {
      const cash = parseFloat(cashReceived)
      await window.api.sellCard(card.id, {
        salePrice: 0,
        saleDate: tradeDate,
        isTrade: true,
        cashReceived: !isNaN(cash) && cash > 0 ? Math.round(cash * 100) / 100 : 0,
        tradeCardsReceived: receivedCards
      })
      onClose()
      onTraded()
    } catch (err) {
      console.error('Failed to record trade:', err)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-3xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-8 py-6 border-b border-surface-600 flex items-center gap-6">
          {card.imageUrl && (
            <img src={card.imageUrl} alt={card.name} className="w-20 h-[112px] object-contain rounded-xl flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Recording Trade</p>
            <h2 className="text-2xl font-bold text-white truncate">{card.name}</h2>
            <p className="text-slate-400 text-base truncate mt-1">
              {(() => {
                const series = card.setSeries || seriesFromSetId(card.setId)
                return series && series !== card.setName ? `${series} - ${card.setName}` : card.setName
              })()}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl w-10 h-10 flex items-center justify-center flex-shrink-0 self-start">✕</button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Trade date + cash received row */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-300 text-base font-medium mb-2">Trade Date</label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full bg-surface-700 border border-surface-500 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-base font-medium mb-2">Cash Received (optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-700 border border-surface-500 rounded-xl pl-9 pr-4 py-3 text-base text-white placeholder-slate-600 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Items received */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-300 text-base font-medium">Items Received</p>
                <p className="text-slate-500 text-sm mt-0.5">Cards added here will appear in your collection</p>
              </div>
              {!showSearch && (
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 text-sm px-4 py-2 bg-accent hover:bg-amber-400 text-black font-bold rounded-lg transition-colors flex-shrink-0"
                >
                  + Add Items
                </button>
              )}
            </div>

            {receivedCards.length > 0 && (
              <div className="space-y-3 mb-4">
                {receivedCards.map((tc, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-surface-700 border border-surface-600 rounded-xl px-4 py-3">
                    {tc.imageUrl ? (
                      <img src={tc.imageUrl} alt={tc.name} className="w-14 h-[78px] object-contain rounded flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-[78px] bg-surface-600 rounded flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-semibold truncate">{tc.name}</p>
                      <p className="text-slate-500 text-sm truncate">{tc.setName}</p>
                      <span className={`mt-1.5 inline-block text-sm px-3 py-0.5 rounded-full font-semibold ${CONDITION_COLOR[tc.condition] || 'bg-slate-700 text-slate-300'}`}>
                        {TRADE_CONDITION_LABELS[tc.condition]}
                      </span>
                    </div>
                    <button
                      onClick={() => setReceivedCards((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-600 hover:text-red-400 text-xl leading-none flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {showSearch ? (
              <TradeSearch
                onAdd={(tc) => { setReceivedCards((prev) => [...prev, tc]); setShowSearch(false) }}
                onCancel={() => setShowSearch(false)}
              />
            ) : receivedCards.length === 0 && (
              <div className="text-center py-10 border-2 border-dashed border-surface-600 rounded-xl">
                <p className="text-slate-500 text-base">No items added yet</p>
                <p className="text-slate-600 text-sm mt-1">Click "+ Add Items" to add cards you received</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-5 border-t border-surface-600 flex gap-4">
          <button
            onClick={handleTrade}
            disabled={saving}
            className="flex-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-base transition-colors"
          >
            {saving ? 'Saving…' : 'Mark as Traded'}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-xl text-base transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function NotesModal({ card, onClose, onSaved }) {
  const [location, setLocation] = useState(card.purchaseLocation || '')
  const [notes, setNotes] = useState(card.notes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await window.api.updateCard(card.id, { purchaseLocation: location, notes })
    onSaved()
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-surface-600 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">{card.name}</h2>
            <p className="text-slate-500 text-xs mt-0.5">Card Notes</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Purchased / Traded Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Local card shop, eBay, trade with friend…"
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this card…"
              rows={4}
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-surface-600 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-accent hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardRow({ card, onRemove, onRefresh, onCardClick, onBinderFilter, confirmRemove = true, showPlPct = false, onTogglePlPct, showDollarChanges = false, onToggleDollarChanges, bulkMode = false, isSelected = false, onToggleSelect }) {
  const navigate = useNavigate()
  const { format } = useCurrency()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [sellModalOpen, setSellModalOpen] = useState(false)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
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

  const isUpAlert = card.alertPrice != null && marketPrice != null &&
    (card.alertPct != null ? card.alertPct > 0 : card.alertPrice > marketPrice) &&
    marketPrice >= card.alertPrice
  const isDownAlert = card.alertPrice != null && marketPrice != null &&
    (card.alertPct != null ? card.alertPct <= 0 : card.alertPrice < marketPrice) &&
    marketPrice <= card.alertPrice
  const isAlerted = isUpAlert || isDownAlert

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
        isDownAlert ? 'border-red-400' : isUpAlert ? 'border-emerald-400' : 'border-transparent'
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
      <div className="w-64 flex-shrink-0 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <FitText text={card.name} className="text-white font-bold leading-tight min-w-0 overflow-hidden whitespace-nowrap" maxSize={18} minSize={11} />
          {card.number && <span className="text-slate-500 text-xs flex-shrink-0">#{card.number}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${condColor}`}>
            {condLabel}
          </span>
          {isFavCard && <span className="text-yellow-400 text-sm leading-none flex-shrink-0">★</span>}
        </div>
        {(() => {
          const variant = (card.pricechartingName || '').match(/\[([^\]]+)\]/)?.[1]
          return variant ? <p className="text-accent text-xs truncate">{variant}</p> : null
        })()}
        {(() => {
          const series = card.setSeries || seriesFromSetId(card.setId)
          return series && series !== card.setName
            ? <p className="text-slate-400 text-xs truncate">{series} - {card.setName}</p>
            : <p className="text-slate-400 text-xs truncate">{card.setName}</p>
        })()}
        <InlineDatePicker cardId={card.id} current={card.addedDate} onSaved={onRefresh} />
        <div className="flex items-center gap-1.5 flex-wrap">
          <InlineBinderPicker card={card} onSaved={onRefresh} onBinderFilter={onBinderFilter} />
          <button
            onClick={(e) => { e.stopPropagation(); setNotesOpen(true) }}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
              card.notes || card.purchaseLocation
                ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
                : 'bg-surface-700 hover:bg-surface-600 text-slate-400 hover:text-white border-surface-600 hover:border-surface-500'
            }`}
            title="Card notes"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Notes
          </button>
        </div>
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
          <TargetPriceField label="Price Alert" value={card.alertPrice} pctValue={card.alertPct} cardId={card.id} onSaved={onRefresh} currentPrice={marketPrice} />
        </div>

        <Divider />

        <div className="w-36 flex-shrink-0 text-right">
        {isPortfolio ? (
          <div className="space-y-1.5">
            {card.isTrade && (
              <p className="text-right text-xs text-cyan-400 font-semibold">(Trade)</p>
            )}
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
              {isUpAlert && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/50 text-emerald-300 tracking-wide whitespace-nowrap">
                  ↑ PRICE ALERT
                </span>
              )}
              {isDownAlert && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-400/15 border border-red-400/50 text-red-300 tracking-wide whitespace-nowrap">
                  ↓ PRICE ALERT
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
                    onClick={() => { setConfirmingRemove(false); setTradeModalOpen(true) }}
                    className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                  >
                    Traded
                  </button>
                  <button
                    onClick={() => onRemove(card.id)}
                    className="bg-red-700 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <span className="text-slate-300 text-xs font-medium">Remove card?</span>
                  <button
                    onClick={() => onRemove(card.id)}
                    className="bg-red-700 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                onClick={() => setConfirmingRemove(false)}
                className="text-slate-500 hover:text-white text-base leading-none transition-colors px-1"
              >
                ✕
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
      {tradeModalOpen && (
        <TradeModal card={card} onClose={() => setTradeModalOpen(false)} onTraded={onRefresh} />
      )}
      {notesOpen && (
        <NotesModal card={card} onClose={() => setNotesOpen(false)} onSaved={onRefresh} />
      )}
    </div>
  )
}
