import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { getPricePool } from '../priceDb'
import type { CardPriceHistoryRow } from '@pokeprice/types'
import { buildForTcgCardResult } from './prices.helpers'

function pool() { return getPricePool() }

export const pricesRouter = router({
  refreshSingle: protectedProcedure
    .input(z.object({
      cardId: z.string(),
      cardTable: z.enum(['collections', 'watchlists']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx

      const { data } = await supabase
        .from(input.cardTable)
        .select('id, name, number, set_name, condition, pricecharting_id, pricecharting_name')
        .eq('id', input.cardId)
        .eq('user_id', user.id)
        .single()

      const card = data as { id: string; name: string; number: string | null; set_name: string | null; condition: string; pricecharting_id: string | null; pricecharting_name: string | null } | null
      if (!card) return { ok: false, error: 'card not found' }

      const { fetchPriceHistory, calcPriceChanges } = await import('@pokeprice/pricing')
      const history = await fetchPriceHistory(pool(), card)
      if (!history.length) return { ok: false, error: 'no price data' }

      const latest = history[history.length - 1]
      const today = new Date().toISOString().slice(0, 10)

      await supabase.from('card_price_history').upsert({
        card_id:    input.cardId,
        card_table: input.cardTable,
        user_id:    user.id,
        date:       today,
        price:      latest.price,
        source:     'supabase',
      } satisfies Omit<CardPriceHistoryRow, 'id' | 'created_at'>)

      const { currentPrice, changeDay, changeWeek, changeMonth } = calcPriceChanges(history)

      await supabase
        .from(input.cardTable)
        .update({ current_price: currentPrice, change_day: changeDay, change_week: changeWeek, change_month: changeMonth, last_price_update: today })
        .eq('id', input.cardId)
        .eq('user_id', user.id)

      return { ok: true, price: latest.price }
    }),

  refreshAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { supabase, user } = ctx
      const { fetchPriceHistory, calcPriceChanges } = await import('@pokeprice/pricing')
      const today = new Date().toISOString().slice(0, 10)

      const [{ data: collections }, { data: watchlists }] = await Promise.all([
        supabase.from('collections').select('id, name, number, set_name, condition, pricecharting_id, pricecharting_name').eq('user_id', user.id),
        supabase.from('watchlists').select('id, name, number, set_name, condition, pricecharting_id, pricecharting_name').eq('user_id', user.id),
      ])

      type CardLike = { id: string; name: string; number: string | null; set_name: string | null; condition: string; pricecharting_id: string | null; pricecharting_name: string | null }
      const allCards = [
        ...((collections ?? []) as CardLike[]).map(c => ({ ...c, table: 'collections' as const })),
        ...((watchlists ?? []) as CardLike[]).map(c => ({ ...c, table: 'watchlists' as const })),
      ]

      let refreshed = 0
      for (const card of allCards) {
        const history = await fetchPriceHistory(pool(), card)
        if (!history.length) continue

        const latest = history[history.length - 1]
        const { currentPrice, changeDay, changeWeek, changeMonth } = calcPriceChanges(history)

        await Promise.all([
          supabase.from('card_price_history').upsert({
            card_id: card.id,
            card_table: card.table,
            user_id: user.id,
            date: today,
            price: latest.price,
            source: 'supabase',
          } satisfies Omit<CardPriceHistoryRow, 'id' | 'created_at'>),
          supabase.from(card.table).update({
            current_price: currentPrice,
            change_day: changeDay,
            change_week: changeWeek,
            change_month: changeMonth,
            last_price_update: today,
          }).eq('id', card.id).eq('user_id', user.id),
        ])
        refreshed++
      }
      return { ok: true, refreshed }
    }),

  history: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input: cardId, ctx }) => {
      const { supabase, user } = ctx
      const { data } = await supabase
        .from('card_price_history')
        .select('date, price, source')
        .eq('card_id', cardId)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
      return (data ?? []) as Pick<CardPriceHistoryRow, 'date' | 'price' | 'source'>[]
    }),

  forTcgCard: protectedProcedure
    .input(z.object({
      name: z.string(),
      number: z.string().nullish(),
      setName: z.string().nullish(),
      condition: z.string().default('raw'),
    }))
    .query(async ({ input }) => {
      const { fetchPriceHistory, fetchAllConditionPrices } = await import('@pokeprice/pricing')
      const cardRef = {
        name: input.name,
        number: input.number ?? undefined,
        setName: input.setName ?? undefined,
        condition: input.condition,
      }
      const [allConditions, history] = await Promise.all([
        fetchAllConditionPrices(pool(), cardRef),
        fetchPriceHistory(pool(), cardRef),
      ])
      return buildForTcgCardResult({ allConditions, history, condition: input.condition })
    }),
})
