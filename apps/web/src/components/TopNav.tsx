'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { trpc } from '@/trpc/react'
import type { User } from '@supabase/supabase-js'

// ── Tab definitions (mirrors desktop TABS array exactly) ─────────────────────
const TABS = [
  {
    id: 'collection',
    label: 'Collection',
    href: '/?tab=collection',
    dashTab: true,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-900/30 border-emerald-500',
    showCount: true,
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    href: '/?tab=watchlist',
    dashTab: true,
    color: 'text-sky-400',
    activeBg: 'bg-sky-900/30 border-sky-500',
    showCount: true,
  },
  {
    id: 'trade',
    label: 'Trade Analyzer',
    href: '/trade',
    dashTab: false,
    color: 'text-rose-400',
    activeBg: 'bg-rose-900/20 border-rose-500',
    showCount: false,
  },
  {
    id: 'cardshows',
    label: 'Card Shows',
    href: '/card-shows',
    dashTab: false,
    color: 'text-violet-400',
    activeBg: 'bg-violet-900/30 border-violet-500',
    showCount: false,
  },
  {
    id: 'pokedex',
    label: 'Pokédex',
    href: '/search',
    dashTab: false,
    color: 'text-red-400',
    activeBg: 'bg-red-900/20 border-red-500',
    showCount: false,
  },
  {
    id: 'advanced',
    label: 'Advanced Search',
    href: '/advanced-search',
    dashTab: false,
    color: 'text-accent',
    activeBg: 'bg-amber-900/20 border-accent',
    showCount: false,
  },
] as const

// ── Tab icons (exact SVGs from desktop TAB_ICONS) ────────────────────────────
const TAB_ICONS: Record<string, React.ReactNode> = {
  collection: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="15" height="20" rx="2" />
      <line x1="9" y1="2" x2="9" y2="22" />
      <circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  watchlist: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  trade: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
  cardshows: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  pokedex: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="4" y1="9" x2="20" y2="9" />
      <circle cx="7.5" cy="5.5" r="1.5" />
      <rect x="7" y="12" width="10" height="6" rx="1" />
    </svg>
  ),
  advanced: (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="22" y2="22" />
      <line x1="7" y1="9" x2="15" y2="9" />
      <line x1="7" y1="13" x2="13" y2="13" />
    </svg>
  ),
}

export default function TopNav({ user }: { user: User }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'collection'
  const [searchQuery, setSearchQuery] = useState('')

  const utils = trpc.useUtils()
  const { data } = trpc.portfolio.dashboard.useQuery(undefined, { staleTime: 60_000 })
  const refreshAll = trpc.prices.refreshAll.useMutation({
    onSuccess: () => utils.portfolio.dashboard.invalidate(),
  })
  const counts: Record<string, number> = {
    collection: data?.portfolio.length ?? 0,
    watchlist: data?.watchlist.length ?? 0,
  }

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  function isActive(item: typeof TABS[number]) {
    if (item.dashTab) return pathname === '/' && tab === item.id
    return pathname.startsWith(item.href)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="flex-shrink-0 px-8 py-3 bg-surface-900 border-b border-surface-700">
      <div className="flex items-center gap-2 min-w-0">

        {/* ── Zone 1: Logo (fixed) ────────────────────────────────────────── */}
        <div className="flex-shrink-0 mr-2">
          <h1 className="text-2xl font-black tracking-widest text-accent leading-none">POKEPRICE</h1>
          <p className="text-slate-500 text-xs tracking-wider mt-0.5">Pokémon Card Price Tracker</p>
        </div>

        {/* ── Zone 2: Nav tabs + search (scrollable, flex-1) ─────────────── */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="flex gap-1.5 items-center w-max pr-4">
            {TABS.map(item => {
              const active = isActive(item)
              const count = counts[item.id]
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                    active
                      ? `${item.activeBg} ${item.color}`
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {TAB_ICONS[item.id]}
                  {item.label}
                  {item.showCount && count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      active ? 'bg-surface-600 text-slate-200' : 'bg-surface-700 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* Inline search — sits next to tabs, same as desktop */}
            <div className="flex items-center ml-6">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search Items..."
                className="h-[34px] px-3 text-sm bg-surface-800 border border-surface-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-accent hover:border-surface-500 transition-colors w-64"
              />
            </div>
          </div>
        </div>

        {/* ── Zone 3: Right actions (pinned, flex-shrink-0) ──────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Eye (hide values) */}
          <button
            title="Hide values"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Refresh */}
          <button
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            title="Refresh all prices"
          >
            <svg className={`w-4 h-4 ${refreshAll.isPending ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshAll.isPending ? 'Refreshing…' : 'Refresh'}
          </button>

          {/* My Account */}
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
            title="My Account"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth={1.8} />
            </svg>
            My Account
          </Link>

          {/* Sign Out */}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
            title="Sign Out"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>

          {/* Activity log */}
          <Link
            href="/activity"
            title="Activity Log"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="12" y2="16" />
            </svg>
          </Link>

          {/* Notifications bell */}
          <button
            title="Price alerts"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors relative"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          {/* Settings gear */}
          <Link
            href="/settings"
            title="Settings"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
