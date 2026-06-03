import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { CardDetailModal } from './SearchPage'

// ── Favorites (localStorage) ─────────────────────────────────────────────────
const FAV_KEY = 'pokeprice-favorites'
const FAV_VERSION = 1
function getFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || '{}')
    if (raw.__v !== FAV_VERSION) return {}
    const { __v: _, ...favs } = raw
    return favs
  } catch { return {} }
}
function saveFavStorage(f) {
  localStorage.setItem(FAV_KEY, JSON.stringify({ __v: FAV_VERSION, ...f }))
  window.dispatchEvent(new Event('pokeprice-favs'))
}
function useFavorites() {
  const [favs, setFavsState] = useState(getFavs)
  useEffect(() => {
    const update = () => setFavsState(getFavs())
    window.addEventListener('pokeprice-favs', update)
    return () => window.removeEventListener('pokeprice-favs', update)
  }, [])
  function toggle(id, displayName) {
    const f = getFavs()
    const wasFavorited = !!f[id]
    if (f[id]) delete f[id]; else f[id] = displayName
    saveFavStorage(f)
    window.api.appendActivity({
      type: wasFavorited ? 'pokemon_unfavorited' : 'pokemon_favorited',
      message: wasFavorited ? `Unfavorited ${displayName}` : `Favorited ${displayName}`,
    }).catch(() => {})
  }
  return [favs, toggle]
}

const ALL_TYPES = ['bug','dark','dragon','electric','fairy','fighting','fire','flying','ghost','grass','ground','ice','normal','poison','psychic','rock','steel','water']

const GENS = [
  { id: 1, label: 'Gen I',    offset: 0,   count: 151 },
  { id: 2, label: 'Gen II',   offset: 151, count: 100 },
  { id: 3, label: 'Gen III',  offset: 251, count: 135 },
  { id: 4, label: 'Gen IV',   offset: 386, count: 107 },
  { id: 5, label: 'Gen V',    offset: 493, count: 156 },
  { id: 6, label: 'Gen VI',   offset: 649, count: 72  },
  { id: 7, label: 'Gen VII',  offset: 721, count: 88  },
  { id: 8, label: 'Gen VIII', offset: 809, count: 96  },
  { id: 9, label: 'Gen IX',   offset: 905, count: 120 },
]

const TOTAL_POKEMON = GENS.reduce((s, g) => s + g.count, 0) // 1025

const TYPE_COLORS = {
  fire:     'bg-orange-500 text-white',
  water:    'bg-blue-500 text-white',
  grass:    'bg-green-600 text-white',
  electric: 'bg-yellow-400 text-gray-900',
  psychic:  'bg-pink-500 text-white',
  ice:      'bg-cyan-400 text-gray-900',
  dragon:   'bg-indigo-600 text-white',
  dark:     'bg-gray-700 text-white',
  fairy:    'bg-pink-400 text-white',
  normal:   'bg-gray-500 text-white',
  fighting: 'bg-red-700 text-white',
  flying:   'bg-sky-400 text-gray-900',
  poison:   'bg-purple-600 text-white',
  ground:   'bg-yellow-600 text-white',
  rock:     'bg-yellow-700 text-white',
  bug:      'bg-lime-600 text-white',
  ghost:    'bg-purple-800 text-white',
  steel:    'bg-slate-500 text-white',
}

function typeBadge(type) {
  return `${TYPE_COLORS[type?.toLowerCase()] || 'bg-gray-600 text-white'} text-xs font-semibold px-2 py-0.5 rounded-full capitalize`
}

