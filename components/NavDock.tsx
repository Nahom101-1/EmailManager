"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Mail, Search, Settings, Zap } from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/connect", icon: Mail, label: "Connect" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/settings", icon: Settings, label: "Settings" },
]

export function NavDock() {
  const pathname = usePathname()

  return (
    <nav
      className="glass fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full px-3 py-2 flex items-center gap-1 shadow-float"
      style={{ minWidth: 320 }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 px-3 mr-2">
        <div className="w-6 h-6 bg-jet rounded-md flex items-center justify-center">
          <Zap size={13} className="text-cream" />
        </div>
        <span className="font-display font-800 text-sm tracking-tight text-jet">LifeOS</span>
      </Link>

      {/* Nav icons */}
      <div className="flex items-center gap-1 flex-1 justify-center">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
                active
                  ? "bg-jet text-cream"
                  : "text-neutral hover:bg-black/5 hover:text-jet"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            </Link>
          )
        })}
      </div>

      {/* CTA */}
      <Link href="/connect" className="btn-primary !py-2 !px-4 !text-xs ml-2 whitespace-nowrap">
        Connect →
      </Link>
    </nav>
  )
}
