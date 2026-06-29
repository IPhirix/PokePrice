# PokePrice Design System

Quick reference for the visual language. All tokens come from `tailwind.config.js` and `src/renderer/src/index.css`.

---

## Color Tokens

### Surface Scale
Dark backgrounds, layered by elevation. Higher number = darker = further back.

| Token | Hex | Use |
|-------|-----|-----|
| `surface-500` | `#2e3850` | Accents, scrollbar thumb, hover targets |
| `surface-600` | `#252d3d` | Borders, dividers |
| `surface-700` | `#1e2535` | Inputs, secondary buttons, table rows |
| `surface-800` | `#161b27` | Cards, modals, panels |
| `surface-900` | `#0f1117` | App background (body) |

### Accent
| Token | Hex | Use |
|-------|-----|-----|
| `accent` | `#f59e0b` | CTAs, active states, highlights, amber text |
| `accent-hover` | `#fbbf24` | Hover state for accent elements |

### Semantic Colors (Tailwind built-ins)
| Purpose | Classes |
|---------|---------|
| Positive / profit / up | `text-emerald-400`, `bg-emerald-900/20`, `bg-emerald-900/30` |
| Negative / loss / down | `text-red-400`, `bg-red-900/20`, `bg-red-900/70` |
| Watchlist / info | `text-sky-400` |
| Trade / warning | `text-yellow-300` |
| Muted / disabled | `text-slate-500`, `text-slate-600` |

### Text Hierarchy
| Role | Class |
|------|-------|
| Primary | `text-white` or `text-slate-100` |
| Secondary | `text-slate-300` |
| Tertiary / muted | `text-slate-400` – `text-slate-600` |

---

## Condition Badge Colors

Used as `className={CONDITION_COLOR[card.condition] || 'bg-slate-700 text-slate-300'}` with `text-xs px-2 py-0.5 rounded-full font-semibold`.

```js
const CONDITION_COLOR = {
  raw:   'bg-slate-700 text-slate-300',
  psa10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  psa9:  'bg-zinc-500/50 text-zinc-100',
  psa8:  'bg-orange-800/60 text-orange-300',
  cgc10: 'bg-yellow-600/50 text-yellow-200 ring-1 ring-yellow-500/40',
  cgc9:  'bg-zinc-500/50 text-zinc-100',
}
```

Pattern: semi-transparent backgrounds (`/50`, `/60`) + `ring-1` border for premium grades (PSA/CGC 10).

---

## Component Recipes

Copy-paste Tailwind class strings for recurring patterns.

### Form Input
```
w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-1.5
text-sm text-white focus:outline-none focus:border-accent
```

### Primary Button (CTA)
```
bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2
rounded-lg transition-colors
```

### Secondary Button
```
bg-surface-700 hover:bg-surface-600 border border-surface-500
text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors
```

### Danger Button
```
bg-red-900/40 hover:bg-red-900/60 border border-red-700/50
text-red-400 px-4 py-2 rounded-lg transition-colors
```

### Modal Overlay
```
fixed inset-0 bg-black/70 flex items-center justify-center z-50
```

### Modal Content Container
```
bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-[Xpx]
mx-4 overflow-hidden shadow-2xl
```

### Card Row Item
```
flex items-center gap-4 bg-surface-800 border border-surface-700
rounded-xl px-4 py-3 cursor-pointer hover:border-surface-500
hover:bg-surface-700/50 transition-all
```

### Badge / Pill
```
text-xs px-2 py-0.5 rounded-full font-semibold
```

### Tab Count Badge (nav tabs only)
```
text-xs px-2 py-0.5 rounded-full bg-surface-700 text-slate-400
```
Active tab uses `bg-surface-600` instead of `bg-surface-700`.

### Section Header (inside a panel)
```
text-xs font-semibold text-slate-500 uppercase tracking-wider
```

### Toggle / Switch
```
relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0
bg-accent          (on)
bg-surface-600     (off)
```
Thumb: `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform`
Translate: `translate-x-5` (on) / `translate-x-0` (off).

