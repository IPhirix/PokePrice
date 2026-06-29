'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/react'

const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

interface Show {
  name: string
  date: string
  location: string
  url?: string
}

export default function CardShowsClient() {
  const [stateCode, setStateCode] = useState('CA')

  const { data, isLoading, error } = trpc.cardShows.getByState.useQuery(
    { stateCode },
    { staleTime: 60 * 60 * 1000 }
  )

  const shows: Show[] = Array.isArray(data?.shows) ? (data.shows as Show[]) : []

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Card Shows</h1>
        <p className="text-slate-400 text-sm">Browse upcoming Pokemon card show events by state.</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400 flex-shrink-0">State:</label>
        <select
          value={stateCode}
          onChange={e => setStateCode(e.target.value)}
          className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
        >
          {US_STATES.map(s => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        {data?.stale && (
          <span className="text-xs text-amber-400 ml-1">Showing cached data (may be outdated)</span>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error.message}</p>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-800 border border-surface-700 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !data?.cached && (
        <div className="text-center py-16 bg-surface-800 border border-surface-600 rounded-xl">
          <p className="text-slate-400 text-sm">No cached data for {stateCode}.</p>
          <p className="text-slate-600 text-xs mt-1">
            Open the desktop app to scrape shows for this state.
          </p>
        </div>
      )}

      {!isLoading && data?.cached && shows.length === 0 && (
        <div className="text-center py-16 bg-surface-800 border border-surface-600 rounded-xl">
          <p className="text-slate-400 text-sm">No upcoming shows found for {stateCode}.</p>
        </div>
      )}

      {shows.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{shows.length} show{shows.length !== 1 ? 's' : ''}</p>
          {shows.map((show, i) => (
            <div key={i} className="bg-surface-800 border border-surface-700 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {show.url ? (
                      <a href={show.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                        {show.name}
                      </a>
                    ) : show.name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">{show.location}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-accent text-sm font-medium">{show.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
