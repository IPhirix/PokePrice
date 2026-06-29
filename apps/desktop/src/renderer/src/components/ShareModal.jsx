import { useState } from 'react'
import { CONDITION_LABEL as COND_LABEL } from '@pokeprice/ui'
import { useCurrency } from '../context/CurrencyContext'

export default function ShareModal({ cards, section, folderFilter, onClose }) {
  const { format } = useCurrency()
  const [copied, setCopied] = useState(false)

  const isPortfolio = section === 'collection'
  const title = isPortfolio ? 'Collection' : 'Watchlist'
  const folderLabel = folderFilter ? ` — ${folderFilter}` : ''
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  function buildTextTable() {
    const header = isPortfolio
      ? ['Card', 'Set', 'Condition', 'Folder', 'Paid', 'Market Price', 'P&L']
      : ['Card', 'Set', 'Condition', 'Folder', 'Market Price']

    const rows = cards.map((c) => {
      const price = c.currentPrice != null ? format(c.currentPrice) : '—'
      const paid = c.purchasePrice != null ? format(c.purchasePrice) : '—'
      const profit = c.currentPrice != null && c.purchasePrice != null
        ? `${(c.currentPrice - c.purchasePrice) >= 0 ? '+' : '−'}${format(Math.abs(c.currentPrice - c.purchasePrice))}`
        : '—'
      const cond = COND_LABEL[c.condition] || c.condition
      const folder = c.folder || '—'
      const name = c.number ? `${c.name} #${c.number}` : c.name
      return isPortfolio
        ? [name, c.setName, cond, folder, paid, price, profit]
        : [name, c.setName, cond, folder, price]
    })

    const colWidths = header.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] || '').length))
    )

    const pad = (str, len) => str.padEnd(len)
    const divider = colWidths.map((w) => '-'.repeat(w)).join('-+-')
    const headerRow = header.map((h, i) => pad(h, colWidths[i])).join(' | ')
    const dataRows = rows.map((r) => r.map((cell, i) => pad(cell || '', colWidths[i])).join(' | '))

    return [
      `PokePrice — ${title}${folderLabel}`,
      `As of ${date}  •  ${cards.length} card${cards.length !== 1 ? 's' : ''}`,
      '',
      headerRow,
      divider,
      ...dataRows,
    ].join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildTextTable())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[80vh] overflow-hidden">
        <div className="p-5 border-b border-surface-600 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Share {title}{folderLabel}</h2>
            <p className="text-slate-500 text-xs mt-0.5">{cards.length} card{cards.length !== 1 ? 's' : ''} · {date}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-600">
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Card</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Set</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Condition</th>
                  <th className="text-left text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Folder</th>
                  {isPortfolio && <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Paid</th>}
                  <th className="text-right text-slate-400 font-medium pb-2 pr-4 whitespace-nowrap">Market Price</th>
                  {isPortfolio && <th className="text-right text-slate-400 font-medium pb-2 whitespace-nowrap">P&L</th>}
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => {
                  const profit = c.currentPrice != null && c.purchasePrice != null ? c.currentPrice - c.purchasePrice : null
                  return (
                    <tr key={c.id} className="border-b border-surface-700/50 hover:bg-surface-700/30">
                      <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">
                        {c.name}{c.number ? ` #${c.number}` : ''}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{c.setName}</td>
                      <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{COND_LABEL[c.condition] || c.condition}</td>
                      <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{c.folder || '—'}</td>
                      {isPortfolio && (
                        <td className="py-2 pr-4 text-right text-slate-300 whitespace-nowrap">
                          {c.purchasePrice != null ? format(c.purchasePrice) : '—'}
                        </td>
                      )}
                      <td className="py-2 pr-4 text-right text-accent font-medium whitespace-nowrap">
                        {c.currentPrice != null ? format(c.currentPrice) : '—'}
                      </td>
                      {isPortfolio && (
                        <td className={`py-2 text-right font-medium whitespace-nowrap ${profit == null ? 'text-slate-500' : profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {profit != null ? `${profit >= 0 ? '+' : '−'}${format(Math.abs(profit))}` : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 border-t border-surface-600 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg transition-colors">
            Close
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${copied ? 'bg-emerald-600 text-white' : 'bg-accent hover:bg-amber-400 text-black'}`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy to Clipboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
