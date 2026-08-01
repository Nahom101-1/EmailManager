"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, Conf, Icon, StatusBadge, Tile, monogram } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import type { AccountStatus, LocalAccount } from "@/lib/db/local"

const FILTERS: Array<{ v: "all" | AccountStatus; label: string }> = [
  { v: "all", label: "All" },
  { v: "unknown", label: "Needs review" },
  { v: "active", label: "Active" },
  { v: "closed", label: "Closed" },
  { v: "ignore", label: "Ignored" },
]

const PAGE_SIZE = 100

export function AccountsBrowser({ accounts }: { accounts: LocalAccount[] }) {
  const router = useRouter()
  const { layout, set } = useTheme()
  const [filter, setFilter] = useState<"all" | AccountStatus>("all")
  const [pending, setPending] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of accounts) m.set(a.status, (m.get(a.status) ?? 0) + 1)
    return m
  }, [accounts])

  const filtered = accounts.filter((a) => filter === "all" || a.status === filter)
  const shown = filtered.slice(0, visible)

  async function setStatus(id: string, status: AccountStatus) {
    setPending(id)
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="between mb14" style={{ alignItems: "flex-start" }}>
        <div className="btn-row" style={{ gap: 7 }}>
          {FILTERS.map((f) => {
            const count = f.v === "all" ? accounts.length : (counts.get(f.v) ?? 0)
            return (
              <button
                key={f.v}
                className={"chip btn-chip" + (filter === f.v ? " on" : "")}
                onClick={() => {
                  setFilter(f.v)
                  setVisible(PAGE_SIZE)
                }}
              >
                {f.label}
                <span className="num faint" style={{ fontSize: 11 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <div className="seg">
          {(["cards", "table"] as const).map((v) => (
            <button key={v} className={layout === v ? "on" : ""} onClick={() => set("layout", v)}>
              {v === "cards" ? "Cards" : "Table"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="empty">
            <span className="ico">
              <Icon name="filter" size={20} />
            </span>
            <h4>Nothing here</h4>
            <p>No accounts match this filter.</p>
          </div>
        </Card>
      ) : layout === "cards" ? (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {shown.map((a) => (
            <Card
              key={a.id}
              className="card-pad"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div className="between" style={{ alignItems: "flex-start" }}>
                <Link href={`/accounts/${a.id}`} className="center gap10">
                  <Tile mono={monogram(a.company)} />
                  <div>
                    <div className="row-title">{a.company}</div>
                    <div className="row-sub mono ellip" style={{ maxWidth: "20ch" }}>
                      {a.email ?? a.domain ?? ""}
                    </div>
                  </div>
                </Link>
                <AcctMenu
                  id={a.id}
                  status={a.status}
                  disabled={pending === a.id}
                  onSet={setStatus}
                />
              </div>

              <div className="center gap8 wrap">
                <StatusBadge status={a.status} />
                {a.confidence != null && (
                  <span className="num faint" style={{ fontSize: 11 }}>
                    {Math.round(a.confidence * 100)}% match
                  </span>
                )}
              </div>

              {a.source && (
                <div
                  className="center gap6 wrap"
                  style={{ borderTop: "1px solid var(--border)", paddingTop: 11 }}
                >
                  <span className="chip" style={{ height: 22, fontSize: 11 }}>
                    <Icon name="shield" size={11} />
                    {a.source}
                  </span>
                  {a.domain && (
                    <span className="chip" style={{ height: 22, fontSize: 11 }}>
                      <Icon name="globe" size={11} />
                      {a.domain}
                    </span>
                  )}
                </div>
              )}

              <div className="between mono faint" style={{ fontSize: 11 }}>
                <span>
                  First {a.first_seen ? new Date(a.first_seen).toLocaleDateString() : "—"}
                </span>
                <span>Last {a.last_seen ? new Date(a.last_seen).toLocaleDateString() : "—"}</span>
              </div>

              {a.status === "unknown" && (
                <div className="btn-row" style={{ gap: 7 }}>
                  <button
                    className="btn sm"
                    style={{ flex: 1 }}
                    disabled={pending === a.id}
                    onClick={() => setStatus(a.id, "active")}
                  >
                    <Icon name="check" size={14} />
                    Confirm
                  </button>
                  <button
                    className="btn sm ghost"
                    disabled={pending === a.id}
                    onClick={() => setStatus(a.id, "ignore")}
                  >
                    <Icon name="x" size={14} />
                    Ignore
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Email</th>
                  <th>Domain</th>
                  <th>First seen</th>
                  <th>Last seen</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} onClick={() => router.push(`/accounts/${a.id}`)}>
                    <td>
                      <div className="center gap8">
                        <Tile mono={monogram(a.company)} size="sm" />
                        <span style={{ fontWeight: 600 }}>{a.company}</span>
                      </div>
                    </td>
                    <td className="num muted" style={{ fontSize: 11.5 }}>
                      {a.email ?? "—"}
                    </td>
                    <td className="muted">{a.domain ?? "—"}</td>
                    <td className="num muted">
                      {a.first_seen ? new Date(a.first_seen).toLocaleDateString() : "—"}
                    </td>
                    <td className="num muted">
                      {a.last_seen ? new Date(a.last_seen).toLocaleDateString() : "—"}
                    </td>
                    <td>{a.confidence != null ? <Conf value={a.confidence} /> : "—"}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <AcctMenu
                        id={a.id}
                        status={a.status}
                        disabled={pending === a.id}
                        onSet={setStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filtered.length > visible && (
        <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
          <button className="btn sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}
    </div>
  )
}

function AcctMenu({
  id,
  status,
  disabled,
  onSet,
}: {
  id: string
  status: AccountStatus
  disabled: boolean
  onSet: (id: string, s: AccountStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const items: Array<{ icon: string; label: string; status: AccountStatus; danger?: boolean }> = [
    {
      icon: "check",
      label: status === "active" ? "Marked active" : "Mark active",
      status: "active",
    },
    { icon: "lock", label: "Mark closed", status: "closed" },
    { icon: "x", label: "Ignore", status: "ignore", danger: true },
  ]
  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn ghost icon sm"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <Icon name="dots" size={16} />
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 20 }}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div
            className="card"
            style={{
              position: "absolute",
              right: 0,
              top: 32,
              zIndex: 21,
              minWidth: 168,
              boxShadow: "var(--shadow-pop)",
              padding: 5,
              overflow: "hidden",
            }}
          >
            {items.map((it) => (
              <button
                key={it.label}
                className="list-row click"
                style={{
                  width: "100%",
                  border: 0,
                  background: "none",
                  padding: "7px 9px",
                  borderRadius: "var(--radius-sm)",
                  textAlign: "left",
                  color: it.danger ? "var(--st-error)" : "var(--ink)",
                  fontSize: 12.5,
                  gap: 9,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onSet(id, it.status)
                }}
              >
                <Icon
                  name={it.icon}
                  size={14}
                  style={{ color: it.danger ? "var(--st-error)" : "var(--ink-3)" }}
                />
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
