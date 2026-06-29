'use client'

import { createTRPCReact } from '@trpc/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchStreamLink } from '@trpc/client'
import superjson from 'superjson'
import { useState } from 'react'
import type { AppRouter } from '@/server/router'

export const trpc = createTRPCReact<AppRouter>()

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  }))

  const [trpcClientInstance] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchStreamLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClientInstance} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
