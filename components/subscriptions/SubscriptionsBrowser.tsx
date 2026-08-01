"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, Conf, Icon, StatusBadge, Tile, fmt, monogram } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import type { LocalSubscription, SubscriptionStatus } from "@/lib/db/local"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

const FILTERS: Array<{ v: "all" | SubscriptionStatus; label: string }> = [
  { v: "all", label: "All" },
  { v: "unknown", label: "Needs review" },
  { v: "active", label: "Active" },
  { v: "cancelled", label: "Cancelled" },
  { v: "ignored", label: "Ignored" },
]

const PAGE_SIZE = 100

export function SubscriptionsBrowser({ subscriptions }: { subscriptions: SubRow[] }) {
  const router = useRouter()
  const { layout, set } = useTheme()
  const [filter, setFilter] = useState<"all" | SubscriptionStatus>("all")
  const [pending, setPending] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of subscriptions) m.set(s.status, (m.get(s.status) ?? 0) + 1)
    return m
  }, [subscriptions])

  const filtered = subscriptions.filter((s) => filter === "all" || s.status === filter)
  const shown = filtered.slice(0, visible)

  async function patch(id: string, payload: Record<string, string>) {
    setPending(id)
    try {
      await fetch(`/api/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
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
            const count = f.v === "all" ? subscriptions.length : counts.get(f.v) ?? 0
            return (
              <button key={f.v} className={"chip btn-chip" + (filter === f.v ? " on" : "")} onClick={() => { setFilter(f.v); setVisible(PAGE_SIZE) }}>
                {f.label}<span className="num faint" style={{ fontSize: 11 }}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="seg">
          {(["cards", "table"] as const).map((v) => (
            <button key={v} className={layout === v ? "on" : ""} onClick={() => { setVisible(PAGE_SIZE); set("layout", v) }}>{v === "cards" ? "Cards" : "Table"}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><div className="empty"><span className="ico"><Icon name="filter" size={20} /></span><h4>Nothing here</h4><p>No subscriptions match this filter.</p></div></Card>
      ) : layout === "cards" ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
          {shown.map((s) => (
            <Card key={s.id} className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div className="between" style={{ alignItems: "flex-start" }}>
                <div className="center gap10">
                  <Tile mono={monogram(s.company)} />
                  <div>
                    <div className="row-title">{s.company}</div>
                    <div className="row-sub mono">{s.category ?? "recurring"}</div>
                  </div>
                </div>
                <SubMenu id={s.id} disabled={pending === s.id} onPatch={patch} />
              </div>

              <div className="between" style={{ alignItems: "flex-end" }}>
                <div>
                  {s.amount != null ? (
                    <>
                      <span className="num" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.03em" }}>${fmt(s.amount)}</span>
                      <span className="faint mono" style={{ fontSize: 12 }}> /{s.billing_cycle === "yearly" ? "yr" : "mo"}</span>
                    </>
                  ) : (
                    <span className="faint mono" style={{ fontSize: 12 }}>amount not detected</span>
                  )}
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 11, display: "grid", gap: 7 }}>
                <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Email used</span><span className="v mono" style={{ fontSize: 11.5 }}>{s.email_used ?? s.sender_email ?? "—"}</span></div>
                <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Last seen</span><span className="v mono" style={{ fontSize: 11.5 }}>{s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}</span></div>
                <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Source · confidence</span><span className="v center gap8">{s.source && <span className="chip" style={{ height: 18, fontSize: 10.5 }}>{s.source}</span>}{s.confidence != null && <Conf value={s.confidence} />}</span></div>
              </div>

              {s.status !== "active" && (
                <div className="btn-row" style={{ gap: 7 }}>
                  <button className="btn sm" style={{ flex: 1 }} disabled={pending === s.id} onClick={() => patch(s.id, { status: "active" })}><Icon name="check" size={14} />Confirm active</button>
                  <button className="btn sm ghost" disabled={pending === s.id} onClick={() => patch(s.id, { status: "ignored" })}><Icon name="x" size={14} />Ignore</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Company</th><th>Amount</th><th>Email</th><th>Last seen</th><th>Source</th><th>Confidence</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td><div className="center gap8"><Tile mono={monogram(s.company)} size="sm" /><span style={{ fontWeight: 600 }}>{s.company}</span></div></td>
                    <td className="num text-r" style={{ fontWeight: 600 }}>{s.amount != null ? `$${fmt(s.amount)}` : "—"}</td>
                    <td className="num muted" style={{ fontSize: 11.5 }}>{s.email_used ?? s.sender_email ?? "—"}</td>
                    <td className="num muted">{s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}</td>
                    <td><span className="badge idle">{s.source ?? s.category ?? "—"}</span></td>
                    <td>{s.confidence != null ? <Conf value={s.confidence} /> : "—"}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}><SubMenu id={s.id} disabled={pending === s.id} onPatch={patch} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filtered.length > visible && (
        <div className="btn-row mt14" style={{ justifyContent: "center" }}>
          <button className="btn sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}
    </div>
  )
}

function SubMenu({ id, disabled, onPatch }: { id: string; disabled: boolean; onPatch: (id: string, p: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false)
  const items: Array<{ icon: string; label: string; payload: Record<string, string>; danger?: boolean }> = [
    { icon: "check", label: "Mark as active", payload: { status: "active" } },
    { icon: "cancel", label: "Mark as cancelled", payload: { status: "cancelled" } },
    { icon: "x", label: "Ignore", payload: { status: "ignored" }, danger: true },
  ]
  return (
    <div style={{ position: "relative" }}>
      <button className="btn ghost icon sm" disabled={disabled} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}><Icon name="dots" size={16} /></button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="card" style={{ position: "absolute", right: 0, top: 32, zIndex: 21, minWidth: 180, boxShadow: "var(--shadow-pop)", padding: 5 }}>
            {items.map((it) => (
              <button key={it.label} className="list-row click" style={{ width: "100%", border: 0, background: "none", padding: "7px 9px", borderRadius: "var(--radius-sm)", textAlign: "left", color: it.danger ? "var(--st-error)" : "var(--ink)", fontSize: 12.5, gap: 9 }}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPatch(id, it.payload) }}>
                <Icon name={it.icon} size={14} style={{ color: it.danger ? "var(--st-error)" : "var(--ink-3)" }} />{it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
