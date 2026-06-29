import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import type { CardShowsCacheRow } from '@pokeprice/types'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export const cardShowsRouter = router({
  getByState: publicProcedure
    .input(z.object({ stateCode: z.string().length(2) }))
    .query(async ({ input, ctx }) => {
      const { supabase } = ctx
      const { stateCode } = input

      const { data } = await supabase
        .from('card_shows_cache')
        .select('shows, cached_at')
        .eq('state_code', stateCode)
        .single()

      const cached = data as Pick<CardShowsCacheRow, 'shows' | 'cached_at'> | null
      const isFresh = cached && (Date.now() - new Date(cached.cached_at).getTime() < CACHE_TTL_MS)
      if (isFresh) return { shows: cached.shows, cached: true }

      // Cache miss or stale — TCDB scraping requires a server with Playwright/Electron.
      // The Supabase Edge Function or desktop app populates card_shows_cache.
      // Return stale data if present, empty if nothing cached yet.
      if (cached?.shows) return { shows: cached.shows, cached: true, stale: true }
      return { shows: [], cached: false }
    }),
})
