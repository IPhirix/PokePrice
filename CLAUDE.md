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
- `csv-cache/` — cached PPT CSV files (1-hour TTL)
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
  pptId,         // tcgPlayerId from Pokemon Price Tracker API
  pptName,       // card name from PPT
  imageUrl, imageUrlLarge,
  addedDate, lastPriceUpdate,
  targetBuyPrice, targetSellPrice,
  changeDay, changeWeek, changeMonth,  // % changes
  recentHistory  // last 90 days [{date, price}]
}
```

Legacy cards may still have `pricechartingId`/`pricechartingName` instead of `pptId`/`pptName`.

### Price Refresh System

All prices come from **Pokemon Price Tracker (PPT)** (`https://www.pokemonpricetracker.com/api/v2`). Token stored as `pptToken` in `settings.json` (env var `POKEPRICE_KEY` overrides in dev).

- **Raw cards**: fetched via `GET /cards?tcgPlayerId={id}` → `cardData.prices.market`
- **Graded cards**: fetched with `includeEbay=true` → `cardData.ebay.salesByGrade[condition].smartMarketPrice`
- Rate limiting: 1100ms gap enforced via `pptRateLimit()`, 60 calls/minute max
- Cards without a `pptId` are auto-linked on first refresh via name+set+number search (1 credit)
- Refresh triggered manually via `prices:refresh` IPC or by a `node-cron` job at 8am daily

Legacy PriceCharting CSV backfill still works for old cards that have `pricechartingId`.

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

- **Pokemon Price Tracker (PPT)** — sole active price source; see `reference-ppt-api.md` in memory for auth, endpoints, and rate limits
- **Pokemon TCG API** (`pokemontcg.io`) — card search and metadata
- **open.er-api.com** — live exchange rates for currency conversion (fallback hardcoded rates)
- **Resend** — transactional email for password reset codes
- **Google Geocoding** — used by the card shows feature to place show locations on a map
