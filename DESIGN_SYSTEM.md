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

### Section Header (inside a panel)
```
text-xs font-semibold text-slate-500 uppercase tracking-wider
```

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

### Standard Padding Values
| Context | Value |
|---------|-------|
| Modal header / tab bar | `px-5 py-4` or `px-6 py-5` |
| Modal body | `p-5` or `p-6` |
| Card / row item | `px-4 py-3` |
| Dense inputs | `px-3 py-1.5` |
| Micro badges | `px-2 py-0.5` |

### Gap Conventions
| Context | Value |
|---------|-------|
| Card grid sections | `gap-3` |
| Flex rows with icons | `gap-2` |
| Larger layout sections | `gap-4` – `gap-6` |

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

## Do / Don't

- **Depth via surface steps, not shadows.** Use `surface-700` on `surface-800` backgrounds. `shadow-2xl` is reserved for floating modals only.
- **Semi-transparent backgrounds for condition badges.** `bg-yellow-600/50` not `bg-yellow-600` — keeps the badge readable over any surface.
- **`transition-colors` on all interactive elements.** Not `transition-all` unless transform/opacity is also changing.
- **`text-black` on accent buttons.** The amber `accent` color is light; white text fails contrast.
- **Number inputs hide spinners.** `index.css` removes `-webkit-inner-spin-button` globally — don't fight it with custom styles.
