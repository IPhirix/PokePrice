import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'

export const profilesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx
    const { data } = await supabase
      .from('profiles')
      .select('currency, binder_lists')
      .eq('user_id', user.id)
      .single()

    return {
      currency: (data as { currency: string; binder_lists: string[] } | null)?.currency ?? 'USD',
      binderLists: ((data as { currency: string; binder_lists: string[] } | null)?.binder_lists ?? []) as string[],
    }
  }),

  update: protectedProcedure
    .input(z.object({
      currency: z.string().optional(),
      binderLists: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { supabase, user } = ctx
      const updates: Record<string, unknown> = {}
      if (input.currency !== undefined) updates.currency = input.currency
      if (input.binderLists !== undefined) updates.binder_lists = input.binderLists

      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

      if (error) throw new Error(error.message)
      return { ok: true }
    }),
})
