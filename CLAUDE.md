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

**Main process** (`src/main/index.js`, ~1000 lines) handles all data persistence, API calls, and business logic. The renderer has no direct file system or network access.

**Preload bridge** (`src/preload/index.js`) exposes ~45 async methods as `window.api.*` using `contextBridge`. All renderer ↔ main communication goes through these IPC calls.

**Renderer** (`src/renderer/`) is a React 18 + React Router 6 (hash routing) SPA. Components call `window.api.*` directly and store results in local `useState`. There is no Redux/Zustand — state lives in components and React Context.

### Data Storage

All persistence is JSON files in Electron's `userData` directory:
- `cards.json` — array of all tracked cards with metadata and current prices
- `prices-{cardId}.json` — price history array for each card (date + price + source)
- `settings.json` — API tokens, currency, defaults, folder lists
- `trades.json` — historical trade records

### Card Object Shape

```js
{
  id,            // UUID
  tcgId,         // Pokemon TCG API ID
  name, setName, setId, number, rarity,
  condition,     // 'raw' | 'psa10' | 'psa9' | 'psa8' | 'cgc10' | 'cgc9'
  quantity, section,   // 'portfolio' | 'watchlist'
  folder,        // string | null
  purchasePrice, currentPrice, priceSource,
  pricechartingId, pricechartingName,
  imageUrl, imageUrlLarge,
  addedDate, lastPriceUpdate,
  targetBuyPrice, targetSellPrice,
  changeDay, changeWeek, changeMonth,  // % changes
  recentHistory  // last 90 days [{date, price}]
}
```

### Price Refresh System

Prices come from two sources in `src/main/index.js`:
1. **PriceCharting CSV** (bulk, raw cards) — downloaded and cached for 1 hour, avoids rate limit
2. **PriceCharting API** (per-card, graded cards) — 1.2s rate limit enforced via `setTimeout` queue

Refresh is triggered manually via `prices:refresh` IPC or automatically by a `node-cron` job at 8am daily.

### Styling

Tailwind CSS with a custom dark theme. Key custom tokens:
- `surface-900` → `surface-500` — dark panel backgrounds
- `accent` — amber highlight color

## Key Files

| File | Role |
|------|------|
| `src/main/index.js` | All IPC handlers, data CRUD, API integrations, cron scheduling |
| `src/preload/index.js` | `window.api` bridge definition |
| `src/renderer/src/App.jsx` | Routes: `/` Dashboard, `/card/:id` CardDetail, `/settings` |
| `src/renderer/src/pages/Dashboard.jsx` | Main hub — portfolio/watchlist tabs, folder nav |
| `src/renderer/src/pages/CardDetail.jsx` | Single card view, price chart, edit/alerts |
| `src/renderer/src/context/CurrencyContext.jsx` | Live forex rates + USD conversion for all prices |

## External APIs

- **PriceCharting** — primary price source; see `reference-pricecharting-api.md` in memory for auth, endpoints, and rate limits
- **Pokemon TCG API** (`pokemontcg.io`) — card search and metadata
- **open.er-api.com** — live exchange rates for currency conversion (fallback hardcoded rates)