function animatedSprite(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`
}

function officialArt(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
}

function rawPrice(card) {
  return card.cardmarket?.prices?.averageSellPrice
    ?? card.tcgplayer?.prices?.normal?.market
    ?? card.tcgplayer?.prices?.holofoil?.market
    ?? null
}

function parseCardNum(str) {
  if (!str) return Infinity
  const m = str.split('/')[0].match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : Infinity
}

function capitalize(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ value, total, color, size = 90 }) {
  const pct = total > 0 ? Math.min(value / total, 1) : 0
  const cx = size / 2
  const r = size * 0.4
  const sw = size * 0.122
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const offset = circ * 0.25
  const pctFont = size * 0.133

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1e293b" strokeWidth={sw} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cx} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={pctFont} fontWeight="bold">
        {(pct * 100).toFixed(1)}%
      </text>
    </svg>
  )
}

// ── Pokémon detail view ───────────────────────────────────────────────────────
const TYPE_HERO_BG = {
  fire: '#7c2d12', water: '#1e3a5f', grass: '#14532d', electric: '#713f12',
  psychic: '#831843', ice: '#164e63', dragon: '#1e1b4b', dark: '#1c1917',
  fairy: '#831843', normal: '#374151', fighting: '#7f1d1d', flying: '#0c4a6e',
  poison: '#4a044e', ground: '#78350f', rock: '#78350f', bug: '#1a2e05',
  ghost: '#2e1065', steel: '#1e293b',
}

const DETAIL_SORT_OPTS = [
  { value: 'released', label: 'Released' },
  { value: 'number',   label: 'Number' },
  { value: 'price',    label: 'Price' },
]

const VARIANT_LABELS = [
  { key: 'normal',       label: 'Normal',    cls: 'bg-slate-600/80 text-slate-100' },
  { key: 'firstEdition', label: '1st Ed',    cls: 'bg-yellow-700/80 text-yellow-100' },
  { key: 'holo',         label: 'Holo',      cls: 'bg-blue-700/80 text-blue-100' },
  { key: 'reverse',      label: 'Rev. Holo', cls: 'bg-purple-700/80 text-purple-100' },
  { key: 'wPromo',       label: 'W Promo',   cls: 'bg-emerald-700/80 text-emerald-100' },
]


function CardImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <div className={`${className} flex items-center justify-center bg-surface-700`}>
        <svg className="w-1/2 h-1/2 text-slate-500 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="2" width="18" height="20" rx="2" strokeWidth="1.5" />
          <circle cx="12" cy="11" r="3.5" strokeWidth="1.5" />
          <path strokeLinecap="round" strokeWidth="1.5" d="M8.5 11h-2M17.5 11h-2" />
        </svg>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

function VariantBadges({ variants, className = '' }) {
  const active = variants ? VARIANT_LABELS.filter((v) => variants[v.key]) : []
  return (
    <div className={`flex flex-wrap gap-0.5 min-h-[20px] items-center ${className}`}>
      {active.map((v) => (
        <span key={v.key} className={`text-[11px] font-semibold px-1.5 py-0.5 rounded leading-none ${v.cls}`}>
          {v.label}
        </span>
      ))}
    </div>
  )
}

function PokemonDetail({ pokemon, ownedCards, onBack, onRefreshOwned, favorites, onToggleFavorite }) {
  const { format } = useCurrency()
  const navigate = useNavigate()
  const [pokemonInfo, setPokemonInfo] = useState(null)
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [sortBy, setSortBy] = useState('released')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedCard, setSelectedCard] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [filterRarity, setFilterRarity] = useState('')
  const [filterArtist, setFilterArtist] = useState('')
  const [filterSet, setFilterSet] = useState('')
  const [cardDetails, setCardDetails] = useState({})
  const [loadingCard, setLoadingCard] = useState(false)

  const isFav = !!favorites[pokemon.id]

  useEffect(() => {
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`)
      .then((r) => r.json())
      .then((data) => setPokemonInfo({
        types: data.types.map((t) => t.type.name),
        height: data.height,
      }))
      .catch(() => {})
  }, [pokemon.id])

  useEffect(() => {
    setLoadingCards(true)
    setCards([])
    const searchName = pokemon.displayName.replace(/ (Male|Female)$/, '').trim()
    const query = `name:"${searchName}*"`
    window.api
      .searchCardsAdvanced(query)
      .then((results) => {
        const lower = searchName.toLowerCase()
        const filtered = results.filter((c) => c.name.toLowerCase().includes(lower))
        setCards(filtered.length > 0 ? filtered : results)
      })
      .catch(() => setCards([]))
      .finally(() => setLoadingCards(false))
  }, [pokemon.id, pokemon.displayName])

  // Background-fetch full card details to populate rarity/illustrator filters.
  // The TCGdex list endpoint only returns id/name/image; detail endpoint has everything.
  useEffect(() => {
    if (!cards.length) { setCardDetails({}); return }
    let cancelled = false
    const CONCURRENCY = 8
    const queue = [...cards]

    async function worker() {
      while (queue.length && !cancelled) {
        const card = queue.shift()
        try {
          const results = await window.api.searchCardsAdvanced(`id:"${card.id}"`)
          if (!cancelled && results[0]) {
            const { rarity, artist, types, variants, set } = results[0]
            setCardDetails((prev) => ({ ...prev, [card.id]: { rarity, artist, types, variants, series: set?.series || '' } }))
          }
        } catch {}
      }
    }

    Promise.allSettled(Array.from({ length: Math.min(CONCURRENCY, cards.length) }, worker))
    return () => { cancelled = true }
  }, [cards])

  const variantMap = useMemo(() => {
    const groups = {}
    cards.forEach((c) => {
      const key = `${c.set?.id ?? ''}-${c.number ?? c.id}`
      if (!groups[key]) groups[key] = []
      groups[key].push(c.id)
    })
    const map = {}
    Object.values(groups).forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => { map[id] = ids.length - 1 })
    })
    return map
  }, [cards])

  const totalMarketValue = useMemo(
    () => cards.reduce((sum, c) => sum + (rawPrice(c) ?? 0), 0),
    [cards]
  )

  const uniqueRarities = useMemo(() => {
    const vals = cards.map((c) => cardDetails[c.id]?.rarity || c.rarity).filter(Boolean)
    return [...new Set(vals)].sort()
  }, [cards, cardDetails])

  const uniqueArtists = useMemo(() => {
    const vals = cards.map((c) => cardDetails[c.id]?.artist || c.artist).filter(Boolean)
    return [...new Set(vals)].sort()
  }, [cards, cardDetails])

  const uniqueSets = useMemo(() => {
    const seen = new Map()
    cards.forEach((c) => {
      if (c.set?.id && !seen.has(c.set.id)) {
        const series = c.set.series && c.set.series !== c.set.name ? c.set.series : ''
        const label = series ? `${series} - ${c.set.name || c.set.id}` : (c.set.name || c.set.id)
        seen.set(c.set.id, { id: c.set.id, label, releaseDate: c.set.releaseDate || '' })
      }
    })
    return Array.from(seen.values()).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  }, [cards])

  const visibleCards = useMemo(() => {
    let base = cards.map((c) => {
      const detail = cardDetails[c.id]
      if (!detail) return c
      const { series: enrichedSeries, ...restDetail } = detail
      return {
        ...c,
        ...restDetail,
        set: enrichedSeries ? { ...c.set, series: enrichedSeries } : c.set,
      }
    })
    if (filterRarity) base = base.filter((c) => c.rarity === filterRarity)
    if (filterArtist) base = base.filter((c) => c.artist === filterArtist)
    if (filterSet)    base = base.filter((c) => c.set?.id === filterSet)
    return [...base].sort((a, b) => {
      if (sortBy === 'released') {
        const da = a.set?.releaseDate || ''
        const db = b.set?.releaseDate || ''
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        const dateCmp = da.localeCompare(db) || parseCardNum(a.number) - parseCardNum(b.number)
        return sortDir === 'asc' ? dateCmp : -dateCmp
      }
      let cmp = 0
      if (sortBy === 'number') cmp = parseCardNum(a.number) - parseCardNum(b.number)
      else if (sortBy === 'price') cmp = (rawPrice(a) ?? -Infinity) - (rawPrice(b) ?? -Infinity)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [cards, cardDetails, sortBy, sortDir, filterRarity, filterArtist, filterSet])

  function handleSortClick(value) {
    if (sortBy === value) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(value); setSortDir('asc') }
  }

  async function handleCardClick(card) {
    setLoadingCard(true)
    setSelectedCard(card)
    try {
      const results = await window.api.searchCardsAdvanced(`id:"${card.id}"`)
      setSelectedCard(results[0] || card)
    } catch {}
    finally { setLoadingCard(false) }
  }

  async function handleRemove(card, section) {
    const owned = ownedCards.find(
      (c) => c.tcgId === card.id &&
        (section === 'collection' ? c.section === 'collection' : !c.section || c.section === 'watchlist')
    )
    if (!owned) return
    await window.api.removeCard(owned.id)
    onRefreshOwned()
  }

  function handleFilterByArtist(artistName) {
    navigate('/', { state: { tab: 'search', artistFilter: artistName } })
  }

  const dexNum = `#${String(pokemon.id).padStart(4, '0')}`
  const heightM = pokemonInfo ? `${(pokemonInfo.height / 10).toFixed(1)} m` : null
  const heightFt = pokemonInfo
    ? `${Math.floor(pokemonInfo.height / 3.048)}' ${Math.round(((pokemonInfo.height / 3.048) % 1) * 12)}"`
    : null

  const primaryType = pokemonInfo?.types?.[0] ?? ''
  const heroBg = TYPE_HERO_BG[primaryType] || '#1e293b'

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <div
        className="relative flex-shrink-0 border-b border-surface-700"
        style={{ background: `linear-gradient(to bottom, ${heroBg}99, #0f172a)` }}
      >
        {/* Back button — top right */}
        <button
          onClick={onBack}
          className="absolute top-4 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-slate-300 hover:text-white hover:border-white/30 hover:bg-white/5 text-xs font-medium transition-all z-10"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Pokédex
        </button>

        {/* Hero: sprite + name/number/types/fav */}
        <div className="flex items-end gap-5 px-6 pt-5 pb-5">
          <img
            src={animatedSprite(pokemon.id)}
            alt={pokemon.displayName}
            className="w-28 h-28 object-contain flex-shrink-0 drop-shadow-xl"
            onError={(e) => { e.target.src = officialArt(pokemon.id) }}
          />
          <div className="flex flex-col gap-2 pb-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-slate-300 text-sm font-mono">{dexNum}</span>
              {pokemonInfo?.types?.map((t) => (
                <span key={t} className={typeBadge(t)}>{t}</span>
              ))}
              <button
                onClick={() => onToggleFavorite(pokemon.id, pokemon.displayName)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium transition-all ${
                  isFav
                    ? 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300'
                    : 'border-white/20 text-slate-400 hover:text-yellow-300 hover:border-yellow-500/40'
                }`}
              >
                <span className="leading-none">{isFav ? '★' : '☆'}</span>
                {isFav ? 'Favorited' : 'Favorite'}
              </button>
            </div>
            <h1 className="text-white font-black text-4xl leading-none">{pokemon.displayName}</h1>
          </div>
        </div>

        {/* Stat strip + controls */}
        <div className="flex items-center border-t border-white/10">
          {[
            { label: 'Number',             value: dexNum },
            { label: 'Total Cards',        value: loadingCards ? '…' : cards.length.toString() },
            { label: 'Types',              value: pokemonInfo?.types?.map((t) => capitalize(t)).join(', ') ?? '—' },
            { label: 'Height',             value: pokemonInfo ? `${heightFt} / ${heightM}` : '—' },
            { label: 'Total Market Value', value: loadingCards ? '…' : format(totalMarketValue), accent: true },
          ].map((item, i) => (
            <div key={item.label} className={`flex flex-col px-5 py-3 flex-shrink-0 ${i > 0 ? 'border-l border-white/10' : ''}`}>
              <span className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">{item.label}</span>
              <span className={`text-sm font-semibold ${item.accent ? 'text-red-400' : 'text-white'}`}>
                {item.value}
              </span>
            </div>
          ))}

          {/* Right-aligned controls */}
          <div className="ml-auto flex items-center self-stretch border-l border-white/10">

            {/* Group 1: Sort (Number + Price) */}
            <div className="flex items-center gap-1.5 px-4 self-stretch">
              {DETAIL_SORT_OPTS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortClick(opt.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    sortBy === opt.value
                      ? 'bg-accent/20 border-accent/60 text-accent'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-white/10" />

            {/* Group 2: Filter dropdowns */}
            <div className="flex items-center gap-2 px-4 self-stretch">
              <select
                value={filterSet}
                onChange={(e) => setFilterSet(e.target.value)}
                className="w-40 bg-surface-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-500/60"
              >
                <option value="">Set</option>
                {uniqueSets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="w-28 bg-surface-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-500/60"
              >
                <option value="">Rarity</option>
                {uniqueRarities.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={filterArtist}
                onChange={(e) => setFilterArtist(e.target.value)}
                className="w-32 bg-surface-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-500/60"
              >
                <option value="">Illustrator</option>
                {uniqueArtists.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <button
                onClick={() => { setFilterSet(''); setFilterRarity(''); setFilterArtist('') }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
              >
                Clear
              </button>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-white/10" />

            {/* Group 3: View switcher */}
            <div className="flex items-center px-4 self-stretch">
              <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-xs">
                {[
                  { mode: 'grid', label: 'Grid', icon: (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                      <rect x="1" y="1" width="6" height="6" rx="1" />
                      <rect x="9" y="1" width="6" height="6" rx="1" />
                      <rect x="1" y="9" width="6" height="6" rx="1" />
                      <rect x="9" y="9" width="6" height="6" rx="1" />
                    </svg>
                  )},
                  { mode: 'table', label: 'Table', icon: (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                    </svg>
                  )},
                ].map((v) => (
                  <button
                    key={v.mode}
                    onClick={() => setViewMode(v.mode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${
                      viewMode === v.mode
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {v.icon}
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── CARD CONTENT ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loadingCards ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-surface-600" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" />
            </div>
            <p className="text-slate-400 text-sm">Loading cards for {pokemon.displayName}…</p>
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <p className="text-lg">No cards found</p>
          </div>
        ) : viewMode === 'grid' ? (

          /* ── Grid view ── */
          <div className="px-8 py-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-start">
            {visibleCards.map((card) => {
              const price = rawPrice(card)
              const variantCount = variantMap[card.id] || 0
              const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
              const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className="rounded-xl p-2.5 flex flex-col items-center relative transition-all bg-surface-800 border border-surface-600 hover:border-red-500/50 hover:bg-surface-700"
                >
                  {variantCount > 0 && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full z-10 leading-none">
                      +{variantCount}
                    </span>
                  )}
                  {(inPortfolio || inWatchlist) && (
                    <div className="absolute top-1.5 right-1.5 flex flex-col gap-0.5 z-10 pointer-events-none">
                      {inPortfolio && <span className="text-[11px] font-bold px-2 py-1 rounded bg-accent text-black leading-none">Collection</span>}
                      {inWatchlist && <span className="text-[11px] font-bold px-2 py-1 rounded bg-sky-500 text-white leading-none">Watchlist</span>}
                    </div>
                  )}
                  <div className="relative w-full aspect-[2.5/3.5] mb-1.5">
                    <CardImage
                      src={card.images?.small}
                      alt={card.name}
                      className="absolute inset-0 w-full h-full object-contain rounded"
                    />
                  </div>
                  <div className="flex items-baseline justify-center gap-1 w-full px-1">
                    <p className="text-white text-sm font-semibold text-center truncate leading-tight">{card.name}</p>
                    {card.number && <span className="text-slate-400 text-xs flex-shrink-0">#{card.number}</span>}
                  </div>
                  {card.set?.name && (
                    <p className="text-slate-500 text-xs text-center truncate w-full px-1 leading-tight mt-0.5">
                      {card.set.series && card.set.series !== card.set.name
                        ? `${card.set.series} - ${card.set.name}`
                        : card.set.name}
                    </p>
                  )}
                  <VariantBadges variants={card.variants} className="justify-center mt-1" />
                  {price != null && (
                    <p className="text-red-400 text-sm font-bold text-center mt-1">{format(price)}</p>
                  )}
                </button>
              )
            })}
          </div>

        ) : viewMode === 'table' ? (

          /* ── Table view ── */
          <div className="px-8 py-5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left text-slate-500 text-xs uppercase tracking-wider py-2 pr-4 font-medium">Card</th>
                  <th className="text-left text-slate-500 text-xs uppercase tracking-wider py-2 pr-4 font-medium">Series</th>
                  <th className="text-left text-slate-500 text-xs uppercase tracking-wider py-2 pr-4 font-medium">Set</th>
                  <th className="text-left text-slate-500 text-xs uppercase tracking-wider py-2 pr-4 font-medium">Rarity</th>
                  <th className="text-left text-slate-500 text-xs uppercase tracking-wider py-2 pr-4 font-medium">Illustrator</th>
                  <th className="text-right text-slate-500 text-xs uppercase tracking-wider py-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => {
                  const price = rawPrice(card)
                  const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
                  const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
                  const seriesLabel = card.set?.series && card.set.series !== card.set.name ? card.set.series : '—'
                  const setLabel = card.set?.name || '—'
                  return (
                    <tr
                      key={card.id}
                      onClick={() => handleCardClick(card)}
                      className="border-b border-surface-800 hover:bg-surface-800 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-3">
                          <CardImage src={card.images?.small} alt={card.name} className="w-16 h-[90px] object-contain rounded flex-shrink-0" />
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <p className="text-white text-base font-medium leading-tight">{card.name}</p>
                              {card.number && <span className="text-slate-500 text-sm flex-shrink-0">#{card.number}</span>}
                            </div>
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {inPortfolio && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-accent/90 text-black leading-snug">P</span>}
                              {inWatchlist && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/90 text-white leading-snug">W</span>}
                            </div>
                            <VariantBadges variants={card.variants} className="mt-1.5" />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-slate-400 text-sm max-w-[160px]">{seriesLabel}</td>
                      <td className="py-2 pr-4 text-slate-400 text-sm max-w-[160px]">{setLabel}</td>
                      <td className="py-2 pr-4 text-slate-400 text-sm">{card.rarity ?? '—'}</td>
                      <td className="py-2 pr-4 text-slate-400 text-sm">{card.artist ?? '—'}</td>
                      <td className="py-2 text-right">
                        {price != null
                          ? <span className="text-red-400 font-semibold text-sm">{format(price)}</span>
                          : <span className="text-slate-600 text-sm">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        ) : null}
      </div>

      {selectedCard && (
        <>
          <CardDetailModal
            card={selectedCard}
            ownedCards={ownedCards}
            onAdd={onRefreshOwned}
            onRemove={handleRemove}
            onClose={() => { setSelectedCard(null); setLoadingCard(false) }}
            onFilterByArtist={handleFilterByArtist}
          />
          {loadingCard && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 rounded-xl px-5 py-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
                <span className="text-white text-sm">Loading card data…</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── TCG card count fetcher (module-level cache + throttled queue) ──────────────
const tcgCountCache = {}
let tcgQueue = []
let tcgActive = 0
const TCG_MAX = 5

function drainTcgQueue() {
  while (tcgActive < TCG_MAX && tcgQueue.length > 0) {
    const { name, resolve } = tcgQueue.shift()
    if (tcgCountCache[name] !== undefined) { resolve(tcgCountCache[name]); continue }
    tcgActive++
    fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}&pagination:itemsPerPage=100`)
      .then((r) => r.json())
      .then((d) => { tcgCountCache[name] = Array.isArray(d) ? d.length : 0; resolve(tcgCountCache[name]) })
      .catch(() => { tcgCountCache[name] = null; resolve(null) })
      .finally(() => { tcgActive--; drainTcgQueue() })
  }
}

