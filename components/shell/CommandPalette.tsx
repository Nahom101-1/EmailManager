"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui"
import { ALL_NAV } from "@/components/shell/nav"

interface SearchEmail {
  emailId: string
  subject: string | null
  fromAddress: string | null
  intent?: string | null
}

interface SearchEntity {
  kind: "subscription" | "account"
  id: string
  title: string
  meta: string
}

type PaletteItem =
  | { kind: "nav"; id: string; label: string; href: string; icon: string; hint?: string }
  | { kind: "entity"; id: string; label: string; href: string; icon: string; hint?: string }
  | { kind: "email"; id: string; label: string; href: string; icon: string; hint?: string }

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === "Escape" && open) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  if (!open) return null
  // Remount inner state each open — avoids reset-via-effect lint issues.
  return <CommandPalettePanel key="open" onOpenChange={onOpenChange} />
}

function CommandPalettePanel({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [emails, setEmails] = useState<SearchEmail[]>([])
  const [entities, setEntities] = useState<SearchEntity[]>([])
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return

    let cancelled = false
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`)
          if (!res.ok || cancelled) return
          const data = (await res.json()) as { emails: SearchEmail[]; entities: SearchEntity[] }
          if (cancelled) return
          setEmails(data.emails ?? [])
          setEntities(data.entities ?? [])
        } catch {
          /* ignore */
        }
      })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const navItems: PaletteItem[] = ALL_NAV.filter(
      (n) => !q || n.label.toLowerCase().includes(q) || n.href.includes(q)
    ).map((n) => ({
      kind: "nav",
      id: "nav-" + n.href,
      label: n.label,
      href: n.href,
      icon: n.icon,
      hint: n.goKey ? `g ${n.goKey}` : undefined,
    }))

    if (q.length < 2) return navItems

    const entityItems: PaletteItem[] = entities.map((e) => ({
      kind: "entity",
      id: `${e.kind}-${e.id}`,
      label: e.title,
      href: e.kind === "subscription" ? "/subscriptions" : `/accounts/${e.id}`,
      icon: e.kind === "subscription" ? "subs" : "accounts",
      hint: e.meta,
    }))

    const emailItems: PaletteItem[] = emails.map((e) => ({
      kind: "email",
      id: e.emailId,
      label: e.subject ?? "(no subject)",
      href: `/emails/${e.emailId}`,
      icon: "mail",
      hint: (e.intent ? `${e.intent} · ` : "") + (e.fromAddress ?? ""),
    }))

    return [...navItems, ...entityItems, ...emailItems]
  }, [query, emails, entities])

  const safeActive = items.length === 0 ? 0 : Math.min(active, items.length - 1)

  function onQueryChange(value: string) {
    setQuery(value)
    setActive(0)
    if (value.trim().length < 2) {
      setEmails([])
      setEntities([])
    }
  }

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <div
      className="cmdk-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActive((i) => Math.min(items.length - 1, i + 1))
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActive((i) => Math.max(0, i - 1))
          } else if (e.key === "Enter" && items[safeActive]) {
            e.preventDefault()
            go(items[safeActive].href)
          }
        }}
      >
        <div className="cmdk-input-row">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Go to… or search emails, money, accounts"
            aria-label="Command palette search"
          />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list" role="listbox">
          {pending && query.trim().length >= 2 && <div className="cmdk-empty">Searching…</div>}
          {!pending && items.length === 0 && <div className="cmdk-empty">No matches</div>}
          {items.map((item, i) => (
            <Link
              key={item.id}
              href={item.href}
              className={"cmdk-item" + (i === safeActive ? " on" : "")}
              role="option"
              aria-selected={i === safeActive}
              onMouseEnter={() => setActive(i)}
              onClick={() => onOpenChange(false)}
            >
              <span className="nav-ic">
                <Icon name={item.icon} size={14} />
              </span>
              <span className="cmdk-item-main">
                <span className="cmdk-item-label">{item.label}</span>
                {item.hint && <span className="cmdk-item-hint">{item.hint}</span>}
              </span>
              {item.kind === "nav" && item.hint && <kbd>{item.hint}</kbd>}
            </Link>
          ))}
        </div>
        <div className="cmdk-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>?</kbd> shortcuts
          </span>
        </div>
      </div>
    </div>
  )
}
