import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

const TradeCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  setName: z.string().nullable(),
  condition: z.string(),
  currentPrice: z.number().nullable(),
  quantity: z.number(),
  imageUrl: z.string().nullable(),
})

export const tradesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const { data } = await supabase
      .from('trades')
      .select('id, cards_given, cards_received, notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return (data ?? []) as {
      id: string
      cards_given: unknown[]
      cards_received: unknown[]
      notes: string | null
      created_at: string
    }[]
  }),

  save: protectedProcedure
    .input(z.object({
      cardsGiven: z.array(TradeCardSchema),
      cardsReceived: z.array(TradeCardSchema),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const { error } = await supabase.from('trades').insert({
        user_id: user.id,
        cards_given: input.cardsGiven,
        cards_received: input.cardsReceived,
        notes: input.notes ?? null,
      })
      if (error) throw new Error(error.message)
      return { ok: true }
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: id, ctx }) => {
      const { supabase, user } = ctx
      await supabase.from('trades').delete().eq('id', id).eq('user_id', user.id)
      return { ok: true }
    }),
})
