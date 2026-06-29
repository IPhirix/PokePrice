import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const activityRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional())
    .query(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const { data } = await supabase
        .from('activity')
        .select('id, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(input?.limit ?? 100)

      return (data ?? []) as { id: string; type: string; description: string; created_at: string }[]
    }),

  add: protectedProcedure
    .input(z.object({
      type: z.string(),
      description: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      await supabase.from('activity').insert({
        user_id: user.id,
        type: input.type,
        description: input.description,
      })
      return { ok: true }
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabase, user } = ctx
    await supabase.from('activity').delete().eq('user_id', user.id)
    return { ok: true }
  }),
})
