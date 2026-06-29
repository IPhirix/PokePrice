import axios from 'axios'
import type { TcgCard } from '@pokeprice/types'

const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en'

let _setCache: Map<string, { name: string; series: string; releaseDate: string }> | null = null
let _setCacheTime = 0

function seriesFromSetId(id: string): string {
  if (!id) return ''
  if (id.startsWith('sv'))    return 'Scarlet & Violet'
  if (id.startsWith('swsh'))  return 'Sword & Shield'
  if (id.startsWith('sm'))    return 'Sun & Moon'
  if (id.startsWith('xy'))    return 'XY'
  if (id.startsWith('bw'))    return 'Black & White'
  if (id.startsWith('hgss'))  return 'HeartGold & SoulSilver'
  if (id.startsWith('dp'))    return 'Diamond & Pearl'
  if (id.startsWith('me'))    return 'Mega Evolution'
  if (id.startsWith('ecard')) return 'E-Card'
  if (id.startsWith('ex'))    return 'EX'
  if (id.startsWith('pop'))   return 'POP'
  if (id.startsWith('neo'))   return 'Neo'
  if (id.startsWith('gym'))   return 'Gym'
  if (id.startsWith('base'))  return 'Base'
  if (id.startsWith('col'))   return 'Call of Legends'
  if (id.startsWith('pl'))    return 'Platinum'
  return ''
}

function extractSetId(cardId: string, localId: string): string {
  if (!cardId) return ''
  if (localId && cardId.endsWith('-' + localId)) return cardId.slice(0, cardId.length - localId.length - 1)
  const last = cardId.lastIndexOf('-')
  return last > 0 ? cardId.slice(0, last) : ''
}

function isPocketCard(card: { set?: { id?: string; series?: string }; setId?: string }): boolean {
  const series = (card.set?.series || '').toLowerCase()
  if (series.includes('pocket')) return true
  const setId = card.set?.id || card.setId || ''
  return /^([A-Z]\d|P-[A-Z])/i.test(setId)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTcgdexCard(d: any): TcgCard {
  const image = d.image || ''
  const localId = d.localId != null ? String(d.localId) : ''
  const setId = d.set?.id || extractSetId(d.id, localId)
  return {
    id: d.id,
    name: d.name || '',
    image: image ? `${image}/low.webp` : null,
    localId,
    set: {
      id: setId,
      name: d.set?.name || '',
      logo: d.set?.logo || null,
    },
    rarity: d.rarity || null,
    types: d.types || null,
    variants: d.variants || null,
  }
}

export async function getSetMap(): Promise<Map<string, { name: string; series: string; releaseDate: string }>> {
  if (_setCache && Date.now() - _setCacheTime < 3_600_000) return _setCache
  const res = await axios.get(`${TCGDEX_BASE}/sets`, { timeout: 15_000 })
  _setCache = new Map(
    (res.data || []).map((s: { id: string; name: string; serie?: { name: string }; releaseDate?: string }) => [
      s.id,
      { name: s.name, series: s.serie?.name || seriesFromSetId(s.id), releaseDate: s.releaseDate || '' },
    ])
  )
  _setCacheTime = Date.now()
  return _setCache
}

export async function searchCards(query: string): Promise<TcgCard[]> {
  const params: Record<string, string | number> = {}
  if (/^\d+\/\d+$/.test(query)) {
    params['eq:localId'] = query.split('/')[0]
  } else if (/^[a-z]{2,6}\d*-\d+$/i.test(query)) {
    params['eq:localId'] = query.split('-').pop()!
  } else {
    params.name = query
    params['sort:field'] = 'releaseDate'
    params['sort:order'] = 'DESC'
  }
  params['pagination:itemsPerPage'] = 30

  const [res, setMap] = await Promise.all([
    axios.get(`${TCGDEX_BASE}/cards`, { params, timeout: 15_000 }),
    getSetMap().catch(() => new Map<string, { name: string; series: string; releaseDate: string }>()),
  ])

  return (res.data || [])
    .map((card: { id: string; localId?: string | number; [key: string]: unknown }) => {
      const localId = card.localId != null ? String(card.localId) : ''
      const setId = extractSetId(card.id, localId)
      const setData = setMap.get(setId) || { name: '', series: '', releaseDate: '' }
      return mapTcgdexCard({ ...card, set: { id: setId, name: setData.name, series: setData.series, releaseDate: setData.releaseDate } })
    })
    .filter((c: TcgCard & { set?: { series?: string; id?: string } }) => !isPocketCard(c))
}

export async function getCard(cardId: string): Promise<TcgCard | null> {
  try {
    const res = await axios.get(`${TCGDEX_BASE}/cards/${cardId}`, { timeout: 15_000 })
    return mapTcgdexCard(res.data)
  } catch {
    return null
  }
}

export async function getSets(): Promise<{ id: string; name: string; series: string; releaseDate: string }[]> {
  const map = await getSetMap()
  return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }))
}

export interface AdvancedSearchParams {
  name?: string
  setName?: string
  setId?: string
  rarity?: string
}

/**
 * Search cards with optional name, set, and rarity filters.
 * Accepts set name (e.g. "Crown Zenith") and resolves it to a set ID
 * before querying TCGdex — matching the Rust backend behaviour.
 */
export async function searchCardsAdvanced(params: AdvancedSearchParams): Promise<TcgCard[]> {
  const { name = '', setName, setId, rarity } = params
  if (!name && !setName && !setId && !rarity) return []

  const sets = await getSetMap()

  const resolvedSetId = setId
    ?? (setName
      ? Array.from(sets.entries()).find(
          ([, data]) => data.name.toLowerCase() === setName.toLowerCase()
        )?.[0]
      : undefined)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryParams: Record<string, any> = { 'pagination:itemsPerPage': 60 }
  if (name) {
    queryParams.name = name
    queryParams['sort:field'] = 'releaseDate'
    queryParams['sort:order'] = 'DESC'
  }
  if (rarity) queryParams.rarity = rarity
  if (resolvedSetId) queryParams.set = resolvedSetId

  const res = await axios.get(`${TCGDEX_BASE}/cards`, { params: queryParams, timeout: 15_000 })

  return ((res.data || []) as { id: string; localId?: string | number; [key: string]: unknown }[])
    .map((card) => {
      const localId = card.localId != null ? String(card.localId) : ''
      const sId = extractSetId(card.id, localId)
      const setData = sets.get(sId) || { name: '', series: '', releaseDate: '' }
      return mapTcgdexCard({ ...card, set: { id: sId, name: setData.name, series: setData.series } })
    })
    .filter((c: TcgCard & { set?: { series?: string; id?: string } }) => !isPocketCard(c))
}
