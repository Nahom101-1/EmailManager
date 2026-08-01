# Design Tokens → Tailwind / Next.js

The design system is built on **CSS custom properties** so that light/dark, the
three visual styles, five accents, and three densities all switch via a
`data-*` attribute on `<html>` — no recompile, no class explosion. Tailwind maps
those variables to utility names.

> **Strategy:** keep `globals.css` (in this bundle) as the source of truth for
> token *values*. Tailwind only references the variables. This is the modern
> shadcn/ui pattern and plays perfectly with `next-themes`.

---

## 1. `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:            "var(--bg)",
        "bg-2":        "var(--bg-2)",
        surface:       "var(--surface)",
        "surface-2":   "var(--surface-2)",
        "surface-inset":"var(--surface-inset)",
        border:        "var(--border)",
        "border-strong":"var(--border-strong)",
        ink:           "var(--ink)",
        "ink-2":       "var(--ink-2)",
        "ink-3":       "var(--ink-3)",
        "ink-faint":   "var(--ink-faint)",
        accent:        "var(--accent)",
        "accent-press":"var(--accent-press)",
        "accent-soft": "var(--accent-soft)",
        "accent-ink":  "var(--accent-ink)",
        // status families: each has a fg + bg
        "st-active":   "var(--st-active)",   "st-active-bg": "var(--st-active-bg)",
        "st-sync":     "var(--st-sync)",     "st-sync-bg":   "var(--st-sync-bg)",
        "st-error":    "var(--st-error)",    "st-error-bg":  "var(--st-error-bg)",
        "st-warn":     "var(--st-warn)",     "st-warn-bg":   "var(--st-warn-bg)",
        "st-idle":     "var(--st-idle)",     "st-idle-bg":   "var(--st-idle-bg)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "var(--radius-sm)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop:  "var(--shadow-pop)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      spacing: {
        card: "var(--pad-card)",   // p-card  → density-aware card padding
        gap:  "var(--gap)",        // gap-gap  → density-aware grid gap
        row:  "var(--row-h)",      // h-row    → density-aware row height
      },
    },
  },
  plugins: [],
};
export default config;
```

Now you write `bg-surface text-ink border-border rounded-lg shadow-card p-card`
and everything stays theme- and density-reactive.

---

## 2. Fonts (Next.js `next/font`)

```ts
// src/app/layout.tsx
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

const sans = Hanken_Grotesk({ subsets: ["latin"], weight: ["400","500","600","700","800"], variable: "--font-sans-raw" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-mono-raw" });
```
Either map `--font-sans` to those variables, or keep the literal stacks in
`globals.css` (they already name the families). **Hanken Grotesk** for UI,
**JetBrains Mono** for *all data* — counts, money, timestamps, IDs, status.

---

## 3. Theme switching

Use `next-themes` with `attribute="data-theme"`, then a small client store
(Zustand or context) for `style` / `accent` / `density`, each writing its own
`data-*` attribute to `document.documentElement`. The prototype's **Tweaks
panel** demonstrates the exact toggles — these become a real Settings →
Appearance section (already designed in `screens-settings.jsx`).

```ts
// applies the four switches
const root = document.documentElement;
root.setAttribute("data-theme",  dark ? "dark" : "light");
root.setAttribute("data-style",  style);    // flat | soft | grid
root.setAttribute("data-accent", accent);   // green | blue | violet | amber | graphite
root.setAttribute("data-density",density);  // compact | cozy | comfy
```

To avoid a flash on load, set the attributes in a tiny inline script in
`<head>` (or use `next-themes`' built-in handling) reading from `localStorage`.

---

## 4. Token reference (resolved values)

### Typography scale
| Use | Size | Weight | Notes |
|---|---|---|---|
| Page title | 27px (23 compact) | 700 | letter-spacing −.025em |
| Home promise | 44px (38 compact) | 700 | −.035em |
| Card heading (`h3`) | 13.5px | 650 | −.01em |
| Body / base | 13.5px (density var) | 400–500 | line-height 1.45 |
| Stat value | 26px (22 compact) | 600 | **mono**, −.03em |
| Data / meta | 12.5px | — | **mono**, tnum |
| Eyebrow / label | 11px | 600 | uppercase, .1em, **mono** |

### Radii (per visual style)
| Token | flat | soft | grid |
|---|---|---|---|
| `--radius-sm` | 5 | 8 | 2 |
| `--radius` | 8 | 12 | 3 |
| `--radius-lg` | 11 | 16 | 4 |

### Density
| Token | compact | cozy | comfy |
|---|---|---|---|
| `--row-h` | 32 | 38 | 46 |
| `--pad-card` | 13 | 17 | 22 |
| `--gap` | 10 | 14 | 18 |

### Status color semantics
| Family | Meaning | Used by |
|---|---|---|
| `active` (green) | healthy / confirmed / paid | inbox active, sub active, low risk |
| `sync` (blue) | in-progress / informational | syncing, "can wait" |
| `error` (red) | failure / high risk | IMAP error, high risk, overdue |
| `warn` (amber) | needs attention / uncertain | needs-review, unknown, trial ending |
| `idle` (gray) | inactive / neutral | cancelled, inactive, pending |

All accents share one chroma/lightness and vary only in hue — keep that rule if
you add accents. Whites/blacks are cool-tinted (hue 250–255, chroma ≤ 0.012);
never use pure `#fff` / `#000` for surfaces.

---

## 5. What NOT to copy verbatim
- The reference `*.jsx` files run on **in-browser Babel** and attach components
  to `window`. That's a prototyping shim — rebuild them as real ESM modules
  with `import`/`export` and `"use client"` where they hold state.
- `data.js` is mock data. Use `types.ts` as the contract and fetch real data.
- `window.claude.complete` is the prototype's AI helper — replace with your
  own route handler (see README → AI Integration).
