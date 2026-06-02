---
name: PokePrice
description: Desktop-native portfolio tracker and price intelligence tool for Pokemon card collectors and resellers.
colors:
  void: "#0f1117"
  deep-panel: "#161b27"
  raised-panel: "#1e2535"
  divider: "#252d3d"
  border: "#2e3850"
  ink: "#e2e8f0"
  ink-muted: "#94a3b8"
  amber-signal: "#f59e0b"
  amber-signal-hover: "#fbbf24"
  gain: "#34d399"
  loss: "#f87171"
  section-collection: "#34d399"
  section-watchlist: "#38bdf8"
  section-trade: "#fde047"
  section-cardshows: "#a78bfa"
  section-pokedex: "#f87171"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  data:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.amber-signal}"
    textColor: "{colors.void}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.amber-signal-hover}"
    textColor: "{colors.void}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.deep-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  chip-condition-raw:
    backgroundColor: "#334155"
    textColor: "#cbd5e1"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  chip-condition-psa10:
    backgroundColor: "rgba(202,138,4,0.3)"
    textColor: "#fef08a"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  input-default:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-focus:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: PokePrice

## 1. Overview

**Creative North Star: "The Collector's Terminal"**

PokePrice is a Bloomberg terminal built by someone who genuinely loves their collection. The design carries two things simultaneously: financial-grade precision and the warmth of a person who has opinions about card condition and set history. It is not a generic portfolio dashboard that happens to track cards. It is a specialized instrument where every surface is optimized for the moment a collector opens it to check whether to buy, hold, or sell.

The visual language is deliberate dark-mode density. Deep navy backgrounds (void at `#0f1117`, surfaces stepping up through `#161b27` to `#2e3850`) create the low-ambient-light feel of a trading station. The amber accent (`#f59e0b`) is the only warm signal in a cool room, appearing exclusively on primary actions and the active nav item. Its restraint is the design: if amber is everywhere, the interface loses its ability to say "this is the thing to press."

Section identity is expressed through a deliberate per-tab color vocabulary: each major section (Collection, Watchlist, Trade Analyzer, Card Shows, Pokédex) has its own hue, used on the active tab label and a faint tinted background. This is a navigation aid, not decoration. The system explicitly rejects the hobbyist-blog aesthetic (clipart, pixel fonts, busy backgrounds), the generic SaaS dashboard (cream backgrounds, teal accents, identical card-grid layouts), and anything that reads as childlike or unserious about the financial dimension of card collecting.

**Key Characteristics:**
- Dark, data-dense, instrument-grade — not decorative
- Amber accent used with surgical rarity; color earns its presence
- Section-aware hue vocabulary for orientation, not for delight
- Tonal layering replaces shadows; depth is distance, not dramatics
- System font throughout: legibility and speed over typographic personality
- Semantic color for gain/loss: emerald for positive, red for negative, consistent everywhere

## 2. Colors: The Deep Navy Ramp

A restrained palette: five surface steps, one warm signal, two semantic states, and a section-identity vocabulary used only in navigation.

### Primary
- **Amber Signal** (`#f59e0b`): The only warm color in the system. Used exclusively on the primary action button and the active navigation state. Its presence means "this is the action" or "you are here." Never used decoratively.
- **Amber Signal Hover** (`#fbbf24`): Brighter amber at hover and focus states. Slightly warmer, lighter. The only permitted variant of the accent.

### Neutral
- **Void** (`#0f1117`): Root background. The deepest surface, behind everything. Also used as the text color on primary amber buttons (dark text on light bg for contrast).
- **Deep Panel** (`#161b27`): Card backgrounds, side panels, primary content containers. The most common surface users look at.
- **Raised Panel** (`#1e2535`): Tooltips, modals, elevated overlays. Lifted above Deep Panel by ~1 tone step.
- **Divider** (`#252d3d`): Section boundaries, sub-panel walls. Subtle enough to recede.
- **Border** (`#2e3850`): Scrollbar thumbs, component outlines, explicit divider lines. The lightest neutral that reads as a deliberate edge.
- **Ink** (`#e2e8f0`): Primary text. Light cool-slate against the navy backgrounds. Designed to read without strain in a dark environment.
- **Ink Muted** (`#94a3b8`): Secondary text, metadata labels, placeholder content. Must never be used on Deep Panel backgrounds without checking contrast.

### Secondary (Semantic)
- **Gain** (`#34d399`): Positive price movement. Emerald-400. Used on price change indicators, positive delta percentages. Never used outside semantic context.
- **Loss** (`#f87171`): Negative price movement. Red-400. Used symmetrically with Gain. Never decorative.