function fetchTcgCount(name) {
  if (tcgCountCache[name] !== undefined) return Promise.resolve(tcgCountCache[name])
  return new Promise((resolve) => { tcgQueue.push({ name, resolve }); drainTcgQueue() })
}

function PokemonTile({ pokemon, ownedCards, favorites, animateSprites, onSelect }) {
  const [totalCards, setTotalCards] = useState(() => tcgCountCache[pokemon.displayName] ?? null)

  const ownedCount = useMemo(() => {
    const pn = pokemon.displayName.toLowerCase()
    return ownedCards.filter((c) => {
      if (c.section !== 'collection') return false
      const cn = (c.name || '').toLowerCase()
      return cn === pn || cn.startsWith(pn + ' ') || cn.startsWith(pn + '-')
    }).length
  }, [ownedCards, pokemon.displayName])

  useEffect(() => {
    let cancelled = false
    fetchTcgCount(pokemon.displayName).then((n) => { if (!cancelled) setTotalCards(n) })
    return () => { cancelled = true }
  }, [pokemon.displayName])

  const pct = totalCards ? Math.min(100, (ownedCount / totalCards) * 100) : 0

  return (
    <button
      onClick={() => onSelect(pokemon)}
      className="relative bg-surface-800 hover:bg-surface-700 rounded-xl p-3 flex flex-col items-center gap-2 transition-all group border border-surface-600 hover:border-red-500/60"
    >
      {favorites[pokemon.id] && (
        <span className="absolute top-1.5 right-1.5 text-yellow-400 text-sm leading-none pointer-events-none">★</span>
      )}
      <div className="w-16 h-16 flex items-center justify-center">
        <img
          src={animateSprites ? animatedSprite(pokemon.id) : officialArt(pokemon.id)}
          alt={pokemon.displayName}
          className="max-w-full max-h-full object-contain"
          onError={(e) => { e.target.src = officialArt(pokemon.id) }}
        />
      </div>
      <div className="text-center">
        <p className="text-white text-xs font-semibold leading-tight group-hover:text-red-300 transition-colors">
          {pokemon.displayName}
        </p>
        <p className="text-slate-600 text-xs">#{String(pokemon.id).padStart(3, '0')}</p>
      </div>
      <div className="w-full flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-surface-600 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-slate-500 text-xs tabular-nums flex-shrink-0">{ownedCount} / {totalCards ?? '…'}</span>
      </div>
    </button>
  )
}

