"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Icon } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import { SyncProvider } from "@/components/shell/SyncProvider"
import { CommandPalette } from "@/components/shell/CommandPalette"
import { KeyboardNav } from "@/components/shell/KeyboardNav"
import { ShortcutsHelp } from "@/components/shell/ShortcutsHelp"
import {
  ALL_NAV,
  MOBILE_TABS,
  PRIMARY_NAV,
  UTILITY_NAV,
  isNavActive,
  type NavItem,
} from "@/components/shell/nav"

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isNavActive(pathname, item)
  return (
    <Link
      href={item.href}
      className={"side-link" + (active ? " on" : "")}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className="side-link-ic" aria-hidden="true">
        <Icon name={item.icon} size={15} />
      </span>
      <span>{item.label}</span>
    </Link>
  )
}

export function AppShell({
  children,
  account,
}: {
  children: React.ReactNode
  counts: { subs: number; accounts: number }
  account: { name: string; sub: string; initials: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const openHelp = useCallback(() => setHelpOpen(true), [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const desktopPrimary = PRIMARY_NAV.filter((n) => n.desktop)
  const desktopUtility = UTILITY_NAV.filter((n) => n.desktop)
  const moreItems = ALL_NAV.filter((n) => n.more)

  return (
    <SyncProvider>
      <div className="app">
        <aside className="sidebar" aria-label="Primary">
          <Link href="/dashboard" className="brand side-brand">
            <span className="brand-mark">
              <Icon name="layers" size={15} />
            </span>
            <span className="brand-name">
              Life<b>OS</b>
            </span>
          </Link>

          <nav className="side-nav" aria-label="Main">
            {desktopPrimary.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="side-spacer" />

          <nav className="side-nav side-nav-utility" aria-label="Utility">
            {desktopUtility.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          <div className="side-account">
            <div className="side-account-mono" aria-hidden="true">
              {account.initials}
            </div>
            <div className="side-account-text">
              <div className="side-account-name">{account.name}</div>
              <div className="side-account-sub">{account.sub}</div>
            </div>
          </div>
        </aside>

        <div className="shell-body">
          <header className="topbar">
            <button
              type="button"
              className="searchbox searchbox-trigger"
              onClick={openPalette}
              aria-label="Open command palette"
            >
              <Icon name="search" size={15} />
              <span>Search or jump…</span>
              <kbd>⌘K</kbd>
            </button>

            <div className="topbar-spacer" />

            <button
              type="button"
              className="btn ghost sm icon"
              onClick={openHelp}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Icon name="info" size={15} />
            </button>

            <button
              type="button"
              className="btn ghost sm icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
            </button>

            <button
              type="button"
              className="btn ghost sm icon"
              onClick={logout}
              aria-label="Sign out"
            >
              <Icon name="logout" size={15} />
            </button>
          </header>

          <div className="main">
            <div className="scroll">{children}</div>
          </div>
        </div>

        <nav className="bottom-nav" aria-label="Mobile">
          {MOBILE_TABS.map((tab) => {
            if (tab.href === "#search") {
              return (
                <button
                  key="search"
                  type="button"
                  className="bottom-tab"
                  onClick={openPalette}
                  aria-label="Search"
                >
                  <Icon name="search" size={18} />
                  <span>Search</span>
                </button>
              )
            }
            if (tab.href === "#more") {
              return (
                <button
                  key="more"
                  type="button"
                  className={"bottom-tab" + (moreOpen ? " on" : "")}
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  aria-label="More"
                >
                  <Icon name="dots" size={18} />
                  <span>More</span>
                </button>
              )
            }
            const active = isNavActive(pathname, tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={"bottom-tab" + (active ? " on" : "")}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={tab.icon} size={18} />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </nav>

        {moreOpen && (
          <div
            className="more-sheet-backdrop"
            role="presentation"
            onMouseDown={() => setMoreOpen(false)}
          >
            <div
              className="more-sheet"
              role="dialog"
              aria-label="More navigation"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="more-sheet-head">More</div>
              {moreItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMoreOpen(false)}
                />
              ))}
            </div>
          </div>
        )}

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        <KeyboardNav onOpenPalette={openPalette} onOpenHelp={openHelp} />
      </div>
    </SyncProvider>
  )
}
