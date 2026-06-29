'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ── Desktop card shape (from cards.json) ──────────────────────────────────────
interface DesktopCard {
  id?: string
  tcgId?: string
  name: string
  setName?: string | null
  setId?: string | null
  number?: string | null
  rarity?: string | null
  imageUrl?: string | null
  imageUrlLarge?: string | null
  condition?: string
  quantity?: number
  purchasePrice?: number | null
  section?: string
  folder?: string | null
  binder?: string | null
  addedDate?: string
  targetBuyPrice?: number | null
  alertPrice?: number | null
  targetSellPrice?: number | null
  pricechartingId?: string | null
  pricechartingName?: string | null
  currentPrice?: number | null
  priceSource?: string | null
  type?: string
}

interface MigrateSummary {
  collection: number
  watchlist: number
  sold: number
  skipped: number
  total: number
}

function parseSummary(cards: DesktopCard[]): MigrateSummary {
  let collection = 0, watchlist = 0, sold = 0, skipped = 0
  for (const c of cards) {
    const sec = c.section ?? 'watchlist'
    if (sec === 'sold') { sold++; continue }
    if (!c.name) { skipped++; continue }
    if (sec === 'collection') collection++
    else watchlist++
  }
  return { collection, watchlist, sold, skipped, total: cards.length }
}

export default function MigrateClient() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cards, setCards] = useState<DesktopCard[] | null>(null)
  const [summary, setSummary] = useState<MigrateSummary | null>(null)
  const [parseError, setParseError] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState({ inserted: 0, skipped: 0, errors: 0 })
  const [dragging, setDragging] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  function loadFile(file: File) {
    setParseError('')
    setCards(null)
    setSummary(null)
    setDone(false)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.')
        if (parsed.length === 0) throw new Error('File is empty — no cards found.')
        setCards(parsed)
        setSummary(parseSummary(parsed))
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : 'Invalid JSON file.')
      }
    }
    reader.readAsText(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  async function runMigration() {
    if (!cards) return
    setMigrating(true)
    setProgress(0)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMigrating(false); return }

    const today = new Date().toISOString().slice(0, 10)
    let inserted = 0, skipped = 0, errors = 0
    const toMigrate = cards.filter(c => {
      const sec = c.section ?? 'watchlist'
      return sec !== 'sold' && !!c.name
    })

    for (let i = 0; i < toMigrate.length; i++) {
      const c = toMigrate[i]
      setProgress(Math.round(((i + 1) / toMigrate.length) * 100))

      const sec = c.section ?? 'watchlist'
      const table = sec === 'collection' ? 'collections' : 'watchlists'

      const row = {
        user_id:            user.id,
        tcg_id:             c.tcgId ?? '',
        name:               c.name,
        set_name:           c.setName ?? null,
        set_id:             c.setId ?? null,
        number:             c.number ?? null,
        rarity:             c.rarity ?? null,
        image_url:          c.imageUrl ?? null,
        image_url_large:    c.imageUrlLarge ?? null,
        condition:          c.condition ?? 'raw',
        quantity:           c.quantity ?? 1,
        purchase_price:     c.purchasePrice ?? null,
        binder:             c.binder ?? c.folder ?? null,
        added_date:         c.addedDate ?? today,
        target_buy_price:   c.targetBuyPrice ?? c.alertPrice ?? null,
        target_sell_price:  c.targetSellPrice ?? null,
        pricecharting_id:   c.pricechartingId ?? null,
        pricecharting_name: c.pricechartingName ?? null,
        current_price:      c.currentPrice ?? null,
        price_source:       c.priceSource ?? null,
        type:               c.type ?? 'card',
      }

      const { error } = await supabase.from(table).insert(row)
      if (error) {
        if (error.code === '23505') skipped++ // duplicate
        else errors++
      } else {
        inserted++
      }
    }

    setResults({ inserted, skipped, errors })
    setMigrating(false)
    setDone(true)
  }

  const inputCls = 'hidden'

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Import from Desktop</h1>
        <p className="text-slate-400 text-sm">
          Upload your <code className="text-slate-300 bg-surface-700 px-1.5 py-0.5 rounded text-xs">cards.json</code> file
          from the PokePrice desktop app to import your collection into the web app.
        </p>
      </div>

      {/* How to export instructions */}
      <div className="bg-surface-800 border border-surface-600 rounded-xl p-5 space-y-3">
        <h2 className="text-white font-semibold text-sm">How to get your cards.json</h2>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-600 border border-surface-500 flex items-center justify-center text-xs text-white font-bold">1</span>
            Open the PokePrice desktop app
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-600 border border-surface-500 flex items-center justify-center text-xs text-white font-bold">2</span>
            Go to <span className="text-white">Settings → Export Data → Export cards.json</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-600 border border-surface-500 flex items-center justify-center text-xs text-white font-bold">3</span>
            Or navigate directly to your app data folder and find <code className="text-slate-300 bg-surface-700 px-1 rounded text-xs">users/&lt;username&gt;/cards.json</code>
          </li>
        </ol>
      </div>

      {/* Drop zone */}
      {!done && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-accent bg-accent/5'
              : 'border-surface-500 hover:border-surface-400 bg-surface-800 hover:bg-surface-700/50'
          }`}
        >
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFileChange} className={inputCls} />
          <div className="flex flex-col items-center gap-3">
            <svg className={`w-10 h-10 ${dragging ? 'text-accent' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div>
              <p className="text-white font-medium text-sm">Drop cards.json here</p>
              <p className="text-slate-500 text-xs mt-1">or click to browse</p>
            </div>
          </div>
        </div>
      )}

      {parseError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          {parseError}
        </div>
      )}

      {/* Preview summary */}
      {summary && !done && (
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold text-sm">Ready to import</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Collection', value: summary.collection, color: 'text-emerald-400' },
              { label: 'Watchlist',  value: summary.watchlist,  color: 'text-sky-400' },
              { label: 'Sold (skip)', value: summary.sold,      color: 'text-slate-500' },
              { label: 'Invalid',   value: summary.skipped,    color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-700 border border-surface-600 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs">
            {summary.collection + summary.watchlist} cards will be imported. Sold cards and invalid entries are skipped. Duplicates (same name/set already in your account) will be skipped automatically.
          </p>

          {/* Progress bar */}
          {migrating && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Importing…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={runMigration}
              disabled={migrating || summary.collection + summary.watchlist === 0}
              className="flex-1 py-2.5 bg-accent hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {migrating ? `Importing… ${progress}%` : `Import ${summary.collection + summary.watchlist} Cards`}
            </button>
            {!migrating && (
              <button
                onClick={() => { setCards(null); setSummary(null); if (fileRef.current) fileRef.current.value = '' }}
                className="px-4 py-2.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 font-medium rounded-xl text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="bg-surface-800 border border-surface-600 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold">Import complete</p>
              <p className="text-slate-400 text-sm">Your cards have been added to your account.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Imported',  value: results.inserted, color: 'text-emerald-400' },
              { label: 'Skipped',   value: results.skipped,  color: 'text-slate-400' },
              { label: 'Errors',    value: results.errors,   color: results.errors > 0 ? 'text-red-400' : 'text-slate-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-700 border border-surface-600 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <a
            href="/"
            className="block w-full text-center py-2.5 bg-accent hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-colors"
          >
            Go to My Collection
          </a>
        </div>
      )}
    </div>
  )
}