### Checkbox
```
w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
bg-accent border-accent        (checked)
border-surface-400 bg-surface-700 hover:border-slate-300  (unchecked)
```
Check icon: `w-2.5 h-2.5 text-black` SVG path `M1.5 5L4 7.5L8.5 2.5`.
Indeterminate: `block w-2 h-0.5 bg-black rounded-full`.

### Inline Dropdown / Popover
```
absolute left-0 top-full mt-1 bg-surface-800 border border-surface-600
rounded-xl shadow-2xl z-50 min-w-[180px] py-1 overflow-hidden
```
Backdrop dismiss: `fixed inset-0 z-40` click-trap div behind the popover.
Menu item: `w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-surface-700 hover:text-white transition-colors`.
Menu divider: `border-t border-surface-700 mt-1 pt-1`.

### Empty State — Solid
```
flex flex-col items-center justify-center py-12 text-slate-600
```
Icon: `w-10 h-10 mb-2 text-slate-700`. Body: `text-sm font-medium` + `text-xs mt-1`.

### Empty State — Dashed (droppable / awaiting content)
```
text-center py-10 border-2 border-dashed border-surface-600 rounded-xl
```
Used when the empty area is explicitly inviting the user to add content (e.g. trade items).

### Section Collapse Strip
```
w-full flex items-center gap-3 mb-3
```
Left/right fill lines: `flex-1 h-px bg-surface-700`.
Center label: `flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors whitespace-nowrap`.
Chevron: `w-3.5 h-3.5 transition-transform` — `rotate-0` expanded, `-rotate-90` collapsed.

---

## Typography Scale

| Size | Weight | Use |
|------|--------|-----|
| `text-3xl font-bold` | 700 | Large price values |
| `text-2xl font-black` | 900 | App logo / main headings |
| `text-lg font-bold` | 700 | Modal titles, page headings |
| `text-base font-semibold` | 600 | Sub-headings, tab labels |
| `text-sm` | 400–500 | Body text, form labels (most common) |
| `text-xs font-semibold` | 600 | Badges, chips, section headers |
| `text-xs` | 400 | Secondary labels, captions |

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

---

## Spacing & Shape

### Border Radius Ladder
| Class | px | Use |
|-------|----|-----|
| `rounded` | 4px | Micro: tiny badges, tags |
| `rounded-lg` | 8px | Inputs, buttons |
| `rounded-xl` | 12px | Cards, rows, panels |
| `rounded-2xl` | 16px | Modals |
| `rounded-full` | 50% | Pill badges, avatars |

### Page & Layout Padding

| Context | Value |
|---------|-------|
| Top header / banner bar | `px-8 py-3` |
| Main content scroll area | `px-6 py-3` |
| Sidebar / narrow scroll area | `px-4 py-3` |
| Section divider line | `h-px mx-6` |

### Panel & Card Padding

| Context | Value |
|---------|-------|
| Standard panel (`surface-800 rounded-xl`) | `p-3` |
| Roomy panel (pricing, detail boxes) | `p-4` |
| Card / row item | `px-4 py-3` |
| Compact pricing cell | `p-2.5` |

### Modal Padding

| Context | Value |
|---------|-------|
| Modal header / tab bar | `px-5 py-4` or `px-6 py-5` |
| Modal body | `p-5 space-y-5` or `p-4 space-y-3` |

### Input & Button Padding

| Context | Value |
|---------|-------|
| Form inputs (standard) | `px-3 py-2` |
| Dense inputs | `px-3 py-1.5` |
| Medium buttons | `px-4 py-2` or `px-4 py-1.5` |
| Compact buttons | `px-3 py-1.5` |
| Micro badges | `px-2 py-0.5` |

### Margin Conventions

| Context | Value |
|---------|-------|
| Between major sections | `mt-6 mb-2` |
| Label above input / below heading | `mb-1` |
| Below a section block | `mb-3` or `mb-4` |

### Gap Conventions

| Context | Value |
|---------|-------|
| Tight inline grouping | `gap-1` |
| Button / form groups, icon rows | `gap-2` |
| Card elements, section grouping | `gap-3` |
| Major layout sections | `gap-4` – `gap-6` |

---

## Scrollbar Utilities

Defined in `src/renderer/src/index.css`. Applied globally; use `.scrollbar-autohide` for panels that should only show the scrollbar while actively scrolling.

