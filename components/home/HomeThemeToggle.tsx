"use client"

import { Btn } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"

export function HomeThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return <Btn variant="ghost" size="sm" icon={theme === "dark" ? "sun" : "moon"} onClick={toggleTheme} aria-label="Toggle theme" />
}
