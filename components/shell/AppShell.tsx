"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment } from "react"
import { Icon } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import { SyncProvider } from "@/components/shell/SyncProvider"
import { TopbarSearch } from "@/components/shell/TopbarSearch"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/assistant", label: "Assistant", icon: "bolt" },
  { href: "/connect", label: "Connect", icon: "connect" },
  { href: "/inbox-sync", label: "Inbox Sync", icon: "sync" },
  { href: "/subscriptions", label: "Subscriptions", icon: "subs", countKey: "subs" as const },
  { href: "/accounts", label: "Accounts", icon: "accounts", countKey: "accounts" as const },
  { href: "/settings", label: "Settings", icon: "settings" },
]

const CRUMBS: Record<string, string[]> = {
  "/dashboard": ["Dashboard"],
  "/assistant": ["Assistant"],
  "/connect": ["Connect"],
  "/inbox-sync": ["Inbox Sync"],
  "/subscriptions": ["Subscriptions"],
  "/accounts": ["Accounts"],
  "/settings": ["Settings"],
}

export function AppShell({
  children,
  counts,
  account,
}: {
  children: React.ReactNode
  counts: { subs: number; accounts: number }
  account: { name: string; sub: string; initials: string }
}) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()

  const crumbs =
    pathname.startsWith("/accounts/") && pathname !== "/accounts"
      ? ["Accounts", "Detail"]
      : (CRUMBS[pathname] ?? ["Dashboard"])

  return (
    <SyncProvider>
      <div className="app">
        <aside className="side">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Icon name="layers" size={16} />
            </span>
            <span className="brand-name">
              Life<b>OS</b>
            </span>
          </Link>
          <div className="side-label">Workspace</div>
          {NAV.map((n) => {
            const active =
              pathname === n.href || (n.href === "/accounts" && pathname.startsWith("/accounts/"))
            const count = n.countKey ? counts[n.countKey] : undefined
            return (
              <Link key={n.href} href={n.href} className={"nav-item" + (active ? " on" : "")}>
                <span className="nav-ic">
                  <Icon name={n.icon} size={16} />
                </span>
                {n.label}
                {count != null && <span className="nav-count">{count}</span>}
              </Link>
            )
          })}
          <div className="side-foot">
            <div
              className="notice accent"
              style={{ padding: "10px 11px", flexDirection: "column", gap: 7 }}
            >
              <div
                className="center gap6"
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  color: "var(--accent)",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name="lock" size={12} />
                Local-first
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>
                All data stays on this machine. Read-only access only.
              </div>
            </div>
            <Link href="/settings" className="side-acct">
              <span className="ava">{account.initials}</span>
              <div className="meta">
                <div className="n">{account.name}</div>
                <div className="s">{account.sub}</div>
              </div>
              <Icon name="settings" size={14} className="faint" style={{ marginLeft: "auto" }} />
            </Link>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="crumbs">
              <span>LifeOS</span>
              {crumbs.map((c, i) => (
                <Fragment key={i}>
                  <Icon name="chevR" size={13} />
                  <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
                </Fragment>
              ))}
            </div>
            <div className="topbar-spacer" />
            <TopbarSearch />
            <Link href="/assistant" className="btn ghost sm icon" aria-label="Assistant">
              <Icon name="bolt" size={15} />
            </Link>
            <button className="btn ghost sm icon" onClick={toggleTheme} aria-label="Toggle theme">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
            </button>
          </div>
          <div className="scroll">{children}</div>
        </div>
      </div>
    </SyncProvider>
  )
}
