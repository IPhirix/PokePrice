# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

```text
pokeprice/
├── apps/
│   ├── desktop/     # Tauri app (React renderer + Rust backend)
│   └── web/         # Next.js 16 (App Router) — in progress
├── packages/
│   ├── database/    # Supabase client singleton (@pokeprice/database)
│   ├── types/       # Shared TS interfaces: Card, Database, PortfolioStats (@pokeprice/types)
│   ├── pokemon/     # TCGdex card search + set list (@pokeprice/pokemon)
│   ├── pricing/     # resolveSupabaseId, fetchPriceHistory, calcPriceChanges (@pokeprice/pricing)
│   ├── portfolio/   # calcPortfolioStats (@pokeprice/portfolio)
│   ├── card-shows/  # geocodeCity, geocodeZip, distanceKm (@pokeprice/card-shows)
│   ├── rankings/    # Scaffold only — feature TBD (@pokeprice/rankings)
│   └── ui/          # Shared React components (@pokeprice/ui)
├── supabase/
│   ├── migrations/  # SQL: user tables (collections, watchlists, profiles, trades, activity, etc.)
│   └── functions/   # Deno Edge Functions: refresh-prices, check-alerts
└── scripts/         # Python price import, one-off utilities
```

**Package manager**: pnpm with workspaces. **Build orchestration**: Turborepo.

## Commands

```bash
# Root (runs all apps via Turborepo)
pnpm dev                         # Dev all apps
pnpm dev:web                     # Next.js web only

# Desktop app (apps/desktop)
cd apps/desktop
pnpm dev                         # Tauri dev (Vite renderer + Rust backend)
pnpm dev:web                     # Vite renderer only (localhost:5173, no Rust)
pnpm build:tauri                 # Build Tauri .exe
```

There is no test suite. Testing is manual by running the app.

## Desktop App Architecture (apps/desktop)

### Process Model

**Rust backend** (`src-tauri/src/`) handles all data persistence, API calls, auth, and business logic. The renderer has no direct file system or network access.

**Tauri bridge** (`src/renderer/src/tauri-bridge.js`) exposes ~55 async methods as `window.api.*` via `invoke()`. All renderer ↔ backend communication goes through these IPC calls. Auth methods are nested under `window.api.auth.*`.

**Renderer** (`src/renderer/`) is a React 18 + React Router 6 (hash routing) SPA. Components call `window.api.*` directly and store results in local `useState`. There is no Redux/Zustand — state lives in components and React Context.

### Rust Backend Modules (`src-tauri/src/`)

| Module | Responsibility |
| ------ | -------------- |
| `lib.rs` | App setup, module declarations, command registration |
| `state.rs` | `AppState` — shared mutable state, file path helpers |
| `auth.rs` | 18 auth commands — PBKDF2 login, session, OTP reset |
| `cards.rs` | Cards CRUD, binders, account stats, activity, alerts |
| `prices.rs` | Price history, manual prices, portfolio stats, DB refresh |
| `settings.rs` | Per-user settings read/write, Supabase profile sync |
| `trades.rs` | Trades CRUD |
| `shows.rs` | Upcoming shows CRUD, geocoding (Nominatim + Zippopotam) |
| `misc.rs` | TCGdex card search, sets list, app version, shell open |
| `tcgdex.rs` | TCGdex API client — search, sets, variations |
| `db.rs` | PostgreSQL client — resolve card ID, fetch price history |
| `supabase.rs` | Supabase Auth REST API client (sign in, OTP, etc.) |
| `utils.rs` | read_json, write_json, calc_change, is_pocket_card, etc. |

### Auth System

Local multi-user auth backed by `auth.json` at root of `userData`. Passwords hashed with PBKDF2-SHA512 + random salt (100k rounds). Session tokens in `tauri-session.json`, optionally persisted via "stay logged in".

**Flow**: App starts → `AuthProvider` checks `auth:isSetup` and `auth:isSessionValid` → routes to `LoginPage` or `CreateAccountPage` if unauthenticated, or main app if authenticated.

`current_user: Mutex<Option<String>>` in `AppState` is set on login and cleared on logout. All per-user file reads/writes go through `state.current_user_dir()` which returns `None` if no user logged in.

### Data Storage (Desktop — local JSON)

`auth.json` and `tauri-session.json` live at root of `userData` (`{appData}/pokeprice`). All other files live in `{userData}/users/{username}/`:

- `cards.json` — array of all tracked cards (portfolio + watchlist + sold)
- `prices-{cardId}.json` — price history array `[{date, price, source}]`
- `settings.json` — currency, defaults, binder lists
- `trades.json` — historical trade records
- `activity.json` — account activity log entries
- `upcoming-shows.json` — saved card show events

### Card Object Shape