### Tertiary (Section Identity)
Used only in tab navigation: the active tab label color and a faint tinted active background. Not permitted elsewhere in the UI.

- **Collection** (`#34d399`): Emerald. Shares the Gain hue intentionally; collection health is a positive signal.
- **Watchlist** (`#38bdf8`): Sky blue. Attentive, tracking.
- **Trade Analyzer** (`#fde047`): Yellow. Active, decision-oriented.
- **Card Shows** (`#a78bfa`): Violet. Event, community.
- **Pokédex** (`#f87171`): Red. Reference, canonical.

### Named Rules
**The Amber Rarity Rule.** Amber appears on one primary button and the active navigation state per screen. If a second amber element appears, one of them is wrong. Rarity is the mechanism that makes amber mean something.

**The Section-Scoped Color Rule.** Section identity colors (emerald, sky, yellow, violet, red) are permitted only on navigation tab labels and their active background tints. Using a section color inside the content area of a different section is forbidden.

## 3. Typography

**Body / UI Font:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif (system UI stack)
**No display or decorative typeface.**

**Character:** The system font stack is a deliberate choice, not a default. In a dense, data-heavy tool, system fonts render at native quality at every size, load instantly, and feel at home on the OS. Adding a web font for personality would slow startup and introduce a visual gap between OS chrome and app content. The legibility and spacing of system UI is the typographic personality.

### Hierarchy

- **Data** (700, 1.25rem, line-height 1.2, letter-spacing -0.02em): Large price figures, portfolio totals, key metrics. The most visually prominent text on any screen.
- **Display** (600, 1.25rem, line-height 1.3, letter-spacing -0.01em): Section titles, modal headings, page-level labels.
- **Headline** (600, 1rem, line-height 1.4): Card names in detail view, major subsection headers.
- **Title** (500, 0.875rem, line-height 1.4): Panel headers, group labels, column headings in data tables.
- **Body** (400, 0.875rem, line-height 1.5): Set names, metadata, descriptive text. Data tables can exceed 65ch; descriptive prose caps at 65ch.
- **Label** (500, 0.75rem, line-height 1.3, letter-spacing 0.01em): Condition chips, badges, status indicators, small UI controls.

### Named Rules
**The No-Display-Font Rule.** No decorative or display typefaces in the UI. Labels, buttons, data cells, navigation items: all system UI. This is a tool, not a brand page.

**The Data-Weight Rule.** Price figures always use weight 700 and letter-spacing -0.02em. Anything less reads as a default, not a deliberate choice.

## 4. Elevation

PokePrice uses tonal layering, not shadows. Depth is communicated by surface color: elements higher in the visual stack use a lighter surface step. Shadows do not appear in the resting state of any component.

The surface ramp is the elevation system: `void (#0f1117)` → `deep-panel (#161b27)` → `raised-panel (#1e2535)` → `divider (#252d3d)` → `border (#2e3850)`. Each step is approximately one perceptual unit lighter than the previous. Content panels sit on deep-panel. Tooltips and modals use raised-panel. Component outlines use border.

### Named Rules
**The Flat-By-Default Rule.** No `box-shadow` at rest on any component. Shadows, if ever introduced, appear only as a response to drag state or z-axis elevation (a floating modal). A component that is visually flat but functionally elevated uses a border, not a shadow.

## 5. Components

### Buttons
- **Shape:** Gently rounded edges (4px radius). Enough to soften, not enough to feel casual.
- **Primary:** Amber Signal background (`#f59e0b`), Void text (`#0f1117`), padding 8px 16px. Dark text on amber ensures contrast without needing a border.
- **Primary Hover:** Brightens to Amber Signal Hover (`#fbbf24`). Instant, no transition delay. Users in flow don't want choreography.
- **Ghost / Secondary:** Transparent background, Ink text. On hover: Deep Panel background appears. Used for secondary actions and destructive confirmations.
- **Focus:** A faint amber ring (`outline: 2px solid #f59e0b; outline-offset: 2px`) on keyboard focus. Never suppressed.

