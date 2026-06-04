import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../context/AuthContext'

// ── Condition meta (mirrors CardRow) ──────────────────────────────────
const CONDITION_LABEL = {
  raw: 'Raw', psa10: 'PSA 10', psa9: 'PSA 9',
  psa8: 'PSA 8', cgc10: 'CGC 10', cgc9: 'CGC 9',
}
const CONDITION_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}

// ── Haversine distance (miles) ────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── FOR TRADE pill ────────────────────────────────────────────────────
function ForTradePill({ pulse = false }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-[2px] rounded-full flex-shrink-0 select-none"
      style={{
        background: 'rgba(255,45,91,0.11)',
        border: '1px solid rgba(255,45,91,0.42)',
        color: '#ff6b8a',
        textShadow: '0 0 8px rgba(255,45,91,0.55)',
        boxShadow: pulse
          ? '0 0 12px rgba(255,45,91,0.28), inset 0 0 5px rgba(255,45,91,0.07)'
          : '0 0 8px rgba(255,45,91,0.16), inset 0 0 4px rgba(255,45,91,0.05)',
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: '#ff2d5b',
          boxShadow: '0 0 5px #ff2d5b, 0 0 10px rgba(255,45,91,0.5)',
          display: 'inline-block',
        }}
      />
      For Trade
    </span>
  )
}

// ── Condition pill ────────────────────────────────────────────────────
function CondPill({ condition }) {
  const label = CONDITION_LABEL[condition] || condition
  const color = CONDITION_COLOR[condition] || 'bg-slate-700 text-slate-300'
  return <span className={`text-[9px] px-1.5 py-px rounded-full font-semibold ${color}`}>{label}</span>
}

// ── Price requirement badge ───────────────────────────────────────────
function ReqBadge({ listing }) {
  if (listing.accept_any) return (
    <span className="text-[9px] font-semibold px-1.5 py-px rounded-full bg-slate-700/50 border border-slate-600/40 text-slate-400">Any offer</span>
  )
  if (listing.require_price_match && !listing.price_tolerance) return (
    <span className="text-[9px] font-semibold px-1.5 py-px rounded-full bg-emerald-900/30 border border-emerald-600/30 text-emerald-400">Equal match</span>
  )
  return (
    <span className="text-[9px] font-semibold px-1.5 py-px rounded-full bg-yellow-900/20 border border-yellow-600/30 text-yellow-400">
      ±{listing.price_tolerance}% ok
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ username, size = 22 }) {
  const initials = (username || '?').slice(0, 2).toUpperCase()
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size, height: size,
        fontSize: size * 0.42,
        background: 'linear-gradient(135deg, #374151, #1f2937)',
      }}
    >
      {initials}
    </div>
  )
}

// ── Price match meter ─────────────────────────────────────────────────
function PriceMeter({ offered, required, tolerance }) {
  if (!required) return null
  const pct = required > 0 ? (offered / required) * 100 : 100
  const low = 100 - (tolerance || 0)
  const high = 100 + (tolerance || 0)
  const ok = pct >= low && pct <= high * 1.5
  const over = pct > high * 1.5
  const fill = Math.min(pct, 200) / 2 // map to 0–100% width

  const fillClass = ok ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : over ? 'bg-gradient-to-r from-sky-400 to-sky-500'
    : 'bg-gradient-to-r from-red-400 to-red-500'

  const statusColor = ok ? 'text-emerald-400' : over ? 'text-sky-400' : 'text-red-400'
  const icon = ok
    ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />

  const diff = offered - required
  const label = ok
    ? diff >= 0
      ? `$${diff.toFixed(0)} over req. — within ±${tolerance}%`
      : `$${Math.abs(diff).toFixed(0)} under req. — within ±${tolerance}%`
    : over
      ? `$${diff.toFixed(0)} over — still accepted`
      : `$${Math.abs(diff).toFixed(0)} under req. — outside ±${tolerance}%`

  return (
    <div className="mt-2">
      <div className="h-[3px] rounded-full bg-surface-600 overflow-hidden mb-1">
        <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${fill}%` }} />
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusColor}`}>
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">{icon}</svg>
        {label}
      </div>
    </div>
  )
}