```ts
{
  id: string            // UUID
  tcgId: string         // TCGdex card ID
  name: string
  setName: string | null
  setId: string | null
  number: string | null
  rarity: string | null
  condition: 'raw' | 'psa10' | 'psa9' | 'psa8' | 'cgc10' | 'cgc9'
  quantity: number
  section: 'portfolio' | 'watchlist'
  binder: string | null
  purchasePrice: number | null
  currentPrice: number | null
  priceSource: string | null
  imageUrl: string | null
  imageUrlLarge: string | null
  addedDate: string
  lastPriceUpdate: string | null
  targetBuyPrice: number | null
  targetSellPrice: number | null
  changeDay: number | null      // % change
  changeWeek: number | null
  changeMonth: number | null
  recentHistory: { date: string; price: number }[]   // last 90 days
  pricechartingId: string | null
  pricechartingName: string | null
}
```

### Price Refresh System

All prices come from a **Supabase PostgreSQL database** seeded with PriceCharting data. The connection string is read from the `DATABASE_URL` environment variable.

- Resolved via `db::resolve_supabase_id()` (pricechartingId → pricechartingName → name+number)
- Per-condition columns: `loose_price` (raw/sealed), `manual_only_price` (PSA 10), `graded_price` (PSA 9/CGC 9), `new_price` (PSA 8)
- Desktop: `prices_refresh` Tauri command; cron scheduling not yet ported (was node-cron)
- Web/future: `supabase/functions/refresh-prices` Edge Function (daily cron)

### Styling

Tailwind CSS with custom dark theme. Key tokens:

- `surface-900` → `surface-500` — dark panel backgrounds
- `accent` — amber highlight color

## Supabase Schema

New user tables (in `supabase/migrations/20260622000001_user_tables.sql`):

| Table | Replaces |
| ----- | -------- |
| `profiles` | `settings.json` |
| `collections` | `cards.json` (portfolio) |
| `watchlists` | `cards.json` (watchlist) |
| `pokemon_card_prices` | `prices-{cardId}.json` |
| `trades` | `trades.json` |
| `activity` | `activity.json` |
| `upcoming_shows` | `upcoming-shows.json` |
| `card_shows_cache` | `cardshows-{state}.json` |

All user tables have RLS: `user_id = auth.uid()`. `pokemon_prices` (price source DB) is read-only, unchanged.

## Key Files

| File | Role |
| ---- | ---- |
| `apps/desktop/src-tauri/src/lib.rs` | App entry, module declarations, command handler registration |
| `apps/desktop/src-tauri/src/auth.rs` | All auth IPC commands |
| `apps/desktop/src-tauri/src/cards.rs` | Cards/binders/account/activity/alerts IPC commands |
| `apps/desktop/src-tauri/src/prices.rs` | Price IPC commands + DB refresh |
| `apps/desktop/src-tauri/src/db.rs` | PostgreSQL queries (resolve ID, fetch history, all conditions) |
| `apps/desktop/src/renderer/src/tauri-bridge.js` | `window.api.*` bridge — all invoke() wrappers |
| `apps/desktop/src/renderer/src/App.jsx` | Auth-gated routing |
| `apps/desktop/src/renderer/src/pages/Dashboard.jsx` | Portfolio/watchlist tabs, binder nav |
| `apps/desktop/src/renderer/src/pages/CardDetail.jsx` | Single card view, price chart, alerts |
| `packages/types/src/index.ts` | Shared TypeScript interfaces (Card, Database, PortfolioStats) |
| `packages/pricing/src/index.ts` | resolveSupabaseId, fetchPriceHistory (Node reference — ported to Rust) |
| `packages/pokemon/src/tcgdex.ts` | TCGdex search reference — ported to Rust `tcgdex.rs` |
| `packages/card-shows/src/geocoding.ts` | Geocoding reference — ported to Rust `shows.rs` |
| `supabase/functions/refresh-prices/index.ts` | Daily price refresh Edge Function |
| `supabase/functions/check-alerts/index.ts` | Daily alert email Edge Function |

## External APIs

- **Supabase (PostgreSQL)** — sole active price source; `DATABASE_URL` env var
- **TCGdex** (`api.tcgdex.net/v2/en`) — card search, set lists, card metadata (called from Rust)
- **open.er-api.com** — live exchange rates (called from renderer `CurrencyContext`)
- **Resend** — email for password reset + price alerts (`RESEND_KEY` env var) — stub in Tauri
- **Nominatim (OpenStreetMap)** — geocoding for card show locations (called from Rust)
- **Zippopotam** (`api.zippopotam.us`) — ZIP to lat/lon (called from Rust)
- **TCDB** (`tcdb.com`) — card show events — scraping not yet ported to Tauri
