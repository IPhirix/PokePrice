import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/server/supabase'
import TopNav from '@/components/TopNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full flex flex-col min-w-0 overflow-x-hidden">
      <Suspense fallback={
        <div className="h-12 flex-shrink-0 bg-surface-800 border-b border-surface-600" />
      }>
        <TopNav user={user} />
      </Suspense>
      <main className="flex-1 overflow-y-auto min-w-0">
        <Suspense>
          {children}
        </Suspense>
      </main>
    </div>
  )
}
