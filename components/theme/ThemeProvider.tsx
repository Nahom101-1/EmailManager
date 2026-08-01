"use client"

import { createContext, useCallback, useContext, useState } from "react"

export type ThemeMode = "light" | "dark"
export type StyleMode = "flat" | "soft" | "grid"
export type Accent = "green" | "blue" | "violet" | "amber" | "graphite"
export type Density = "compact" | "cozy" | "comfy"
export type Layout = "cards" | "table"

export interface ThemeState {
  theme: ThemeMode
  style: StyleMode
  accent: Accent
  density: Density
  layout: Layout
}

const DEFAULTS: ThemeState = {
  theme: "light",
  style: "flat",
  accent: "green",
  density: "cozy",
  layout: "cards",
}

const ATTR: Record<keyof ThemeState, string | null> = {
  theme: "data-theme",
  style: "data-style",
  accent: "data-accent",
  density: "data-density",
  layout: null, // layout is app-level, not a CSS attribute
}

const STORAGE_KEY = "lifeos-theme"

interface ThemeContextValue extends ThemeState {
  set: <K extends keyof ThemeState>(key: K, value: ThemeState[K]) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// Inline script applied before paint to avoid a flash of the wrong theme.
export const themeNoFlashScript = `
(function(){try{
  var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");
  var d=document.documentElement;
  d.setAttribute("data-theme", s.theme||"light");
  d.setAttribute("data-style", s.style||"flat");
  d.setAttribute("data-accent", s.accent||"green");
  d.setAttribute("data-density", s.density||"cozy");
}catch(e){}})();
`

function readStoredTheme(): ThemeState {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Partial<ThemeState>
    return { ...DEFAULTS, ...saved }
  } catch {
    return DEFAULTS
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init avoids setState-in-effect; FOUC script already applied attrs.
  const [state, setState] = useState<ThemeState>(readStoredTheme)

  const set = useCallback(<K extends keyof ThemeState>(key: K, value: ThemeState[K]) => {
    setState((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      const attr = ATTR[key]
      if (attr) document.documentElement.setAttribute(attr, String(value))
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    set("theme", state.theme === "dark" ? "light" : "dark")
  }, [set, state.theme])

  return (
    <ThemeContext.Provider value={{ ...state, set, toggleTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
