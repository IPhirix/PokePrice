# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Electron app with Vite dev server (hot reload at localhost:5173)
npm run dev:web      # Vite renderer only (no Electron)
npm run build        # Production bundle
npm run build:win    # Build portable Windows .exe via electron-builder → dist/PokePrice.exe
```

There is no test suite. Testing is manual by running the app.

**Important**: Electron must be launched via `scripts/start-electron.js` (not directly), which clears `ELECTRON_RUN_AS_NODE=1` that Claude Code CLI sets. `npm run dev` handles this automatically. For a quick rebuild + launch cycle, use `scripts/rebuild.ps1`.

## Architecture

### Process Model

**Main process** (`src/main/index.js`, ~2600 lines) handles all data persistence, API calls, auth, and business logic. The renderer has no direct file system or network access.

**Preload bridge** (`src/preload/index.js`) exposes ~76 async methods as `window.api.*` using `contextBridge`. All renderer ↔ main communication goes through these IPC calls. Auth methods are nested under `window.api.auth.*`.

**Renderer** (`src/renderer/`) is a React 18 + React Router 6 (hash routing) SPA. Components call `window.api.*` directly and store results in local `useState`. There is no Redux/Zustand — state lives in components and React Context.

### Auth System

The app uses local multi-user authentication backed by `auth.json` at the root of `userData`. Passwords are hashed with PBKDF2 + random salt. Session tokens are stored in `auth.json` and optionally persisted across restarts via "stay logged in".

**Flow**: App starts → `AuthProvider` checks `auth:isSetup` and `auth:isSessionValid` → routes to `LoginPage` or `CreateAccountPage` if unauthenticated, or the main app if authenticated.

Password reset supports two paths: email code (via Resend) or security question/answer.

`_currentUser` is set in the main process on login and cleared on logout. All per-user file reads/writes go through `getUserDir()` which throws if no user is logged in.

Data migration: on first login after upgrade, old flat `userData/*.json` files are copied into `users/{username}/`.

### Data Storage

`auth.json` lives at the root of `userData` (shared across users). All other data files live in `userData/users/{username}/`:
- `cards.json` — array of all tracked cards (portfolio + watchlist + sealed)
- `prices-{cardId}.json` — price history array for each card `[{date, price, source}]`
- `settings.json` — API tokens, currency, defaults, binder lists
- `trades.json` — historical trade records
- `activity.json` — account activity log entries
- `upcoming-shows.json` — saved card show events

Shared (not per-user):
- `sets-cache.json` — Pokemon TCG sets list cache

### Card Object Shape

```js
{
  id,            // UUID
  tcgId,         // Pokemon TCG API ID
  name, setName, setId, number, rarity,
  condition,     // 'raw' | 'psa10' | 'psa9' | 'psa8' | 'cgc10' | 'cgc9'
  quantity, section,   // 'portfolio' | 'watchlist'
  binder,        // string | null  (old cards may use 'folder' — both are checked)
  purchasePrice, currentPrice, priceSource,
  imageUrl, imageUrlLarge,
  addedDate, lastPriceUpdate,
  targetBuyPrice, targetSellPrice,
  changeDay, changeWeek, changeMonth,  // % changes
  recentHistory  // last 90 days [{date, price}]
}
```

Cards may have a `pricechartingId`/`pricechartingName` used to resolve their row in the Supabase price database.

### Price Refresh System

All prices come from a **Supabase PostgreSQL database** seeded with PriceCharting data. The connection string is read from the `DATABASE_URL` environment variable; if absent, price refresh is a no-op.

- Prices are looked up via `resolveSupabaseId()` which matches `pricechartingId` → `pricechartingName` → constructed name+number
- Per-condition columns: `loose_price` (raw/sealed), `manual_only_price` (PSA 10), `graded_price` (PSA 9 / CGC 9), `new_price` (PSA 8), `condition_17_price` (CGC 10)
- Refresh triggered manually via `prices:refresh` IPC or by a `node-cron` job at 8am daily

### Styling

Tailwind CSS with a custom dark theme. Key custom tokens:
- `surface-900` → `surface-500` — dark panel backgrounds
- `accent` — amber highlight color

## Key Files

| File | Role |
|------|------|
| `src/main/index.js` | All IPC handlers, data CRUD, API integrations, auth, cron scheduling |
| `src/preload/index.js` | `window.api` bridge definition |
| `src/renderer/src/App.jsx` | Auth-gated routing: LoginPage / CreateAccountPage / main app |
| `src/renderer/src/pages/Dashboard.jsx` | Main hub — portfolio/watchlist tabs, binder nav |
| `src/renderer/src/pages/CardDetail.jsx` | Single card view, price chart, edit/alerts |
| `src/renderer/src/pages/LoginPage.jsx` | Login form with password reset flow |
| `src/renderer/src/pages/CreateAccountPage.jsx` | New account creation form |
| `src/renderer/src/context/AuthContext.jsx` | Auth state: isSetup, isAuthenticated, login/logout/createAccount |
| `src/renderer/src/context/CurrencyContext.jsx` | Live forex rates + USD conversion for all prices |
| `src/renderer/src/context/AlertsContext.jsx` | Price alert state shared across components |
| `src/renderer/src/components/AccountModal.jsx` | Account settings, password change, data management |
| `src/renderer/src/components/ResetPasswordModal.jsx` | Password reset via email code or security question |

## External APIs

- **Supabase (PostgreSQL)** — sole active price source; `DATABASE_URL` env var connects to the PriceCharting-seeded DB
- **TCGdex** (`api.tcgdex.net/v2/en`) — card search, set lists, and card metadata
- **open.er-api.com** — live exchange rates for currency conversion; called from the renderer (`CurrencyContext`), fallback to hardcoded rates
- **Resend** — transactional email for password reset codes and price alert emails (`RESEND_KEY` env var)
- **Nominatim (OpenStreetMap)** — geocoding for card show locations (`nominatim.openstreetmap.org`)
- **Zippopotam** (`api.zippopotam.us`) — ZIP code to lat/lon for user location on card shows map
- **TCDB** (`tcdb.com`) — card show event data scraped via a hidden Electron browser window