// ── Main Pokédex view ─────────────────────────────────────────────────────────
export default function Pokedex({ resetKey }) {
  const [activeGen, setActiveGen] = useState(0)
  const [pokemonList, setPokemonList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedPokemon, setSelectedPokemon] = useState(null)

  useEffect(() => {
    if (resetKey) setSelectedPokemon(null)
  }, [resetKey])
  const [ownedCards, setOwnedCards] = useState([])
  const [pokemonSearch, setPokemonSearch] = useState('')
  const [allPokemon, setAllPokemon] = useState([])
  const [favorites, toggleFavorite] = useFavorites()
  const [showFavs, setShowFavs] = useState(false)
  const [animateSprites, setAnimateSprites] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [typeFilterNames, setTypeFilterNames] = useState(null)
  const cache = useRef({})
  const typeCache = useRef({})

  function selectPokemon(pokemon) {
    window.history.pushState({ pokemonDetail: true }, '')
    setSelectedPokemon(pokemon)
  }

  useEffect(() => {
    if (!selectedPokemon) return
    function handlePopState() {
      setSelectedPokemon(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedPokemon])

  function handleRandom() {
    const source = allPokemon.length > 0 ? allPokemon : pokemonList
    if (!source.length) return
    selectPokemon(source[Math.floor(Math.random() * source.length)])
  }

  async function loadOwnedCards() {
    try {
      const cards = await window.api.listCards()
      setOwnedCards(cards)
    } catch {}
  }

  async function handleTypeFilter(type) {
    setTypeFilter(type)
    if (!type) { setTypeFilterNames(null); return }
    if (typeCache.current[type]) { setTypeFilterNames(typeCache.current[type]); return }
    try {
      const r = await fetch(`https://pokeapi.co/api/v2/type/${type}`)
      const data = await r.json()
      const names = new Set(data.pokemon.map((p) => p.pokemon.name))
      typeCache.current[type] = names
      setTypeFilterNames(names)
    } catch { setTypeFilterNames(null) }
  }

  useEffect(() => {
    loadOwnedCards()
  }, [])

  // Load all gens in background for search + metrics
  useEffect(() => {
    const loadAll = async () => {
      const results = await Promise.all(
        GENS.map(async (gen) => {
          if (cache.current[gen.id]) return cache.current[gen.id]
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${gen.count}&offset=${gen.offset}`)
            const data = await r.json()
            const list = data.results.map((p) => {
              const id = parseInt(p.url.split('/').filter(Boolean).pop(), 10)
              return { id, name: p.name, displayName: capitalize(p.name) }
            })
            cache.current[gen.id] = list
            return list
          } catch {
            return []
          }
        })
      )
      setAllPokemon(results.flat().sort((a, b) => a.id - b.id))
    }
    loadAll()
  }, [])

  // Load active gen for the grid
  useEffect(() => {
    const gen = GENS.find((g) => g.id === activeGen)
    if (!gen) return
    if (cache.current[activeGen]) {
      setPokemonList(cache.current[activeGen])
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    setPokemonList([])
    fetch(`https://pokeapi.co/api/v2/pokemon?limit=${gen.count}&offset=${gen.offset}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.results.map((p) => {
          const id = parseInt(p.url.split('/').filter(Boolean).pop(), 10)
          return { id, name: p.name, displayName: capitalize(p.name) }
        })
        cache.current[activeGen] = list
        setPokemonList(list)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [activeGen])

  // Metrics: collected = has ≥1 card, mastered = has ≥10 unique cards
  const metrics = useMemo(() => {
    if (!allPokemon.length) return { collected: 0, mastered: 0 }
    const counts = {}
    allPokemon.forEach((p) => {
      const pn = p.displayName.toLowerCase()
      const n = ownedCards.filter((c) => {
        const cn = (c.name || '').toLowerCase()
        return cn === pn || cn.startsWith(pn + ' ') || cn.startsWith(pn + '-')
      }).length
      if (n > 0) counts[p.id] = n
    })
    return {
      collected: Object.keys(counts).length,
      mastered:  Object.values(counts).filter((n) => n >= 10).length,
    }
  }, [allPokemon, ownedCards])

  // Keep account stats in sync — save collected count to settings whenever it changes
  useEffect(() => {
    if (!allPokemon.length) return
    window.api.setSettings({ pokemonCollected: metrics.collected }).catch(() => {})
  }, [metrics.collected, allPokemon.length])

  // Search across all cached Pokémon
  const searchResults = useMemo(() => {
    const q = pokemonSearch.trim().toLowerCase()
    if (!q) return null
    const source = allPokemon.length > 0 ? allPokemon : pokemonList
    return source
      .filter((p) => p.name.includes(q) || p.displayName.toLowerCase().includes(q))
      .slice(0, 60)
  }, [pokemonSearch, allPokemon, pokemonList])

  const displayList = useMemo(() => {
    let list = searchResults ?? (activeGen === 0 ? allPokemon : pokemonList)
    if (typeFilterNames) list = list.filter((p) => typeFilterNames.has(p.name))
    if (showFavs) list = list.filter((p) => !!favorites[p.id])
    return list
  }, [searchResults, activeGen, allPokemon, pokemonList, typeFilterNames, showFavs, favorites])

  if (selectedPokemon) {
    return (
      <PokemonDetail
        pokemon={selectedPokemon}
        ownedCards={ownedCards}
        onBack={() => window.history.back()}
        onRefreshOwned={loadOwnedCards}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Unified banner */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-surface-700 bg-surface-900">
        <div className="flex items-center gap-3">

          {/* Metrics — left */}
          <div className="flex items-center gap-4 pr-4 border-r border-surface-700 flex-shrink-0">
            {/* Collected row */}
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-xs uppercase tracking-wider w-[72px] flex-shrink-0">Collected</span>
              <span className="text-white font-bold text-sm leading-none flex-shrink-0">
                {metrics.collected}
                <span className="text-slate-500 font-normal text-xs ml-1">/ {TOTAL_POKEMON.toLocaleString()}</span>
              </span>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden w-28 flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(metrics.collected / TOTAL_POKEMON) * 100}%`, backgroundColor: '#ef4444' }}
                />
              </div>
              <DonutChart value={metrics.collected} total={TOTAL_POKEMON} color="#ef4444" size={72} />
            </div>

            {/* Mastered row */}
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-xs uppercase tracking-wider w-[72px] flex-shrink-0">Mastered</span>
              <span className="text-white font-bold text-sm leading-none flex-shrink-0">
                {metrics.mastered}
                <span className="text-slate-500 font-normal text-xs ml-1">/ {TOTAL_POKEMON.toLocaleString()}</span>
              </span>
              <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden w-28 flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(metrics.mastered / TOTAL_POKEMON) * 100}%`, backgroundColor: '#f97316' }}
                />
              </div>
              <DonutChart value={metrics.mastered} total={TOTAL_POKEMON} color="#f97316" size={72} />
            </div>
          </div>

          {/* Search + Random — grows to fill available space */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={pokemonSearch}
                onChange={(e) => setPokemonSearch(e.target.value)}
                placeholder="Search Pokédex"
                className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60"
              />
              {pokemonSearch && (
                <button
                  onClick={() => setPokemonSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-lg leading-none"
                >×</button>
              )}
            </div>
            <button
              onClick={handleRandom}
              className="px-4 py-2.5 rounded-xl bg-surface-800 border border-surface-600 text-slate-300 text-sm font-semibold hover:bg-red-900/30 hover:border-red-500/50 hover:text-red-400 transition-all flex-shrink-0"
            >
              Random
            </button>
          </div>

          {/* Right-aligned controls */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* Generation dropdown */}
            <select
              value={activeGen}
              onChange={(e) => { setActiveGen(parseInt(e.target.value, 10)); setPokemonSearch('') }}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-red-500/60"
            >
              <option value={0}>All Generations</option>
              {GENS.map((gen) => (
                <option key={gen.id} value={gen.id}>{gen.label}</option>
              ))}
            </select>

            {/* Type dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilter(e.target.value)}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-red-500/60"
            >
              <option value="">All Types</option>
              {ALL_TYPES.map((type) => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>

            {/* Animated toggle */}
            <button
              onClick={() => setAnimateSprites((v) => !v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                animateSprites
                  ? 'bg-red-900/30 border-red-500 text-red-400'
                  : 'border-surface-600 text-slate-400 hover:text-white hover:border-surface-500'
              }`}
            >
              Animated
            </button>

            {/* Favorites toggle */}
            <button
              onClick={() => setShowFavs((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${
                showFavs
                  ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300'
                  : 'border-yellow-500/40 text-yellow-500/70 hover:border-yellow-400 hover:text-yellow-300'
              }`}
            >
              <span className="leading-none">★</span>
              Favorites
            </button>
          </div>

        </div>
      </div>

      {/* Pokémon grid */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {loading && !searchResults && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-surface-600" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin" />
            </div>
            <p className="text-slate-400 text-sm">Loading Pokémon…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <p className="text-lg mb-1">Could not load Pokémon</p>
            <p className="text-sm">Check your internet connection</p>
            <button
              onClick={() => { cache.current = {}; setActiveGen((g) => g) }}
              className="mt-4 px-4 py-2 bg-red-900/30 border border-red-500/40 text-red-400 text-sm rounded-lg hover:bg-red-900/50 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {searchResults !== null && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <p className="text-lg">No Pokémon found</p>
            <p className="text-sm mt-1">Try a different name</p>
          </div>
        )}

        {(!loading || searchResults) && !error && displayList.length > 0 && (
          <>
            {searchResults && (
              <p className="text-slate-500 text-sm mb-4">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{pokemonSearch}"
              </p>
            )}
            {activeGen === 0 && !searchResults ? (
              GENS.map((gen) => {
                const genPokemon = displayList.filter((p) => p.id > gen.offset && p.id <= gen.offset + gen.count)
                if (genPokemon.length === 0) return null
                return (
                  <div key={gen.id} className="mb-6">
                    <div className="flex items-center gap-4 mt-2 mb-4">
                      <div className="flex-1 h-px bg-surface-700" />
                      <div className="flex items-center gap-2.5 px-5 py-2 rounded-lg bg-red-900/20 border border-red-500/40 flex-shrink-0">
                        <span className="text-red-400 font-bold text-base">{gen.label}</span>
                        <span className="text-white text-sm">· {gen.count} Pokémon</span>
                      </div>
                      <div className="flex-1 h-px bg-surface-700" />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                      {genPokemon.map((pokemon) => (
                        <PokemonTile
                          key={pokemon.id}
                          pokemon={pokemon}
                          ownedCards={ownedCards}
                          favorites={favorites}
                          animateSprites={animateSprites}
                          onSelect={selectPokemon}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              <>
                {!searchResults && (() => {
                  const gen = GENS.find((g) => g.id === activeGen)
                  return gen ? (
                    <div className="flex items-center gap-4 mt-2 mb-4">
                      <div className="flex-1 h-px bg-surface-700" />
                      <div className="flex items-center gap-2.5 px-5 py-2 rounded-lg bg-red-900/20 border border-red-500/40 flex-shrink-0">
                        <span className="text-red-400 font-bold text-base">{gen.label}</span>
                        <span className="text-white text-sm">· {gen.count} Pokémon</span>
                      </div>
                      <div className="flex-1 h-px bg-surface-700" />
                    </div>
                  ) : null
                })()}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                  {displayList.map((pokemon) => (
                    <PokemonTile
                      key={pokemon.id}
                      pokemon={pokemon}
                      ownedCards={ownedCards}
                      favorites={favorites}
                      animateSprites={animateSprites}
                      onSelect={selectPokemon}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