```css
/* Global — always visible */
::-webkit-scrollbar          { width: 6px }
::-webkit-scrollbar-track    { background: #161b27 }   /* surface-800 */
::-webkit-scrollbar-thumb    { background: #2e3850; border-radius: 3px }  /* surface-500 */
::-webkit-scrollbar-thumb:hover { background: #3e4f70 }

/* .scrollbar-autohide — hidden at rest, appears on scroll */
/* Requires JS to toggle .is-scrolling on the element */
```

---

## Collection Page — Full UI Inventory

### Top Nav Bar
Container: `px-8 py-3` · `bg-surface-900` · `border-b border-surface-600`

| Element | Classes / Notes |
|---------|----------------|
| Logo "POKEPRICE" | `text-2xl font-black tracking-widest text-accent` · subtitle `text-slate-500 text-xs tracking-wider mt-0.5` · `mr-2` right margin |
| Nav tab (each) | `px-4 py-2 rounded-lg border text-sm font-medium` · active: `bg-{color}-900/30 border-{color}-500 text-{color}-400` · inactive: `border-transparent text-slate-500` |
| Tab count badge | `text-xs px-2 py-0.5 rounded-full bg-surface-600 text-slate-400` (inactive: `bg-surface-700`) |
| Tab icons | `w-4 h-4` · `gap-2` from label |
| Banner search | `ml-6 h-[34px] px-3 text-sm bg-surface-800 border border-surface-600 rounded-lg w-64` |
| Refresh / My Account / Sign Out | `px-3 py-1.5 bg-surface-700 border border-surface-500 text-slate-300 text-sm font-medium rounded-lg` · `gap-2` icon+label |
| Icon-only buttons | `p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-700` |
| Alert badge (bell) | `absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-accent text-surface-900 text-[9px] font-bold rounded-full px-1` |

Tab colors by section:
- Collection: `text-emerald-400` · `bg-emerald-900/30 border-emerald-500`
- Watchlist: `text-sky-400` · `bg-sky-900/30 border-sky-500`
- Trade Analyzer: `text-rose-400` · `bg-rose-900/20 border-rose-500`
- Card Shows: `text-violet-400` · `bg-violet-900/30 border-violet-500`
- Pokédex: `text-red-400` · `bg-red-900/20 border-red-500`
- Advanced Search: `text-accent` · `bg-amber-900/20 border-accent`

---

### Portfolio Summary (6-tile grid)
Container: `grid grid-cols-3 gap-3 px-6 pb-2` · row height `132px`

| Element | Classes / Notes |
|---------|----------------|
| Widget tile | `bg-surface-800 border border-surface-600 rounded-xl p-2` · hover: `border-surface-500` |
| Widget left info panel | `w-32 flex-shrink-0 pl-3` |
| Widget label | `text-xs text-slate-500 uppercase tracking-wider font-medium mb-1` |
| Widget value | `text-2xl font-bold` (color varies: white / emerald / red) |
| Widget subtitle | `text-slate-400 text-xs mt-0.5` |
| Widget sparkline area | `flex-1 opacity-80` |
| Cards Tracked tile | `bg-surface-800 border border-surface-600 rounded-xl p-2 pl-5` · 3 sub-columns with `w-px bg-surface-600 mx-1` dividers |
| Alert filter buttons | `flex-1 flex flex-col items-center rounded-lg py-1` · active: `ring-1 ring-emerald-500/50 bg-emerald-900/20` / red variant |

---

### Controls Sub-bar
Container: `px-8 py-3 flex items-center gap-3`