### Chips (Condition Badges)
- **Raw:** Slate-700 background (`#334155`), slate-300 text (`#cbd5e1`). Neutral grade, neutral color.
- **PSA 10 / CGC 10:** Warm amber-tinted background (`rgba(202,138,4,0.3)`), yellow-200 text (`#fef08a`), with a subtle ring (`ring-1 ring-yellow-500/40`). Gold-grade card, gold-signal badge.
- **PSA 9 / CGC 9:** Zinc-500 tint (`rgba(113,113,122,0.3)`), zinc-100 text. Strong but not gold.
- **PSA 8:** Orange-tinted background, orange-300 text. Slightly compromised.
- **Shape:** 4px radius, padding 2px 8px. Dense and legible.

### Cards / Containers
- **Corner Style:** 8px radius (rounded-lg). Containers feel deliberate without being overly soft.
- **Background:** Deep Panel (`#161b27`). One step above the page background.
- **Shadow Strategy:** None. Tonal layering handles elevation; see Elevation section.
- **Border:** `1px solid #2e3850` on container edges. Present but subtle.
- **Internal Padding:** 12px (md) for compact panels; 16px (lg) for content cards.

### Inputs / Fields
- **Style:** Raised Panel background (`#1e2535`), 4px radius, 1px Border outline at rest.
- **Focus:** Border color shifts to Amber Signal (`#f59e0b`), 1px. Clean, unambiguous, consistent with the button focus ring.
- **Placeholder text:** Ink Muted (`#94a3b8`). Must maintain at least 3:1 contrast against Raised Panel background.
- **Error state:** Border shifts to Loss red (`#f87171`), with a short error label below in Loss color.
- **Disabled:** Opacity 0.5. No interaction.

### Navigation (Tabs)
- **Default tab:** Ink Muted label (`#94a3b8`), transparent background.
- **Active tab:** Section identity color for the label. Section identity color at 20-30% opacity for the background tint. A 1px border in the section identity color at the active edge. No amber; section identity colors carry this role exclusively.
- **Hover:** Ink text (`#e2e8f0`), faint Deep Panel background. Does not pre-show the active color.

### Price Change Indicator (Signature Component)
A compact inline data component that displays a percentage delta with directional color and a small arrow. Gain values render in emerald-400 (`#34d399`) with an up-arrow; loss values in red-400 (`#f87171`) with a down-arrow; flat or no-data in Ink Muted. The color is the signal; no additional labeling is needed. Used in card rows, summary panels, and tooltips.

### Sparkline (Signature Component)
A minimal area chart (Recharts `AreaChart`) used inside card rows and portfolio summary panels to show 90-day price history. Stroke color matches the section's identity color or the amber accent. Fill is a semi-transparent gradient from stroke to transparent. No axes, no labels, no gridlines. Data is the entire visual. When no data is available, a placeholder wave renders in surface colors to preserve spatial rhythm without implying false information.

## 6. Do's and Don'ts

### Do:
- **Do** use Amber Signal (`#f59e0b`) exclusively on primary action buttons and the active navigation state. Amber is the rarest color in the system; its rarity is its power.
- **Do** use the surface ramp for depth: Void → Deep Panel → Raised Panel → Divider → Border. Tonal elevation only; no shadows at rest.
- **Do** use Gain (`#34d399`) and Loss (`#f87171`) symmetrically and exclusively for price movement. These semantic colors must not appear in any other context.
- **Do** use system font weight 700 and letter-spacing -0.02em for all price figures and key metrics. Numbers need visual authority.
- **Do** include hover, focus, active, disabled, and error states for every interactive component before shipping.
- **Do** keep section identity colors (emerald, sky, yellow, violet, red) strictly inside the tab navigation system.

### Don't:
- **Don't** use amber as a decorative color, highlight, or text color. If amber appears outside a primary button or active tab, remove it.
- **Don't** use `box-shadow` at rest on any component. Tonal surface steps handle elevation.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. Rewrite with a background tint or full border.
- **Don't** apply section identity colors inside the content area of a different section (no emerald in the Watchlist panel, no violet in the Collection view).
- **Don't** use a warm, cream, or sand background. The dark navy system is the identity; a light-mode variant would require a full redesign to preserve the Collector's Terminal character.
- **Don't** use a web display font in the UI. The system font stack is the deliberate choice.
- **Don't** add gradient fills to text. Price figures and labels use a single solid color.
- **Don't** build identical icon-plus-heading card grids for content that isn't genuinely card-shaped. Lists, rows, and panels are often the right answer.
- **Don't** let the UI look like a fan site: no Pokemon card clipart in the chrome, no pixel or display fonts in UI controls, no busy patterned backgrounds.
- **Don't** ship a loading state with a centered spinner over a blank surface. Skeleton states in the surface ramp colors preserve spatial rhythm.
