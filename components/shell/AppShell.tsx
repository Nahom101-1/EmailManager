"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import { SyncProvider } from "@/components/shell/SyncProvider"
import { TopbarSearch } from "@/components/shell/TopbarSearch"

const TABS = [
  { href: "/dashboard", label: "Today" },
  { href: "/emails", label: "Emails" },
  { href: "/subscriptions", label: "Money" },
  { href: "/accounts", label: "Accounts" },
  { href: "/assistant", label: "Ask" },
]

export function AppShell({
  children,
}: {
  children: React.ReactNode
  counts: { subs: number; accounts: number }
  account: { name: string; sub: string; initials: string }
}) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  return (
    <SyncProvider>
      <div className="app">
        <div className="topbar">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">
              <Icon name="layers" size={15} />
            </span>
            <span className="brand-name">
              Life<b>OS</b>
            </span>
          </Link>

          {TABS.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/dashboard" && pathname.startsWith(tab.href))
            return (
              <Link key={tab.href} href={tab.href} className={"tab-link" + (active ? " on" : "")}>
                {tab.label}
              </Link>
            )
          })}

          <div className="topbar-spacer" />

          <TopbarSearch />

          <Link href="/settings" className="btn ghost sm icon" aria-label="Settings">
            <Icon name="settings" size={15} />
          </Link>

          <button className="btn ghost sm icon" onClick={toggleTheme} aria-label="Toggle theme">
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
        </div>

        <div className="main">
          <div className="scroll">{children}</div>
        </div>
      </div>
    </SyncProvider>
  )
}
