import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Re-export our row types for use in server code
export type { Database } from '@pokeprice/types'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can't be set, that's fine
          }
        },
      },
    }
  )
}
