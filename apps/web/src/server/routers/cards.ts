import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { searchCards, getCard, getSets } from '@pokeprice/pokemon'
import { calcPriceChanges } from '@pokeprice/pricing'
import { getPricePool } from '../priceDb'
import type { Card, CollectionsRow, CardPriceHistoryRow } from '@pokeprice/types'

const SEALED_ABBREVIATIONS: Record<string, string> = { etb: 'Elite Trainer Box', bb: 'Booster Box' }
const SEALED_PRODUCT_KEYWORDS = [
  'Elite Trainer Box', 'Booster Box', 'Booster Bundle', 'Booster Pack',
  'Collection Box', 'Premium Collection', 'Gift Box', 'Mini Tin',
  'Tin', 'Theme Deck', 'Starter Deck', 'Blister', 'Bundle', 'Display Box',
]

const AddCardInput = z.object({
  tcgId: z.string().nullable().default(null),
  name: z.string(),
  setName: z.string().nullable(),
  setId: z.string().nullable(),
  number: z.string().nullable(),
  rarity: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageUrlLarge: z.string().nullable(),
  condition: z.enum(['raw', 'psa10', 'psa9', 'psa8', 'cgc10', 'cgc9', 'sealed']),
  quantity: z.number().int().min(1).default(1),
  purchasePrice: z.number().nullable(),
  section: z.enum(['portfolio', 'watchlist']),
  type: z.enum(['card', 'sealed']).default('card'),
  pricechartingId: z.string().nullable().optional(),
  currentPrice: z.number().nullable().optional(),
})

