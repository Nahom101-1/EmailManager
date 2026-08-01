"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { Icon } from "@/components/ui"

interface SearchEmail {
  emailId: string
  subject: string | null
  snippet: string | null
  fromAddress: string | null
  date: string | null
  score: number
  source: string
  intent?: string | null
}

interface SearchEntity {
  kind: "subscription" | "account"
  id: string
  title: string
  meta: string
}

export function TopbarSearch() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [emails, setEmails] = useState<SearchEmail[]>([])
  const [entities, setEntities] = useState<SearchEntity[]>([])
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
          if (!res.ok) return
          const data = (await res.json()) as { emails: SearchEmail[]; entities: SearchEntity[] }
          setEmails(data.emails ?? [])
          setEntities(data.entities ?? [])
          setOpen(true)
        } catch {
          /* ignore */
        }
      })
    }, 220)

    return () => window.clearTimeout(handle)
  }, [query])

  function onQueryChange(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setEmails([])
      setEntities([])
    }
  }

  const hasResults = emails.length > 0 || entities.length > 0

  return (
    <div className="searchbox" ref={rootRef} style={{ position: "relative" }}>
      <Icon name="search" size={15} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search emails, subscriptions…"
        aria-label="Search"
      />
      <kbd>⌘K</kbd>
      {open && query.trim().length >= 2 && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 40,
            padding: 10,
            maxHeight: 360,
            overflow: "auto",
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          }}
        >
          {pending && (
            <div className="row-sub" style={{ padding: 6 }}>
              Searching…
            </div>
          )}
          {!pending && !hasResults && (
            <div className="row-sub" style={{ padding: 6 }}>
              No matches
            </div>
          )}
          {entities.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div className="side-label" style={{ margin: "4px 6px" }}>
                Subscriptions & accounts
              </div>
              {entities.map((e) => (
                <Link
                  key={`${e.kind}-${e.id}`}
                  href={e.kind === "subscription" ? "/subscriptions" : `/accounts/${e.id}`}
                  className="nav-item"
                  style={{ width: "100%" }}
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-ic">
                    <Icon name={e.kind === "subscription" ? "subs" : "accounts"} size={14} />
                  </span>
                  <div>
                    <div style={{ fontSize: 13 }}>{e.title}</div>
                    <div className="row-sub">{e.meta}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {emails.length > 0 && (
            <div>
              <div className="side-label" style={{ margin: "4px 6px" }}>
                Emails
              </div>
              {emails.map((e) => (
                <Link
                  key={e.emailId}
                  href={`/emails/${e.emailId}`}
                  className="nav-item"
                  style={{ width: "100%" }}
                  onClick={() => setOpen(false)}
                >
                  <span className="nav-ic">
                    <Icon name="sync" size={14} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.subject ?? "(no subject)"}
                    </div>
                    <div
                      className="row-sub"
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {(e.intent ? `${e.intent} · ` : "") + (e.fromAddress ?? "")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
