import axios from 'axios'

export interface LatLon { lat: number; lon: number }

// Rate-limited Nominatim queue — enforces ≥1.5 s between requests (ToS)
let _lastCall = 0
let _busy = false
const _queue: Array<{ city: string; resolve: (r: LatLon | null) => void }> = []

async function drain() {
  if (_busy) return
  _busy = true
  while (_queue.length > 0) {
    const task = _queue.shift()!
    const wait = Math.max(0, 1500 - (Date.now() - _lastCall))
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    _lastCall = Date.now()

    let result: LatLon | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const q = task.city.split(',').map(s => s.trim()).join(', ') + ', USA'
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'json', limit: 1, countrycodes: 'us' },
          headers: { 'User-Agent': 'PokePrice/1.0 (pokeprice-card-shows)' },
          timeout: 10_000,
        })
        const hit = res.data?.[0]
        if (hit) result = { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) }
        break
      } catch (e: unknown) {
        const err = e as { response?: { status?: number; headers?: Record<string, string> }; message: string }
        if (err.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers?.['retry-after'] || '10')
          await new Promise(r => setTimeout(r, (retryAfter + 2) * 1000))
          _lastCall = Date.now()
        } else {
          console.warn('[geocode] Nominatim error:', err.message)
          break
        }
      }
    }
    task.resolve(result)
  }
  _busy = false
}

export function geocodeCity(city: string): Promise<LatLon | null> {
  return new Promise(resolve => {
    _queue.push({ city, resolve })
    drain()
  })
}

export async function geocodeZip(zip: string): Promise<LatLon | null> {
  if (!/^\d{5}$/.test(zip)) return null
  try {
    const res = await axios.get(`https://api.zippopotam.us/us/${zip}`, { timeout: 8_000 })
    const place = res.data?.places?.[0]
    if (!place) return null
    return { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) }
  } catch {
    return null
  }
}

export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const chord = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord))
}