export const cardsRouter = router({
  search: publicProcedure
    .input(z.string().min(1))
    .query(async ({ input }) => {
      return searchCards(input)
    }),

  listSets: publicProcedure.query(async () => {
    return getSets()
  }),

  searchBySet: publicProcedure
    .input(z.object({ setId: z.string() }))
    .query(async ({ input }) => {
      const axios = (await import('axios')).default
      const res = await axios.get(`https://api.tcgdex.net/v2/en/sets/${input.setId}`, { timeout: 15_000 })
      const set = res.data
      const cards = (set.cards ?? []) as { id?: string; localId?: string | number; name: string; image?: string; rarity?: string; types?: string[] }[]
      return cards.map(c => ({
        id: c.id ?? `${input.setId}-${c.localId}`,
        name: c.name,
        image: c.image ? `${c.image}/low.webp` : null,
        localId: c.localId != null ? String(c.localId) : '',
        set: { id: input.setId, name: set.name as string },
        rarity: c.rarity ?? null,
        types: c.types ?? null,
      }))
    }),

  get: publicProcedure
    .input(z.object({ cardId: z.string() }))
    .query(async ({ input }) => {
      return getCard(input.cardId)
    }),

  getById: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input: id, ctx }) => {
      const { supabase, user } = ctx

      // Try collections first, then watchlists
      let row: CollectionsRow | null = null
      let section: 'portfolio' | 'watchlist' = 'portfolio'

      const { data: colData } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (colData) {
        row = colData as CollectionsRow
      } else {
        const { data: wlData } = await supabase
          .from('watchlists')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single()
        if (wlData) {
          row = wlData as CollectionsRow
          section = 'watchlist'
        }
      }

      if (!row) return null

      const { data: prices } = await supabase
        .from('card_price_history')
        .select('date, price')
        .eq('card_id', id)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .limit(90)

      const history = ((prices ?? []) as Pick<CardPriceHistoryRow, 'date' | 'price'>[]).map(p => ({ date: p.date, price: p.price }))
      const { currentPrice, changeDay, changeWeek, changeMonth } = calcPriceChanges(history)

      return {
        id: row.id,
        tcgId: row.tcg_id,
        name: row.name,
        setName: row.set_name,
        setId: row.set_id,
        number: row.number,
        rarity: row.rarity,
        condition: row.condition as Card['condition'],
        quantity: row.quantity,
        section,
        binder: row.binder,
        purchasePrice: row.purchase_price,
        currentPrice: currentPrice ?? row.current_price,
        priceSource: row.price_source,
        imageUrl: row.image_url,
        imageUrlLarge: row.image_url_large,
        addedDate: row.added_date,
        lastPriceUpdate: row.last_price_update,
        targetBuyPrice: row.target_buy_price,
        targetSellPrice: row.target_sell_price,
        changeDay: changeDay ?? row.change_day,
        changeWeek: changeWeek ?? row.change_week,
        changeMonth: changeMonth ?? row.change_month,
        recentHistory: history,
        pricechartingId: row.pricecharting_id,
        pricechartingName: row.pricecharting_name,
      } satisfies Card
    }),

  add: protectedProcedure
    .input(AddCardInput)
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const table = input.section === 'portfolio' ? 'collections' : 'watchlists'
      const today = new Date().toISOString().slice(0, 10)

      const { data, error } = await supabase.from(table).insert({
        user_id: user.id,
        tcg_id: input.tcgId ?? '',
        name: input.name,
        set_name: input.setName,
        set_id: input.setId,
        number: input.number,
        rarity: input.rarity,
        image_url: input.imageUrl,
        image_url_large: input.imageUrlLarge,
        condition: input.condition,
        quantity: input.quantity,
        purchase_price: input.purchasePrice,
        type: input.type,
        pricecharting_id: input.pricechartingId ?? null,
        current_price: input.currentPrice ?? null,
        price_source: input.currentPrice != null ? 'supabase' : null,
        added_date: today,
      }).select('id').single()

      if (error) throw new Error(error.message)
      return { id: (data as { id: string }).id }
    }),

  remove: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: id, ctx }) => {
      const { supabase, user } = ctx

      await Promise.all([
        supabase.from('collections').delete().eq('id', id).eq('user_id', user.id),
        supabase.from('watchlists').delete().eq('id', id).eq('user_id', user.id),
      ])
      await supabase.from('card_price_history').delete().eq('card_id', id).eq('user_id', user.id)

      return { ok: true }
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(1).optional(),
      condition: z.enum(['raw', 'psa10', 'psa9', 'psa8', 'cgc10', 'cgc9']).optional(),
      purchasePrice: z.number().nullable().optional(),
      binder: z.string().nullable().optional(),
      targetBuyPrice: z.number().nullable().optional(),
      targetSellPrice: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const { id, quantity, condition, purchasePrice, binder, targetBuyPrice, targetSellPrice } = input

      const updates: Record<string, unknown> = {}
      if (quantity !== undefined) updates.quantity = quantity
      if (condition !== undefined) updates.condition = condition
      if ('purchasePrice' in input) updates.purchase_price = purchasePrice
      if ('binder' in input) updates.binder = binder
      if ('targetBuyPrice' in input) updates.target_buy_price = targetBuyPrice
      if ('targetSellPrice' in input) updates.target_sell_price = targetSellPrice

      await Promise.all([
        supabase.from('collections').update(updates).eq('id', id).eq('user_id', user.id),
        supabase.from('watchlists').update(updates).eq('id', id).eq('user_id', user.id),
      ])

      return { ok: true }
    }),

  moveSection: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      toSection: z.enum(['portfolio', 'watchlist']),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const fromTable = input.toSection === 'portfolio' ? 'watchlists' : 'collections'
      const toTable = input.toSection === 'portfolio' ? 'collections' : 'watchlists'

      const { data: row } = await supabase
        .from(fromTable)
        .select('*')
        .eq('id', input.id)
        .eq('user_id', user.id)
        .single()

      if (!row) return { ok: false, error: 'not found in source table' }

      const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = row as Record<string, unknown>

      const { data: inserted, error } = await supabase
        .from(toTable)
        .insert({ ...rest, user_id: user.id })
        .select('id')
        .single()

      if (error || !inserted) return { ok: false, error: error?.message ?? 'insert failed' }

      await Promise.all([
        supabase.from(fromTable).delete().eq('id', input.id).eq('user_id', user.id),
        supabase.from('card_price_history')
          .update({ card_id: (inserted as { id: string }).id, card_table: toTable })
          .eq('card_id', input.id)
          .eq('user_id', user.id),
      ])

      return { ok: true, newId: (inserted as { id: string }).id }
    }),

  searchSealed: publicProcedure
    .input(z.string().min(1))
    .query(async ({ input }) => {
      let q = input.trim()
      for (const [abbr, expansion] of Object.entries(SEALED_ABBREVIATIONS)) {
        q = q.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), expansion)
      }
      const keyword = SEALED_PRODUCT_KEYWORDS.find(k => q.toLowerCase().includes(k.toLowerCase()))
      if (!keyword) return []
      const seriesPart = q.replace(new RegExp(keyword, 'i'), '').trim()

      const params: string[] = [`%${keyword}%`]
      let whereClause = 'WHERE pc.product_name ILIKE $1'
      if (seriesPart) {
        params.push(`%${seriesPart}%`)
        whereClause += ' AND pc.console_name ILIKE $2'
      }

      const db = getPricePool()
      const res = await db.query(
        `SELECT DISTINCT ON (pc.pricecharting_id)
           pc.pricecharting_id, pc.console_name, pc.product_name, pcp.loose_price,
           si.image_url
         FROM pokemon_cards pc
         JOIN pokemon_card_prices pcp ON pcp.card_id = pc.id
         LEFT JOIN sealed_images si ON si.pricecharting_id = pc.pricecharting_id::text
         ${whereClause}
         ORDER BY pc.pricecharting_id, pcp.snapshot_date DESC
         LIMIT 50`,
        params
      )

      return res.rows.map((r: { pricecharting_id: number; console_name: string; product_name: string; loose_price: string | null; image_url: string | null }) => ({
        pricechartingId: String(r.pricecharting_id),
        name: `${r.console_name} ${r.product_name}`.trim(),
        setName: r.console_name,
        imageUrl: r.image_url ?? null,
        currentPrice: r.loose_price != null ? parseFloat(r.loose_price) : null,
      }))
    }),
})