| Element | Classes / Notes |
|---------|----------------|
| "My Collection" title | `text-white font-bold text-xl` |
| "+ Add to Collection" | `px-4 py-1.5 bg-accent text-black text-sm font-semibold rounded-lg` |
| "+ Add to Watchlist" | `px-4 py-1.5 bg-sky-600 text-white text-sm font-semibold rounded-lg` |
| "Bulk Edit" | `px-3 py-1.5 bg-red-900/30 border border-red-700/50 text-red-400 text-sm font-medium rounded-lg` |
| View toggle outer | `bg-surface-900 border border-surface-600 rounded-lg p-0.5` |
| View toggle buttons | `px-2.5 py-1 rounded-md text-xs font-medium` · active: `bg-surface-600 text-white` · inactive: `text-slate-500` |
| Filters button | `px-3 py-1.5 border text-sm font-medium rounded-lg bg-surface-700 border-surface-500 text-slate-300` · filter icon `w-3.5 h-3.5` |
| Filters dropdown | `absolute right-0 mt-1.5 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl p-4 w-72 space-y-3` |
| Filter section labels | `text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1.5` |
| Filter inputs/selects | `bg-surface-700 border border-surface-500 rounded-lg px-2 py-1.5 text-sm text-slate-300` |
| Export | `px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 text-sm font-medium rounded-lg` |
| Share | `px-3 py-1.5 bg-violet-500/10 border border-violet-500/50 text-violet-400 text-sm font-medium rounded-lg` |
| Divider below bar | `border-b border-surface-700 mx-6` |

---

### Section Collapse Headers
Outer margin: `mt-6 mb-2` · header: `w-full flex items-center gap-3 mb-3`

| Element | Classes / Notes |
|---------|----------------|
| Fill lines | `flex-1 h-px bg-surface-700` |
| Label | `text-slate-500 hover:text-slate-300 text-sm font-medium whitespace-nowrap` |
| Chevron | `w-3.5 h-3.5 transition-transform` · collapsed: `-rotate-90` |
| Count badge | `text-xs px-1.5 py-0.5 bg-surface-700 rounded-full text-slate-400` |

---

### Card Row — Detailed View
Container: `flex items-center gap-5 bg-surface-800 border border-surface-600 rounded-xl px-5 py-2 mb-3`
- Hover: `border-surface-500 bg-surface-700/50`
- Bulk selected: `border-red-500 bg-red-900/10`
- Column divider: `w-px h-10 bg-surface-600 rounded-full self-stretch flex items-center`

| Column | Width | Classes / Notes |
|--------|-------|----------------|
| Card image | `w-16` / `w-20` sealed | `self-stretch rounded-xl overflow-hidden border-2 border-transparent` · alert border: `border-emerald-400` or `border-red-400` · img: `h-full w-full object-contain group-hover:scale-105 transition-transform` |
| Card identity | `w-64` | `flex-shrink-0 flex flex-col justify-between self-stretch py-0.5` |
| Card name | — | `font-bold leading-tight text-white` · scaled 11–18px via FitText |
| Card number | — | `text-slate-500 text-xs flex-shrink-0` |
| Condition badge | — | `text-xs px-2 py-0.5 rounded-full font-semibold` · see Condition Badge Colors |
| "For Trade" badge | — | `text-[9px] font-bold uppercase px-1.5 py-[2px] rounded-full` · red glow inline style |
| Fav star | — | `text-yellow-400 text-sm` |
| Set line | — | `text-slate-400 text-xs truncate` |
| Date added | — | `text-slate-600 text-sm mt-1` · clickable inline editor |
| Binder pill (assigned) | — | `rounded-full bg-surface-700 border border-surface-600 text-xs text-slate-400 pl-2 pr-1 py-0.5` |
| Binder button (unassigned) | — | `text-xs px-2 py-0.5 rounded-full border border-dashed border-surface-500 text-slate-600` |
| Notes button | — | `text-xs px-2 py-0.5 rounded-full border` · amber tint when notes exist, else `bg-surface-700 border-surface-600 text-slate-400` |
| Price change stack | `w-28` | `flex-shrink-0 flex flex-col items-center justify-center gap-2` · 3× PriceChangeIndicator |
| Sparkline | flex-1 | `self-stretch min-h-0` with X-axis |
| Alert price section | `w-24` | `flex-shrink-0 space-y-2` · button: `w-full py-1 rounded-lg text-xs font-medium border` · amber tint when set |
| Pricing (portfolio) | `w-36` | `flex-shrink-0 text-right space-y-1.5` · labels `text-slate-500 text-xs` · values `font-bold text-xl` |
| Pricing (watchlist) | `w-36` | `flex-shrink-0 text-center` · market `text-accent font-bold text-3xl` · 30D avg `text-slate-500 text-xs mt-1` |
| Remove button | — | `text-slate-600 hover:text-red-400 text-xl` |
| Remove confirm popover | — | `absolute right-full mr-2 bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 flex items-center gap-2 shadow-xl whitespace-nowrap` |

