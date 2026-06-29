import { router, protectedProcedure } from '../trpc'
import { calcPortfolioStats } from '@pokeprice/portfolio'
import { calcPriceChanges } from '@pokeprice/pricing'
import type { Card, CollectionsRow, CardPriceHistoryRow, SoldCardsRow } from '@pokeprice/types'

export const portfolioRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx

    const [{ data: collections }, { data: watchlists }, { data: soldRows }] = await Promise.all([
      supabase.from('collections').select('*').eq('user_id', user.id),
      supabase.from('watchlists').select('*').eq('user_id', user.id),
      supabase.from('sold_cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    async function hydrateCards(rows: CollectionsRow[] | null, section: 'portfolio' | 'watchlist'): Promise<Card[]> {
      if (!rows) return []
      return Promise.all(
        rows.map(async (row) => {
          const { data: prices } = await supabase
            .from('card_price_history')
            .select('date, price')
            .eq('card_id', row.id)
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
            type: (row.type as 'card' | 'sealed') ?? 'card',
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
        })
      )
    }

    const [portfolioCards, watchlistCards] = await Promise.all([
      hydrateCards(collections as CollectionsRow[] | null, 'portfolio'),
      hydrateCards(watchlists as CollectionsRow[] | null, 'watchlist'),
    ])

    const soldCards = ((soldRows ?? []) as SoldCardsRow[]).map(row => ({
      id: row.id,
      name: row.name,
      setName: row.set_name,
      condition: row.condition,
      type: row.type,
      imageUrl: row.image_url,
      purchasePrice: row.purchase_price,
      salePrice: row.sale_price,
      saleDate: row.sale_date,
      isTrade: row.is_trade,
      addedDate: row.added_date,
    }))

    return {
      portfolio: portfolioCards,
      watchlist: watchlistCards,
      sold: soldCards,
      stats: calcPortfolioStats(portfolioCards),
    }
  }),
})
