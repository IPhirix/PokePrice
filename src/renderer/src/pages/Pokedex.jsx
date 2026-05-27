import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { CardDetailModal } from './SearchPage'

// ── Favorites (localStorage) ─────────────────────────────────────────────────
const FAV_KEY = 'pokeprice-favorites'
function getFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '{}') } catch { return {} } }
function saveFavStorage(f) { localStorage.setItem(FAV_KEY, JSON.stringify(f)); window.dispatchEvent(new Event('pokeprice-favs')) }
function useFavorites() {
  const [favs, setFavsState] = useState(getFavs)
  useEffect(() => {
    const update = () => setFavsState(getFavs())
    window.addEventListener('pokeprice-favs', update)
    return () => window.removeEventListener('pokeprice-favs', update)
  }, [])
  function toggle(id, displayName) {
    const f = getFavs()
    if (f[id]) delete f[id]; else f[id] = displayName
    saveFavStorage(f)
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

const STAT_ABBR = {
  'hp': 'HP', 'attack': 'Atk', 'defense': 'Def',
  'special-attack': 'SpA', 'special-defense': 'SpD', 'speed': 'Spe',
}

function statColor(val) {
  if (val >= 100) return '#34d399'
  if (val >= 60)  return '#f59e0b'
  return '#f87171'
}

const SORT_OPTS = [
  { value: 'number',     label: 'Number' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'rarity',     label: 'Rarity' },
  { value: 'artist',     label: 'Artist' },
  { value: 'released',   label: 'Released' },
]

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ value, total, color }) {
  const pct = total > 0 ? Math.min(value / total, 1) : 0
  const r = 36
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const offset = circ * 0.25

  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="flex-shrink-0">
      <circle cx="45" cy="45" r={r} fill="none" stroke="#1e293b" strokeWidth="11" />
      <circle
        cx="45" cy="45" r={r} fill="none"
        stroke={color} strokeWidth="11"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="45" y="41" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="12" fontWeight="bold">
        {(pct * 100).toFixed(1)}%
      </text>
      <text x="45" y="53" textAnchor="middle" dominantBaseline="middle"
        fill="#64748b" fontSize="9">
        {value}/{total}
      </text>
    </svg>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, total, color, subtext }) {
  const pct = total > 0 ? value / total : 0
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 text-xs uppercase tracking-wider mb-1.5">{label}</p>
        <p className="text-white font-bold text-2xl leading-none mb-0.5">
          {value}
          <span className="text-slate-500 font-normal text-sm ml-1.5">of {total.toLocaleString()}</span>
        </p>
        {subtext && <p className="text-slate-600 text-xs mb-2.5">{subtext}</p>}
        {!subtext && <div className="mb-2.5" />}
        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct * 100}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <DonutChart value={value} total={total} color={color} />
    </div>
  )
}