// ── Card thumbnail ────────────────────────────────────────────────────
function CardThumb({ imageUrl, name, size = 36 }) {
  return (
    <div
      className="flex-shrink-0 rounded overflow-hidden bg-surface-900 flex items-center justify-center"
      style={{ width: size, height: Math.round(size * 1.4) }}
    >
      {imageUrl
        ? <img src={imageUrl} alt={name} className="w-full h-full object-contain" />
        : <span className="text-slate-700 text-[9px]">No img</span>
      }
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────
function VDiv() {
  return <div className="self-stretch w-px bg-surface-600 flex-shrink-0" />
}

// ═════════════════════════════════════════════════════════════════════
// ListRow — single listing in the center feed
// ═════════════════════════════════════════════════════════════════════
function ListRow({ listing, selected, onClick }) {
  const { format } = useCurrency()
  const distLabel = listing._distance != null ? `${listing._distance.toFixed(1)} mi` : null

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 border-b border-surface-700 cursor-pointer transition-all ${
        selected
          ? 'bg-rose-950/20 border-l-2 border-l-rose-500/50'
          : 'hover:bg-surface-800/50 border-l-2 border-l-transparent'
      }`}
    >
      <CardThumb imageUrl={listing.card_image_url} name={listing.card_name} size={36} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-semibold text-sm leading-tight truncate">{listing.card_name}</span>
          <CondPill condition={listing.card_condition} />
        </div>
        <p className="text-slate-500 text-xs truncate">{listing.card_set}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-accent font-bold text-sm">{format(listing.market_price || 0)}</span>
          <ReqBadge listing={listing} />
          <span className="text-slate-600 text-xs truncate">
            {listing.username_display}
            {distLabel && ` · ${distLabel}`}
            {listing.city && ` · ${listing.city}`}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
          selected
            ? 'bg-rose-900/30 border-rose-500/40 text-rose-400'
            : 'bg-surface-700 border-surface-500 text-slate-300 hover:border-accent/40 hover:text-accent hover:bg-accent/10'
        }`}
      >
        {selected ? 'Composing' : 'Submit Trade'}
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// MyListingRow — listing in "My Listings" sub-tab
// ═════════════════════════════════════════════════════════════════════
function MyListingRow({ listing, onRemove }) {
  const { format } = useCurrency()
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    if (!confirm(`Remove "${listing.card_name}" from Trade Market?`)) return
    setRemoving(true)
    try {
      await window.api.tradeMarket.deleteListing(listing.id)
      if (listing.card_id) {
        await window.api.updateCard(listing.card_id, { forTrade: false, tradeListingId: null, tradeSettings: null })
      }
      onRemove(listing.id)
    } catch (err) {
      console.error('[MyListingRow] remove failed:', err)
      setRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-700">
      <CardThumb imageUrl={listing.card_image_url} name={listing.card_name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-white font-medium text-sm truncate">{listing.card_name}</span>
          <CondPill condition={listing.card_condition} />
          <ForTradePill />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-xs">{format(listing.market_price || 0)}</span>
          <ReqBadge listing={listing} />
        </div>
      </div>
      <button
        onClick={handleRemove}
        disabled={removing}
        className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-red-800/40 bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-all disabled:opacity-40"
      >
        {removing ? '…' : 'Delist'}
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// InboxRow — incoming trade offer
// ═════════════════════════════════════════════════════════════════════
function InboxRow({ offer, onRespond }) {
  const { format } = useCurrency()
  const [responding, setResponding] = useState(false)
  const isNew = offer.status === 'pending'

  const totalOffered = (offer.offered_cards || []).reduce((s, c) => s + (c.price || 0), 0)

  async function respond(action) {
    setResponding(true)
    try {
      await window.api.tradeMarket.respondToOffer(offer.id, action)
      onRespond(offer.id, action)
    } catch (err) {
      console.error('[InboxRow] respond failed:', err)
      setResponding(false)
    }
  }

  return (
    <div
      className={`mx-4 mb-3 rounded-xl overflow-hidden border transition-all ${
        isNew
          ? 'border-rose-500/20 shadow-[0_0_14px_rgba(255,45,91,0.06)]'
          : 'border-surface-600'
      } bg-surface-800`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-surface-700">
        <Avatar username={offer.offerer_username_display || offer.offerer_user_id} size={24} />
        <div className="flex-1 min-w-0">
          <span className="text-slate-200 text-xs font-semibold">{offer.offerer_username_display || offer.offerer_user_id}</span>
          {offer.offerer_city && <span className="text-slate-600 text-xs ml-1">· {offer.offerer_city}</span>}
        </div>
        {isNew && (
          <span
            className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(255,45,91,0.15)', border: '1px solid rgba(255,45,91,0.3)', color: '#fb7185' }}
          >
            new
          </span>
        )}
        <span className="text-slate-600 text-[10px]">{new Date(offer.created_at).toLocaleDateString()}</span>
      </div>

      {/* For listing */}
      <div className="px-3 py-2 border-b border-surface-700">
        <p className="text-slate-500 text-[10px] mb-1">Offering for your listing:</p>
        <div className="flex items-center gap-2">
          <CardThumb imageUrl={offer._listing?.card_image_url} name={offer._listing?.card_name} size={24} />
          <div>
            <p className="text-slate-300 text-xs font-medium">{offer._listing?.card_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {offer._listing && <CondPill condition={offer._listing.card_condition} />}
              <span className="text-accent text-[10px] font-bold">{format(offer._listing?.market_price || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Offered cards */}
      <div className="px-3 py-2 border-b border-surface-700">
        <p className="text-slate-500 text-[10px] mb-2">Their offer ({(offer.offered_cards || []).length} card{(offer.offered_cards || []).length !== 1 ? 's' : ''}):</p>
        <div className="flex items-center gap-2 flex-wrap">
          {(offer.offered_cards || []).slice(0, 4).map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-700 rounded-lg px-2 py-1.5 border border-surface-600">
              <CardThumb imageUrl={c.imageUrl} name={c.name} size={22} />
              <div>
                <p className="text-slate-300 text-[10px] font-medium max-w-[80px] truncate">{c.name}</p>
                <div className="flex items-center gap-1">
                  <CondPill condition={c.condition} />
                  <span className="text-accent text-[9px] font-bold">{format(c.price || 0)}</span>
                </div>
              </div>
            </div>
          ))}
          {(offer.offered_cards || []).length > 4 && (
            <span className="text-slate-500 text-xs">+{offer.offered_cards.length - 4} more</span>
          )}
        </div>
        {offer.note && <p className="text-slate-500 text-xs italic mt-2">"{offer.note}"</p>}

        {/* Price meter */}
        {offer._listing && !offer._listing.accept_any && (
          <PriceMeter
            offered={totalOffered}
            required={offer._listing.market_price}
            tolerance={offer._listing.price_tolerance || 0}
          />
        )}
      </div>

      {/* Actions */}
      {isNew ? (
        <div className="flex gap-2 px-3 py-2">
          <button onClick={() => respond('accepted')} disabled={responding}
            className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-emerald-600/30 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 transition-all disabled:opacity-40">
            Accept
          </button>
          <button onClick={() => respond('countered')} disabled={responding}
            className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-yellow-600/30 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40 transition-all disabled:opacity-40">
            Counter
          </button>
          <button onClick={() => respond('declined')} disabled={responding}
            className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-red-800/30 bg-red-900/15 text-red-400 hover:bg-red-900/30 transition-all disabled:opacity-40">
            Decline
          </button>
        </div>
      ) : (
        <div className="px-3 py-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            offer.status === 'accepted' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-600/30'
            : offer.status === 'declined' ? 'bg-red-900/20 text-red-400 border border-red-700/30'
            : 'bg-yellow-900/20 text-yellow-400 border border-yellow-600/30'
          }`}>
            {offer.status === 'accepted' ? 'Accepted' : offer.status === 'declined' ? 'Declined' : 'Countered'}
          </span>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// ListForTradeModal — select a card and configure listing settings
// ═════════════════════════════════════════════════════════════════════
function ListForTradeModal({ portfolioCards, userLocation, onClose, onListed }) {
  const { format } = useCurrency()
  const [step, setStep] = useState(1) // 1=pick card, 2=configure
  const [selectedCard, setSelectedCard] = useState(null)
  const [search, setSearch] = useState('')
  const [requireMatch, setRequireMatch] = useState(false)
  const [acceptAny, setAcceptAny] = useState(true)
  const [tolerance, setTolerance] = useState(15)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const available = portfolioCards.filter(c =>
    !c.forTrade &&
    (search === '' || c.name.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleList() {
    if (!selectedCard) return
    setSubmitting(true)
    try {
      const settings = {
        requirePriceMatch: requireMatch && !acceptAny,
        priceTolerance: acceptAny ? 0 : tolerance,
        acceptAny,
        description,
      }
      const listing = await window.api.tradeMarket.createListing({
        card_id: selectedCard.id,
        card_name: selectedCard.name,
        card_set: selectedCard.setName,
        card_number: selectedCard.number,
        card_condition: selectedCard.condition,
        card_type: selectedCard.type || 'card',
        card_image_url: selectedCard.imageUrl,
        market_price: selectedCard.currentPrice || 0,
        require_price_match: settings.requirePriceMatch,
        price_tolerance: settings.priceTolerance,
        accept_any: settings.acceptAny,
        description: settings.description,
        city: userLocation.city,
        state_code: userLocation.state,
        lat: userLocation.lat,
        lng: userLocation.lng,
      })
      await window.api.updateCard(selectedCard.id, {
        forTrade: true,
        tradeListingId: listing?.id || null,
        tradeSettings: settings,
      })
      onListed(listing, selectedCard)
    } catch (err) {
      console.error('[ListForTradeModal] failed:', err)
      alert('Failed to list card. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-800 border border-surface-600 rounded-xl w-[520px] max-h-[600px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <div>
            <h3 className="text-white font-bold text-sm">List a Card for Trade</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              {step === 1 ? 'Choose a card from your portfolio' : `Configure trade settings for ${selectedCard?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 1 ? (
          <>
            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <input
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Search cards..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {/* Card list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {available.length === 0 ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-slate-600 text-sm">
                    {portfolioCards.length === 0 ? 'No portfolio cards to list.' : 'No cards match your search.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {available.map(card => (
                    <div
                      key={card.id}
                      onClick={() => { setSelectedCard(card); setStep(2) }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-surface-600 bg-surface-700 hover:border-accent/40 hover:bg-surface-600 cursor-pointer transition-all group"
                    >
                      <CardThumb imageUrl={card.imageUrl} name={card.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-white font-semibold text-sm truncate">{card.name}</p>
                          <CondPill condition={card.condition} />
                        </div>
                        <p className="text-slate-500 text-xs">{card.setName}</p>
                      </div>
                      <span className="text-accent font-bold text-sm flex-shrink-0">{format(card.currentPrice || 0)}</span>
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-300 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Selected card preview */}
            <div className="flex items-center gap-3 bg-surface-700 border border-surface-500 rounded-xl p-3">
              <CardThumb imageUrl={selectedCard.imageUrl} name={selectedCard.name} size={40} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-semibold text-sm">{selectedCard.name}</p>
                  <CondPill condition={selectedCard.condition} />
                </div>
                <p className="text-slate-500 text-xs">{selectedCard.setName}</p>
                <p className="text-accent font-bold text-sm mt-0.5">{format(selectedCard.currentPrice || 0)}</p>
              </div>
              <button onClick={() => setStep(1)} className="ml-auto text-slate-500 hover:text-slate-300 text-xs transition-colors">
                Change
              </button>
            </div>

            {/* Price requirements */}
            <div>
              <p className="text-slate-300 text-xs font-semibold mb-2">Price requirement for incoming offers</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-surface-500 bg-surface-700 cursor-pointer hover:border-surface-400 transition-colors">
                  <input type="radio" name="req" checked={acceptAny} onChange={() => { setAcceptAny(true); setRequireMatch(false) }} className="accent-amber-500" />
                  <div>
                    <p className="text-slate-200 text-sm font-medium">Accept any offer</p>
                    <p className="text-slate-500 text-xs">You'll be notified of all trade proposals regardless of value</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  !acceptAny ? 'border-accent/40 bg-accent/5' : 'border-surface-500 bg-surface-700 hover:border-surface-400'
                }`}>
                  <input type="radio" name="req" checked={!acceptAny} onChange={() => { setAcceptAny(false); setRequireMatch(true) }} className="accent-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-slate-200 text-sm font-medium">Allow variance</p>
                    <p className="text-slate-500 text-xs">Offered cards must be within ±% of your card's market value</p>
                    {!acceptAny && (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-slate-400 text-xs w-20">±{tolerance}%</span>
                        <input
                          type="range" min="0" max="50" step="5" value={tolerance}
                          onChange={e => setTolerance(Number(e.target.value))}
                          className="flex-1 accent-amber-500"
                          style={{ height: '4px' }}
                        />
                        <span className="text-slate-500 text-xs w-8">±50%</span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-slate-300 text-xs font-semibold mb-1.5">Description (optional)</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Open to PSA graded cards, prefer Evolving Skies pulls..."
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 resize-none transition-colors"
              />
            </div>

            {/* Location note */}
            {userLocation.city && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                Listing will show as {userLocation.city}{userLocation.state ? `, ${userLocation.state}` : ''}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {step === 2 && (
          <div className="flex gap-3 px-5 py-4 border-t border-surface-700">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-surface-700 border border-surface-500 text-slate-300 text-sm font-medium hover:bg-surface-600 transition-colors">
              Back
            </button>
            <button
              onClick={handleList}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover text-black font-bold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Listing…' : 'List for Trade'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// OfferPanel — right panel for composing a trade offer
// ═════════════════════════════════════════════════════════════════════
function OfferPanel({ listing, portfolioCards, onClose, onSubmitted }) {
  const { format } = useCurrency()
  const [selectedCards, setSelectedCards] = useState([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const available = portfolioCards.filter(c =>
    search === '' || c.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(card) {
    setSelectedCards(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    )
  }

  const totalOffered = selectedCards.reduce((s, c) => s + (c.currentPrice || 0), 0)
  const required = listing.market_price || 0
  const tolerance = listing.price_tolerance || 0

  async function handleSubmit() {
    if (selectedCards.length === 0) return
    setSubmitting(true)
    try {
      const offeredCards = selectedCards.map(c => ({
        id: c.id,
        name: c.name,
        setName: c.setName,
        condition: c.condition,
        price: c.currentPrice || 0,
        imageUrl: c.imageUrl,
      }))
      await window.api.tradeMarket.submitOffer({
        listing_id: listing.id,
        offered_cards: offeredCards,
        total_offered_value: totalOffered,
        note,
      })
      onSubmitted()
    } catch (err) {
      console.error('[OfferPanel] submit failed:', err)
      alert('Failed to submit trade. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-l border-surface-600 bg-surface-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-surface-700 bg-surface-800">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white font-bold text-sm">Your Trade Offer</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <span className="text-slate-500">For:</span>
          <span className="text-slate-300 font-medium truncate max-w-[120px]">{listing.card_name}</span>
          <span className="text-accent font-bold">{format(listing.market_price || 0)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <ReqBadge listing={listing} />
          <span className="text-slate-600 text-xs">by {listing.username_display}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <input
          className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 transition-colors"
          placeholder="Search your cards…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Card picker */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {available.map(card => {
          const isSelected = selectedCards.some(c => c.id === card.id)
          return (
            <div
              key={card.id}
              onClick={() => toggle(card)}
              className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-accent/40 bg-accent/8'
                  : 'border-surface-600 bg-surface-700 hover:border-surface-500 hover:bg-surface-600'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-[4px] flex-shrink-0 flex items-center justify-center border transition-all ${
                  isSelected ? 'bg-accent/25 border-accent/60' : 'bg-surface-600 border-surface-500'
                }`}
              >
                {isSelected && (
                  <svg className="w-2.5 h-2.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <CardThumb imageUrl={card.imageUrl} name={card.name} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-xs font-medium truncate">{card.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <CondPill condition={card.condition} />
                </div>
              </div>
              <span className="text-accent text-xs font-bold flex-shrink-0">{format(card.currentPrice || 0)}</span>
            </div>
          )
        })}
        {available.length === 0 && (
          <div className="flex items-center justify-center h-16">
            <p className="text-slate-600 text-xs">No portfolio cards found</p>
          </div>
        )}
      </div>

      {/* Value summary */}
      {(selectedCards.length > 0 || !listing.accept_any) && (
        <div className="flex-shrink-0 mx-3 mb-2 bg-surface-700 border border-surface-600 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 text-xs">Your offer</span>
            <span className="text-accent font-bold text-sm">{format(totalOffered)}</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 text-xs">Requested</span>
            <span className="text-slate-300 text-xs">{format(required)}{tolerance ? ` (±${tolerance}%)` : ''}</span>
          </div>
          {!listing.accept_any && required > 0 && (
            <PriceMeter offered={totalOffered} required={required} tolerance={tolerance} />
          )}
        </div>
      )}

      {/* Note */}
      <div className="flex-shrink-0 px-3 mb-2">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Add a note (optional)…"
          className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 resize-none transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-3 pb-3">
        <button onClick={onClose} className="px-3 py-2 rounded-lg bg-surface-700 border border-surface-500 text-slate-300 text-xs font-medium hover:bg-surface-600 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedCards.length === 0}
          className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover text-black font-bold text-xs transition-colors disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : `Submit Trade${selectedCards.length > 0 ? ` (${selectedCards.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════
// TradeMarket — main page component
// ═════════════════════════════════════════════════════════════════════
export default function TradeMarket({ searchQuery = '' }) {
  const { format } = useCurrency()
  const { user } = useAuth()

  // ── Data state ──────────────────────────────────────────────────
  const [listings, setListings] = useState([])
  const [myListings, setMyListings] = useState([])
  const [inbox, setInbox] = useState([])
  const [portfolioCards, setPortfolioCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbAvailable, setDbAvailable] = useState(true)

  // ── UI state ────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('market')
  const [selectedListing, setSelectedListing] = useState(null)
  const [showListModal, setShowListModal] = useState(false)
  const [offerSuccess, setOfferSuccess] = useState(false)

  // ── Filters ─────────────────────────────────────────────────────
  const [maxDistance, setMaxDistance] = useState(25)
  const [condFilter, setCondFilter] = useState('all')
  const [userLocation, setUserLocation] = useState({ city: '', state: '', lat: null, lng: null })

  // ── Load on mount ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cards, settings, listingsData, inboxData, myListingsData] = await Promise.all([
        window.api.listCards().catch(() => []),
        window.api.getSettings().catch(() => ({})),
        window.api.tradeMarket.getListings({}).catch(() => null),
        window.api.tradeMarket.getInbox().catch(() => []),
        window.api.tradeMarket.getMyListings().catch(() => []),
      ])

      if (listingsData === null) {
        setDbAvailable(false)
      } else {
        setDbAvailable(true)
        setListings(listingsData || [])
        setInbox(inboxData || [])
        setMyListings(myListingsData || [])
      }

      const portfolio = (cards || []).filter(c => c.section === 'collection' && !c.soldInfo?.salePrice)
      setPortfolioCards(portfolio)

      const prof = settings?.profile || {}
      if (prof.city || prof.state) {
        setUserLocation({
          city: prof.city || '',
          state: prof.state || '',
          lat: prof.lat ?? null,
          lng: prof.lng ?? null,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Filter + sort listings ────────────────────────────────────────
  const filtered = useMemo(() => {
    const currentUsername = user?.username || ''
    const q = searchQuery.trim().toLowerCase()
    return listings
      .filter(l => l.status === 'active' && l.user_id !== currentUsername)
      .filter(l => condFilter === 'all' || l.card_condition === condFilter)
      .filter(l => {
        if (!q) return true
        return (
          (l.card_name || '').toLowerCase().includes(q) ||
          (l.card_set || '').toLowerCase().includes(q) ||
          (l.username_display || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (CONDITION_LABEL[l.card_condition] || '').toLowerCase().includes(q)
        )
      })
      .map(l => {
        let dist = null
        if (userLocation.lat && userLocation.lng && l.lat && l.lng) {
          dist = haversine(userLocation.lat, userLocation.lng, l.lat, l.lng)
        }
        return { ...l, _distance: dist }
      })
      .filter(l => l._distance == null || l._distance <= maxDistance)
      .sort((a, b) => {
        if (a._distance != null && b._distance != null) return a._distance - b._distance
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [listings, condFilter, maxDistance, userLocation, user, searchQuery])

  const newInboxCount = inbox.filter(o => o.status === 'pending').length

  // ── Handlers ─────────────────────────────────────────────────────
  function handleSelectListing(listing) {
    setSelectedListing(prev => prev?.id === listing.id ? null : listing)
    setOfferSuccess(false)
  }

  function handleOfferSubmitted() {
    setOfferSuccess(true)
    setSelectedListing(null)
    loadAll()
  }

  function handleInboxRespond(offerId, action) {
    setInbox(prev => prev.map(o => o.id === offerId ? { ...o, status: action } : o))
  }

  function handleListed(listing, card) {
    setShowListModal(false)
    setMyListings(prev => [...prev, listing].filter(Boolean))
    setPortfolioCards(prev => prev.map(c => c.id === card.id ? { ...c, forTrade: true, tradeListingId: listing?.id } : c))
    setActiveSubTab('my-listings')
  }

  function handleMyListingRemoved(listingId) {
    setMyListings(prev => prev.filter(l => l.id !== listingId))
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ height: '100%' }}>

      {/* ── Left sidebar ── */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-surface-700 bg-surface-800 overflow-y-auto">

        {/* My Listings preview */}
        <div className="px-4 pt-4 pb-3 border-b border-surface-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">My Listings</span>
            {myListings.length > 0 && (
              <span
                className="text-[9px] font-bold px-1.5 py-px rounded-full"
                style={{ background: 'rgba(255,45,91,0.14)', border: '1px solid rgba(255,45,91,0.3)', color: '#fb7185' }}
              >
                {myListings.length}
              </span>
            )}
          </div>

          {myListings.length > 0 ? (
            <div className="bg-surface-700 border border-surface-600 rounded-xl overflow-hidden">
              {myListings.slice(0, 3).map((listing, i) => (
                <div key={listing.id || i} className={`flex items-center gap-2 px-2.5 py-2 ${i > 0 ? 'border-t border-surface-600' : ''}`}>
                  <CardThumb imageUrl={listing.card_image_url} name={listing.card_name} size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-[11px] font-medium truncate">{listing.card_name}</p>
                    <span className="text-accent text-[10px] font-bold">{format(listing.market_price || 0)}</span>
                  </div>
                  <ForTradePill />
                </div>
              ))}
              {myListings.length > 3 && (
                <div className="px-2.5 py-1.5 border-t border-surface-600 text-center">
                  <span className="text-slate-500 text-[10px]">+{myListings.length - 3} more</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-600 text-xs">No cards listed yet</p>
          )}

          <button
            onClick={() => setShowListModal(true)}
            className="mt-2.5 w-full text-center text-[11px] font-semibold py-1.5 rounded-lg border transition-all"
            style={{ background: 'rgba(255,45,91,0.08)', borderColor: 'rgba(255,45,91,0.22)', color: '#fb7185' }}
          >
            + List a Card
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 flex-1">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Filter Market</p>

          {/* Location */}
          <div className="mb-3">
            <p className="text-slate-500 text-[11px] mb-1">Location</p>
            <div className="flex items-center gap-1.5 bg-surface-700 border border-surface-600 rounded-lg px-2.5 py-1.5">
              <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="text-slate-300 text-xs truncate">
                {userLocation.city || 'No location set'}
                {userLocation.state ? `, ${userLocation.state}` : ''}
              </span>
            </div>
          </div>

          {/* Distance */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-500 text-[11px]">Max distance</span>
              <span className="text-accent text-[11px] font-bold">{maxDistance} mi</span>
            </div>
            <input
              type="range" min="5" max="100" step="5" value={maxDistance}
              onChange={e => setMaxDistance(Number(e.target.value))}
              className="w-full accent-amber-500"
              style={{ height: '3px' }}
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-slate-600 text-[9px]">5 mi</span>
              <span className="text-slate-600 text-[9px]">100 mi</span>
            </div>
          </div>

          {/* Condition */}
          <div className="mb-3">
            <p className="text-slate-500 text-[11px] mb-1.5">Condition</p>
            <div className="flex flex-wrap gap-1">
              {['all', 'raw', 'psa10', 'psa9', 'cgc10'].map(c => (
                <button
                  key={c}
                  onClick={() => setCondFilter(c)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border transition-all ${
                    condFilter === c
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-surface-700 border-surface-500 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {c === 'all' ? 'All' : CONDITION_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Center feed ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface-900">

        {/* Sub-tab bar */}
        <div className="flex-shrink-0 flex items-center bg-surface-800 border-b border-surface-700 px-0">
          {[
            { id: 'market', label: 'Market' },
            { id: 'inbox', label: 'Inbox', count: newInboxCount },
            { id: 'my-listings', label: 'My Listings', count: myListings.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeSubTab === tab.id
                  ? 'border-rose-400 text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-[9px] font-bold px-1.5 py-px rounded-full"
                  style={{ background: 'rgba(255,45,91,0.15)', border: '1px solid rgba(255,45,91,0.3)', color: '#fb7185' }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {!dbAvailable ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <div>
                <p className="text-slate-400 font-semibold text-sm">Trade Market requires a database connection</p>
                <p className="text-slate-600 text-xs mt-1">Set DATABASE_URL in your environment to enable peer-to-peer trading.</p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading market…
              </div>
            </div>
          ) : activeSubTab === 'market' ? (
            <>
              {offerSuccess && (
                <div className="mx-4 mt-3 flex items-center gap-2 bg-emerald-900/20 border border-emerald-600/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Trade offer submitted! The seller will be notified.
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-slate-500 text-sm">No listings near {userLocation.city || 'you'}</p>
                  <p className="text-slate-600 text-xs">Try increasing your distance or clearing filters</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 bg-surface-800/50">
                    <span className="text-slate-500 text-xs">{filtered.length} listing{filtered.length !== 1 ? 's' : ''} near you</span>
                  </div>
                  {filtered.map(listing => (
                    <ListRow
                      key={listing.id}
                      listing={listing}
                      selected={selectedListing?.id === listing.id}
                      onClick={() => handleSelectListing(listing)}
                    />
                  ))}
                </>
              )}
            </>
          ) : activeSubTab === 'inbox' ? (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 bg-surface-800/50">
                <span className="text-slate-500 text-xs">
                  {inbox.length} offer{inbox.length !== 1 ? 's' : ''}{newInboxCount > 0 ? ` · ${newInboxCount} new` : ''}
                </span>
              </div>
              {inbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-slate-500 text-sm">No incoming trade offers</p>
                  <p className="text-slate-600 text-xs">List a card for trade to start receiving offers</p>
                </div>
              ) : (
                <div className="pt-3">
                  {inbox.map(offer => (
                    <InboxRow key={offer.id} offer={offer} onRespond={handleInboxRespond} />
                  ))}
                </div>
              )}
            </>
          ) : (
            // My Listings sub-tab
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 bg-surface-800/50">
                <span className="text-slate-500 text-xs">{myListings.length} active listing{myListings.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => setShowListModal(true)}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                >
                  + List a Card
                </button>
              </div>
              {myListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <ForTradePill />
                  <p className="text-slate-500 text-sm">No cards listed for trade</p>
                  <button
                    onClick={() => setShowListModal(true)}
                    className="text-xs font-semibold px-4 py-2 rounded-lg border transition-all"
                    style={{ background: 'rgba(255,45,91,0.08)', borderColor: 'rgba(255,45,91,0.25)', color: '#fb7185' }}
                  >
                    List your first card
                  </button>
                </div>
              ) : (
                myListings.map(listing => (
                  <MyListingRow key={listing.id} listing={listing} onRemove={handleMyListingRemoved} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right offer panel ── */}
      {selectedListing && (
        <OfferPanel
          listing={selectedListing}
          portfolioCards={portfolioCards}
          onClose={() => setSelectedListing(null)}
          onSubmitted={handleOfferSubmitted}
        />
      )}

      {/* ── List for Trade modal ── */}
      {showListModal && (
        <ListForTradeModal
          portfolioCards={portfolioCards}
          userLocation={userLocation}
          onClose={() => setShowListModal(false)}
          onListed={handleListed}
        />
      )}
    </div>
  )
}