---

### Card Row — Table (Compact) View
Container: `flex items-center gap-2.5 bg-surface-800 border border-surface-600 rounded-xl px-4 py-2 mb-2`
Column dividers: `w-px h-5 bg-surface-600 rounded-full flex-shrink-0`

| Column | Width | Classes / Notes |
|--------|-------|----------------|
| Thumbnail | `w-8 h-12` / `w-12 h-12` sealed | `flex-shrink-0 rounded overflow-hidden` |
| Identity | `w-52` | name `text-sm font-semibold text-white` · series `text-[11px] text-slate-500 mt-0.5` |
| Grade | `w-14` | condition `text-[10px] px-1.5 py-px rounded-full font-semibold` |
| 1D/1W/1M | `w-[252px]` | `flex gap-1.5` · each: `flex-1 text-xs font-semibold py-1 rounded text-center` with color bg |
| Sparkline | flex-1 min-w-[80px] | `h-12` |
| Alert price | `w-24` | label `text-[10px]` · value `text-lg font-bold` · clickable inline edit |
| Market price | `w-20` | label `text-[10px] text-slate-600 mb-2` · value `text-lg font-bold text-accent` |
| P&L | `w-20` | label `text-[10px] text-slate-600 mb-2` · value `text-lg font-bold` emerald/red |
| Bell icon | `w-8 h-8` | `flex items-center justify-center rounded-lg text-accent hover:bg-accent/10` |
| Remove | — | `text-slate-600 hover:text-red-400 text-xl` |

---

### Sold Card Row
Container: `flex items-center gap-4 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 mb-2`

| Element | Classes / Notes |
|---------|----------------|
| Thumbnail | `w-10 h-14 rounded overflow-hidden bg-surface-900 border border-surface-700` |
| Name column (`w-56`) | name `text-slate-300 font-semibold text-sm` · set `text-slate-600 text-xs truncate` |
| "Sold" badge | `text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-600/40 text-emerald-400` |
| "Traded" badge | `text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-900/40 border border-sky-600/40 text-sky-400` |
| Date | `text-slate-500 text-sm flex-1` |
| Sale Price (`w-28 text-right`) | label `text-slate-600 text-xs mb-0.5` · value `text-slate-300 font-bold text-sm` |
| P&L (`w-24 text-right`) | label `text-slate-600 text-xs mb-0.5` · value `font-bold text-sm` emerald/red |

---

### Empty State (card list)

| Element | Classes |
|---------|---------|
| Wrapper | `flex flex-col items-center justify-center py-12 text-slate-600` |
| Primary text | `text-base mb-1` |
| Sub text / CTA | `text-sm` · CTA word: `text-accent` (collection) or `text-sky-400` (watchlist) |

---

## Do / Don't

- **Depth via surface steps, not shadows.** Use `surface-700` on `surface-800` backgrounds. `shadow-2xl` is reserved for floating modals only.
- **Semi-transparent backgrounds for condition badges.** `bg-yellow-600/50` not `bg-yellow-600` — keeps the badge readable over any surface.
- **`transition-colors` on all interactive elements.** Not `transition-all` unless transform/opacity is also changing.
- **`text-black` on accent buttons.** The amber `accent` color is light; white text fails contrast.
- **Number inputs hide spinners.** `index.css` removes `-webkit-inner-spin-button` globally — don't fight it with custom styles.
- **Dashed empty states only when inviting action.** `border-2 border-dashed border-surface-600 rounded-xl` for dropzones. Use the solid centered layout for read-only empty lists.
- **Trade Analyzer uses `yellow-400` as its module accent.** CTAs, focus rings, and highlights inside TradeAnalyzer use `yellow-400 / yellow-300` instead of `accent` — intentional module differentiation, not a bug.
- **`progressBar` animation lives in `index.css`.** The indeterminate loading bar uses `animation: progressBar 1.4s ease-in-out infinite` — do not redefine it inline.