// ── Pokémon detail view ───────────────────────────────────────────────────────
function PokemonDetail({ pokemon, ownedCards, onBack, onRefreshOwned, favorites, onToggleFavorite }) {
  const { format } = useCurrency()
  const navigate = useNavigate()
  const [pokemonInfo, setPokemonInfo] = useState(null)
  const [cards, setCards] = useState([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [sortBy, setSortBy] = useState('released')
  const [filterRarity, setFilterRarity] = useState('')
  const [filterSet, setFilterSet] = useState('')
  const [selectedCard, setSelectedCard] = useState(null)

  const [filterSections, setFilterSections] = useState(new Set())

  const isFav = !!favorites[pokemon.id]
  const collectedCount = useMemo(() => {
    const pn = pokemon.displayName.toLowerCase()
    return ownedCards.filter((c) => {
      if (c.section !== 'collection') return false
      const cn = (c.name || '').toLowerCase()
      return cn === pn || cn.startsWith(pn + ' ') || cn.startsWith(pn + '-')
    }).length
  }, [ownedCards, pokemon.displayName])

  useEffect(() => {
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`)
      .then((r) => r.json())
      .then((data) =>
        setPokemonInfo({
          types: data.types.map((t) => t.type.name),
          height: data.height,
          weight: data.weight,
          stats: data.stats.map((s) => ({ name: s.stat.name, base: s.base_stat })),
          abilities: data.abilities.map((a) => ({ name: capitalize(a.ability.name), hidden: a.is_hidden })),
        })
      )
      .catch(() => {})
  }, [pokemon.id])

  useEffect(() => {
    setLoadingCards(true)
    setCards([])
    setFilterSet('')
    setFilterRarity('')
    const query = `name:"${pokemon.displayName}*"`
    window.api
      .searchCardsAdvanced(query)
      .then((results) => {
        const lower = pokemon.displayName.toLowerCase()
        const filtered = results.filter((c) => c.name.toLowerCase().startsWith(lower))
        setCards(filtered.length > 0 ? filtered : results)
      })
      .catch(() => setCards([]))
      .finally(() => setLoadingCards(false))
  }, [pokemon.id, pokemon.displayName])

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

  const uniqueRarities = useMemo(() => {
    const s = new Set(cards.map((c) => c.rarity).filter(Boolean))
    return Array.from(s).sort()
  }, [cards])

  const uniqueSets = useMemo(() => {
    const seen = new Map()
    cards.forEach((c) => {
      if (c.set?.id && !seen.has(c.set.id)) {
        seen.set(c.set.id, { id: c.set.id, name: c.set.name || c.set.id, releaseDate: c.set.releaseDate || '' })
      }
    })
    return Array.from(seen.values()).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  }, [cards])

  const visibleCards = useMemo(() => {
    let base = cards
    if (filterRarity) base = base.filter((c) => c.rarity === filterRarity)
    if (filterSet)    base = base.filter((c) => c.set?.id === filterSet)
    if (filterSections.size > 0) {
      const sectionOwned = new Set(
        ownedCards
          .filter((oc) => {
            const sec = oc.section === 'collection' ? 'collection' : 'watchlist'
            return filterSections.has(sec)
          })
          .map((oc) => oc.tcgId)
      )
      base = base.filter((c) => sectionOwned.has(c.id))
    }
    return [...base].sort((a, b) => {
      if (sortBy === 'number')     return parseCardNum(a.number) - parseCardNum(b.number)
      if (sortBy === 'price_desc') return (rawPrice(b) ?? -Infinity) - (rawPrice(a) ?? -Infinity)
      if (sortBy === 'price_asc')  return (rawPrice(a) ?? Infinity) - (rawPrice(b) ?? Infinity)
      if (sortBy === 'rarity')     return (a.rarity || '').localeCompare(b.rarity || '')
      if (sortBy === 'artist')     return (a.artist || '').localeCompare(b.artist || '')
      if (sortBy === 'released')   return (a.set?.releaseDate || '').localeCompare(b.set?.releaseDate || '')
      return 0
    })
  }, [cards, sortBy, filterRarity, filterSet, filterSections, ownedCards])

  const totalMarketValue = useMemo(
    () => cards.reduce((sum, c) => sum + (rawPrice(c) ?? 0), 0),
    [cards]
  )

  async function handleRemove(card, section) {
    const owned = ownedCards.find(
      (c) =>
        c.tcgId === card.id &&
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-700 bg-surface-900">
        {/* Breadcrumb */}
        <div className="px-6 pt-2.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-slate-500 hover:text-white text-xs transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Pokédex
          </button>
        </div>

        {/* Main band */}
        <div className="flex items-stretch gap-0 px-6 pb-4 pt-2">

          {/* ── LEFT: sprite + stacked info ── */}
          <div className="flex items-start gap-4 pr-6 border-r border-surface-700 flex-shrink-0">
            <img
              src={animatedSprite(pokemon.id)}
              alt={pokemon.displayName}
              className="w-20 h-20 object-contain flex-shrink-0 mt-1"
              onError={(e) => { e.target.src = officialArt(pokemon.id) }}
            />
            <div className="flex flex-col gap-2 min-w-[160px]">
              {/* Name + dex + fav */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-2xl leading-none">{pokemon.displayName}</h1>
                <span className="text-slate-500 text-xs font-mono">{dexNum}</span>
                <button
                  onClick={() => onToggleFavorite(pokemon.id, pokemon.displayName)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium transition-all ${
                    isFav
                      ? 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300'
                      : 'border-surface-600 text-slate-500 hover:text-yellow-300 hover:border-yellow-500/40'
                  }`}
                >
                  <span className="leading-none">{isFav ? '★' : '☆'}</span>
                  {isFav ? 'Favorited' : 'Favorite'}
                </button>
              </div>

              {/* Height + type badges */}
              <div>
                <p className="text-slate-600 text-xs uppercase tracking-wider mb-0.5">Height</p>
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">
                    {pokemonInfo ? `${heightFt} / ${heightM}` : '—'}
                  </span>
                  <div className="flex gap-1">
                    {pokemonInfo?.types?.map((t) => (
                      <span key={t} className={typeBadge(t)}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cards collected + Market value */}
              <div className="flex gap-5">
                <div>
                  <p className="text-slate-600 text-xs uppercase tracking-wider mb-0.5">Cards Collected</p>
                  <p className={`text-sm font-semibold ${collectedCount > 0 ? 'text-red-400' : 'text-white'}`}>
                    {loadingCards ? '…' : `${collectedCount} / ${cards.length}`}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 text-xs uppercase tracking-wider mb-0.5">Market Value</p>
                  <p className="text-red-400 text-sm font-semibold">
                    {loadingCards ? '…' : format(totalMarketValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER: abilities + 2-col stats ── */}
          <div className="flex flex-col gap-2.5 px-6 border-r border-surface-700 flex-1 min-w-0 justify-center">
            {/* Abilities */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-600 text-xs uppercase tracking-wider flex-shrink-0">Abilities</span>
              {pokemonInfo?.abilities?.map((a) => (
                <span
                  key={a.name}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.hidden
                      ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                      : 'bg-surface-700 text-slate-300'
                  }`}
                  title={a.hidden ? 'Hidden ability' : ''}
                >
                  {a.name}
                </span>
              )) ?? <span className="text-slate-600 text-xs">—</span>}
            </div>

            {/* 2-column stat bars */}
            {pokemonInfo?.stats ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {pokemonInfo.stats.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs w-7 text-right flex-shrink-0">{STAT_ABBR[s.name] ?? s.name}</span>
                    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((s.base / 255) * 100, 100)}%`, backgroundColor: statColor(s.base) }}
                      />
                    </div>
                    <span className="text-slate-400 text-xs font-mono w-6 text-right flex-shrink-0">{s.base}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600 text-xs">Loading…</p>
            )}
          </div>

          {/* ── RIGHT: controls ── */}
          <div className="flex flex-col gap-3 pl-6 flex-shrink-0 justify-center">
            {/* Section toggle */}
            <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-surface-600 text-xs self-start">
              <button
                onClick={() => setFilterSections(new Set())}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filterSections.size === 0 ? 'bg-red-900/40 text-red-400' : 'text-slate-400 hover:text-white hover:bg-surface-700'
                }`}
              >All</button>
              {['collection', 'watchlist'].map((val) => (
                <button
                  key={val}
                  onClick={() => setFilterSections((prev) => {
                    const next = new Set(prev)
                    if (next.has(val)) next.delete(val); else next.add(val)
                    return next
                  })}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    filterSections.has(val) ? 'bg-red-900/40 text-red-400' : 'text-slate-400 hover:text-white hover:bg-surface-700'
                  }`}
                >{val === 'collection' ? 'Collection' : 'Watchlist'}</button>
              ))}
            </div>

            {/* Sort + Set */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 text-xs">Sort</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-400"
                >
                  {SORT_OPTS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              {uniqueSets.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <label className="text-slate-500 text-xs">Set</label>
                  <select
                    value={filterSet}
                    onChange={(e) => setFilterSet(e.target.value)}
                    className="bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-400"
                  >
                    <option value="">All</option>
                    {uniqueSets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Rarity */}
            {uniqueRarities.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 text-xs">Rarity</label>
                <select
                  value={filterRarity}
                  onChange={(e) => setFilterRarity(e.target.value)}
                  className="bg-surface-800 border border-surface-600 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-red-400"
                >
                  <option value="">All</option>
                  {uniqueRarities.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {visibleCards.map((card) => {
              const price = rawPrice(card)
              const variantCount = variantMap[card.id] || 0
              const inPortfolio = ownedCards.some((c) => c.tcgId === card.id && c.section === 'collection')
              const inWatchlist = ownedCards.some((c) => c.tcgId === card.id && (!c.section || c.section === 'watchlist'))
              return (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className={`bg-surface-800 rounded-xl p-2.5 flex flex-col items-center relative transition-all ${
                    inPortfolio || inWatchlist
                      ? 'border-2 border-emerald-500/60 hover:border-emerald-400/80'
                      : 'border border-surface-600 hover:border-red-500/50 hover:bg-surface-700'
                  }`}
                >
                  {variantCount > 0 && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full z-10 leading-none">
                      +{variantCount}
                    </span>
                  )}
                  {(inPortfolio || inWatchlist) && (
                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                      {inPortfolio && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-accent/90 text-black leading-none">P</span>
                      )}
                      {inWatchlist && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/90 text-white leading-none">W</span>
                      )}
                    </div>
                  )}
                  <div className="w-full flex justify-center h-36 items-center mb-2">
                    <img
                      src={card.images?.small}
                      alt={card.name}
                      className="max-h-full object-contain rounded"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                  </div>
                  <div className="w-full flex items-baseline justify-center gap-1.5 px-1">
                    <p className="text-white text-xs font-semibold text-center truncate leading-tight">{card.name}</p>
                    {card.number && (
                      <p className="text-slate-500 text-xs flex-shrink-0">#{card.number}</p>
                    )}
                  </div>
                  {card.set?.name && (
                    <p className="text-slate-400 text-xs text-center truncate leading-tight mt-0.5 w-full px-1" title={card.set.name}>
                      {card.set.name}
                    </p>
                  )}
                  {price != null && (
                    <p className="text-red-400 text-xs font-bold text-center mt-1">{format(price)}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          ownedCards={ownedCards}
          onAdd={onRefreshOwned}
          onRemove={handleRemove}
          onClose={() => setSelectedCard(null)}
          onFilterByArtist={handleFilterByArtist}
        />
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
    fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}&pageSize=1&select=id`)
      .then((r) => r.json())
      .then((d) => { tcgCountCache[name] = d.totalCount ?? 0; resolve(tcgCountCache[name]) })
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
export default function Pokedex() {
  const [activeGen, setActiveGen] = useState(1)
  const [pokemonList, setPokemonList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [selectedPokemon, setSelectedPokemon] = useState(null)
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
      {/* Top bar: gen buttons + favorites + search + type filter — all one row */}
      <div className="flex-shrink-0 px-8 py-4 border-b border-surface-700">
        <div className="flex items-center gap-2 flex-wrap">
          {/* All Gen button */}
          <button
            onClick={() => { setActiveGen(0); setPokemonSearch('') }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              activeGen === 0 && !pokemonSearch
                ? 'bg-red-900/30 border-red-500 text-red-400'
                : 'border-surface-600 text-slate-400 hover:text-white hover:border-surface-500'
            }`}
          >
            All
          </button>

          {/* Gen buttons */}
          {GENS.map((gen) => (
            <button
              key={gen.id}
              onClick={() => { setActiveGen(gen.id); setPokemonSearch('') }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                activeGen === gen.id && !pokemonSearch
                  ? 'bg-red-900/30 border-red-500 text-red-400'
                  : 'border-surface-600 text-slate-400 hover:text-white hover:border-surface-500'
              }`}
            >
              {gen.label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-6 bg-surface-600 mx-2 flex-shrink-0" />

          {/* Search */}
          <div className="relative flex-shrink-0 w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={pokemonSearch}
              onChange={(e) => setPokemonSearch(e.target.value)}
              placeholder="Search Pokédex"
              className="w-full bg-surface-800 border border-surface-600 rounded-xl pl-9 pr-8 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60"
            />
            {pokemonSearch && (
              <button
                onClick={() => setPokemonSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors text-lg leading-none"
              >×</button>
            )}
          </div>

          {/* Type filter dropdown */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
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
            {typeFilter && (
              <button
                onClick={() => handleTypeFilter('')}
                className="text-slate-500 hover:text-white text-sm transition-colors"
                title="Clear type filter"
              >✕</button>
            )}
          </div>

          {/* Animate toggle */}
          <button
            onClick={() => setAnimateSprites((v) => !v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all flex-shrink-0 ${
              animateSprites
                ? 'bg-red-900/30 border-red-500 text-red-400'
                : 'border-surface-600 text-slate-400 hover:text-white hover:border-surface-500'
            }`}
          >
            Animated
          </button>

          {/* Favorites toggle — far right */}
          <button
            onClick={() => setShowFavs((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex-shrink-0 ml-2 ${
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

      {/* Metrics panel — two independent cards */}
      <div className="flex-shrink-0 px-8 py-4">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Pokémon Collected"
            value={metrics.collected}
            total={TOTAL_POKEMON}
            color="#ef4444"
          />
          <MetricCard
            label="Pokémon Mastered"
            value={metrics.mastered}
            total={TOTAL_POKEMON}
            color="#f97316"
            subtext="10+ unique cards owned"
          />
        </div>
      </div>

      <div className="flex-shrink-0 mx-8 border-b border-surface-700" />

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
                  <div key={gen.id}>
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-surface-700" />
                      <span className="text-slate-500 text-sm font-medium px-1 flex-shrink-0">{gen.label} <span className="text-slate-600">({gen.count} Pokémon)</span></span>
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
