"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, Conf, Icon, StatusBadge, Tile, fmt, monogram } from "@/components/ui"
import { useTheme } from "@/components/theme/ThemeProvider"
import type { LocalSubscription, SubscriptionKind, SubscriptionStatus } from "@/lib/db/local"
import type { CompanyGroup, SubscriptionGroupInstance } from "@/lib/identity/groups"

type SubRow = LocalSubscription

/** Money view tabs (UI_UX_SPEC §6). Mailing lists stay separate from spend. */
type MoneyTab =
  | "active_paid"
  | "possibly_active"
  | "trials"
  | "price_changes"
  | "payment_failures"
  | "refunds"
  | "duplicates"
  | "mailing_lists"

const MONEY_TABS: Array<{ v: MoneyTab; label: string; ready: boolean }> = [
  { v: "active_paid", label: "Active paid", ready: true },
  { v: "possibly_active", label: "Possibly active", ready: true },
  { v: "trials", label: "Trials", ready: true },
  { v: "price_changes", label: "Price increases", ready: true },
  { v: "payment_failures", label: "Payment failures", ready: false },
  { v: "refunds", label: "Refunds", ready: false },
  { v: "duplicates", label: "Duplicates", ready: true },
  { v: "mailing_lists", label: "Mailing lists", ready: true },
]

export type MoneyTrialSignal = {
  emailId: string
  vendor: string | null
  due_date: string
}

export type MoneyPriceSignal = {
  emailId: string
  vendor: string
  previousAmount: number
  newAmount: number
  currency: string | null
}

const FILTERS: Array<{ v: "all" | SubscriptionStatus; label: string }> = [
  { v: "all", label: "All statuses" },
  { v: "unknown", label: "Needs review" },
  { v: "active", label: "Active" },
  { v: "cancelled", label: "Cancelled" },
  { v: "ignored", label: "Ignored" },
]

function subKind(s: {
  kind?: SubscriptionKind | null
  category?: string | null
}): SubscriptionKind {
  if (s.kind === "mailing_list" || s.kind === "paid") return s.kind
  return s.category === "newsletter" ? "mailing_list" : "paid"
}

const PAGE_SIZE = 100

function inboxLabel(s: SubRow): string {
  return s.provider_email ?? s.email_used ?? "—"
}

export function SubscriptionsBrowser({
  subscriptions,
  groups,
  inboxes,
  initialInbox = "all",
  trials = [],
  priceChanges = [],
}: {
  subscriptions: SubRow[]
  groups: CompanyGroup<SubscriptionGroupInstance>[]
  inboxes: string[]
  initialInbox?: string
  trials?: MoneyTrialSignal[]
  priceChanges?: MoneyPriceSignal[]
}) {
  const router = useRouter()
  const { layout, set } = useTheme()
  const [moneyTab, setMoneyTab] = useState<MoneyTab>("active_paid")
  const [filter, setFilter] = useState<"all" | SubscriptionStatus>("all")
  const [inbox, setInbox] = useState(initialInbox)
  const [grouped, setGrouped] = useState(inboxes.length >= 2)
  const [pending, setPending] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)

  const duplicateKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const g of groups) {
      if (g.instances.length > 1 || g.multiInbox) keys.add(g.key)
    }
    return keys
  }, [groups])

  const tabCounts = useMemo(() => {
    const m: Record<MoneyTab, number> = {
      active_paid: 0,
      possibly_active: 0,
      trials: trials.length,
      price_changes: priceChanges.length,
      payment_failures: 0,
      refunds: 0,
      duplicates: 0,
      mailing_lists: 0,
    }
    for (const s of subscriptions) {
      const kind = subKind(s)
      if (kind === "mailing_list") m.mailing_lists += 1
      else if (s.status === "active") m.active_paid += 1
      else if (s.status === "unknown") m.possibly_active += 1
    }
    for (const g of groups) {
      if (g.instances.length > 1 || g.multiInbox) {
        const paidInst = g.instances.filter((inst) => {
          const row = subscriptions.find((s) => s.id === inst.id)
          return row ? subKind(row) === "paid" : true
        })
        if (paidInst.length > 1 || (g.multiInbox && paidInst.length > 0)) m.duplicates += 1
      }
    }
    return m
  }, [subscriptions, groups, trials.length, priceChanges.length])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of subscriptions) {
      if (moneyTab === "mailing_lists" && subKind(s) !== "mailing_list") continue
      if (moneyTab !== "mailing_lists" && subKind(s) === "mailing_list") continue
      m.set(s.status, (m.get(s.status) ?? 0) + 1)
    }
    return m
  }, [subscriptions, moneyTab])

  function matchesMoneyTab(s: SubRow): boolean {
    const kind = subKind(s)
    switch (moneyTab) {
      case "mailing_lists":
        return kind === "mailing_list"
      case "active_paid":
        return kind === "paid" && s.status === "active"
      case "possibly_active":
        return kind === "paid" && s.status === "unknown"
      case "duplicates":
        if (kind !== "paid") return false
        return groups.some(
          (g) =>
            duplicateKeys.has(g.key) &&
            (g.instances.length > 1 || g.multiInbox) &&
            g.instances.some((i) => i.id === s.id)
        )
      case "trials":
      case "price_changes":
      case "payment_failures":
      case "refunds":
        return false
      default:
        return true
    }
  }

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      if (!matchesMoneyTab(s)) return false
      if (filter !== "all" && s.status !== filter) return false
      if (inbox !== "all") {
        const addr = (s.provider_email ?? s.email_used ?? "").toLowerCase()
        if (addr !== inbox.toLowerCase()) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesMoneyTab closes over moneyTab/groups
  }, [subscriptions, filter, inbox, moneyTab, groups, duplicateKeys])

  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        instances: g.instances.filter((inst) => {
          const row = subscriptions.find((s) => s.id === inst.id)
          if (!row) return false
          return matchesMoneyTab(row)
        }),
      }))
      .filter((g) => {
        if (g.instances.length === 0) return false
        if (moneyTab === "duplicates" && !(g.instances.length > 1 || g.multiInbox)) return false
        if (filter !== "all" && g.status !== filter) return false
        if (inbox !== "all") {
          if (!g.inboxes.some((e) => e.toLowerCase() === inbox.toLowerCase())) return false
        }
        return true
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, filter, inbox, moneyTab, subscriptions, duplicateKeys])

  const shown = filtered.slice(0, visible)
  const shownGroups = filteredGroups.slice(0, visible)

  async function patch(id: string, payload: Record<string, string>) {
    setPending(id)
    try {
      await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="btn-row mb14" style={{ gap: 7, flexWrap: "wrap" }} role="tablist" aria-label="Money views">
        {MONEY_TABS.map((f) => (
          <button
            key={f.v}
            role="tab"
            aria-selected={moneyTab === f.v}
            className={"chip btn-chip" + (moneyTab === f.v ? " on" : "")}
            onClick={() => {
              setMoneyTab(f.v)
              setVisible(PAGE_SIZE)
              if (f.v === "mailing_lists" || f.v === "active_paid" || f.v === "possibly_active") {
                setFilter("all")
              }
            }}
          >
            {f.label}
            <span className="num faint" style={{ fontSize: 11 }}>
              {f.ready ? tabCounts[f.v] : "—"}
            </span>
          </button>
        ))}
      </div>

      {!MONEY_TABS.find((t) => t.v === moneyTab)?.ready && (
        <div className="digest-row mb14">
          <span className="uncertain-chip">not detected yet</span>
          <span>
            Payment failures and refunds tabs are ready in the UI; rows appear when extraction
            covers those intents — we will not invent them.
          </span>
        </div>
      )}

      {moneyTab === "mailing_lists" && (
        <p className="page-sub" style={{ marginBottom: 14, marginTop: 0 }}>
          Mailing lists are separate from spend and never counted in monthly cost.
        </p>
      )}

      {moneyTab === "trials" && (
        <div className="focus-section-body mb14">
          {trials.length === 0 ? (
            <div className="digest-row">
              <span className="uncertain-chip">no trials in window</span>
              <span>No ending-trial signals in the next ~14 days from stored intelligence.</span>
            </div>
          ) : (
            trials.map((t) => (
              <Link key={t.emailId} href={`/emails/${t.emailId}`} className="digest-row">
                <strong>{t.vendor ?? "Unknown vendor"}</strong>
                <span className="muted">trial signal · due {t.due_date}</span>
                <span style={{ flex: 1 }} />
                <span className="muted">Evidence ▸</span>
              </Link>
            ))
          )}
        </div>
      )}

      {moneyTab === "price_changes" && (
        <div className="focus-section-body mb14">
          {priceChanges.length === 0 ? (
            <div className="digest-row">
              <span className="uncertain-chip">none observed</span>
              <span>No amount deltas between receipt/renewal extracts yet.</span>
            </div>
          ) : (
            priceChanges.map((p) => (
              <Link
                key={p.emailId + String(p.newAmount)}
                href={`/emails/${p.emailId}`}
                className="digest-row"
              >
                <strong>{p.vendor}</strong>
                <span className="muted">
                  {p.previousAmount} → {p.newAmount}
                  {p.currency ? ` ${p.currency}` : ""}
                </span>
                <span style={{ flex: 1 }} />
                <span className="muted">Evidence ▸</span>
              </Link>
            ))
          )}
        </div>
      )}

      {moneyTab !== "trials" &&
        moneyTab !== "price_changes" &&
        moneyTab !== "payment_failures" &&
        moneyTab !== "refunds" && (
        <>
      <div className="between mb14" style={{ alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div className="btn-row" style={{ gap: 7, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const count = f.v === "all" ? tabCounts[moneyTab] || filtered.length : (counts.get(f.v) ?? 0)
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
        <div className="btn-row" style={{ gap: 8 }}>
          {inboxes.length > 1 && (
            <div className="seg">
              <button className={!grouped ? "on" : ""} onClick={() => setGrouped(false)}>
                Flat
              </button>
              <button className={grouped ? "on" : ""} onClick={() => setGrouped(true)}>
                Grouped
              </button>
            </div>
          )}
          <div className="seg">
            {(["cards", "table"] as const).map((v) => (
              <button
                key={v}
                className={layout === v ? "on" : ""}
                onClick={() => {
                  setVisible(PAGE_SIZE)
                  set("layout", v)
                }}
              >
                {v === "cards" ? "Cards" : "Table"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {inboxes.length > 0 && (
        <div className="btn-row mb14" style={{ gap: 7, flexWrap: "wrap" }}>
          <button
            className={"chip btn-chip" + (inbox === "all" ? " on" : "")}
            onClick={() => {
              setInbox("all")
              setVisible(PAGE_SIZE)
            }}
          >
            All inboxes
          </button>
          {inboxes.map((email) => (
            <button
              key={email}
              className={"chip btn-chip" + (inbox === email ? " on" : "")}
              onClick={() => {
                setInbox(email)
                setVisible(PAGE_SIZE)
              }}
            >
              <Icon name="mail" size={11} />
              {email}
            </button>
          ))}
        </div>
      )}

      {grouped ? (
        filteredGroups.length === 0 ? (
          <Empty />
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}
          >
            {shownGroups.map((g) => {
              const amountInst = g.instances.find((i) => i.amount != null)
              return (
                <Card
                  key={g.key}
                  className="card-pad"
                  style={{ display: "flex", flexDirection: "column", gap: 13 }}
                >
                  <div className="between" style={{ alignItems: "flex-start" }}>
                    <div className="center gap10">
                      <Tile mono={monogram(g.company)} />
                      <div>
                        <div className="row-title">{g.company}</div>
                        <div className="row-sub mono">
                          {g.instances[0]?.category ?? "recurring"}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>

                  <div>
                    {amountInst?.amount != null ? (
                      <>
                        <span
                          className="num"
                          style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.03em" }}
                        >
                          ${fmt(amountInst.amount)}
                        </span>
                        <span className="faint mono" style={{ fontSize: 12 }}>
                          {" "}
                          /{amountInst.billingCycle === "yearly" ? "yr" : "mo"}
                        </span>
                      </>
                    ) : (
                      <span className="faint mono" style={{ fontSize: 12 }}>
                        amount not detected
                      </span>
                    )}
                  </div>

                  <div className="center gap6 wrap">
                    {g.multiInbox && (
                      <span className="chip" style={{ height: 22, fontSize: 11 }}>
                        <Icon name="layers" size={11} />
                        {g.inboxes.length} inboxes
                      </span>
                    )}
                    {g.instances.map((inst) => (
                      <span key={inst.id} className="chip" style={{ height: 22, fontSize: 11 }}>
                        <Icon name="mail" size={11} />
                        {inst.providerEmail ?? inst.emailUsed ?? "inbox"}
                        {inst.dueDate ? ` · due ${inst.dueDate}` : ""}
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <Empty />
      ) : layout === "cards" ? (
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}
        >
          {shown.map((s) => {
            const siblings = groups
              .find((g) => g.instances.some((i) => i.id === s.id))
              ?.instances.filter((i) => i.id !== s.id)
            return (
              <Card
                key={s.id}
                className="card-pad"
                style={{ display: "flex", flexDirection: "column", gap: 13 }}
              >
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <div className="center gap10">
                    <Tile mono={monogram(s.company)} />
                    <div>
                      <div className="row-title">{s.company}</div>
                      <div className="row-sub mono">
                        {subKind(s) === "mailing_list" ? "Email list" : (s.category ?? "paid plan")}
                      </div>
                    </div>
                  </div>
                  <SubMenu id={s.id} disabled={pending === s.id} onPatch={patch} />
                </div>

                <div className="between" style={{ alignItems: "flex-end" }}>
                  <div>
                    {subKind(s) === "mailing_list" ? (
                      <span className="chip" style={{ height: 22, fontSize: 11 }}>
                        <Icon name="mail" size={11} />
                        Mailing list
                      </span>
                    ) : s.amount != null ? (
                      <>
                        <span
                          className="num"
                          style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.03em" }}
                        >
                          ${fmt(s.amount)}
                        </span>
                        <span className="faint mono" style={{ fontSize: 12 }}>
                          {" "}
                          /{s.billing_cycle === "yearly" ? "yr" : "mo"}
                        </span>
                      </>
                    ) : (
                      <span className="faint mono" style={{ fontSize: 12 }}>
                        amount not detected
                      </span>
                    )}
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 11,
                    display: "grid",
                    gap: 7,
                  }}
                >
                  <div className="kv" style={{ padding: 0, border: 0 }}>
                    <span className="k">Inbox</span>
                    <span className="v mono" style={{ fontSize: 11.5 }}>
                      {inboxLabel(s)}
                    </span>
                  </div>
                  {s.due_date && (
                    <div className="kv" style={{ padding: 0, border: 0 }}>
                      <span className="k">Due</span>
                      <span className="v mono" style={{ fontSize: 11.5 }}>
                        {s.due_date}
                      </span>
                    </div>
                  )}
                  <div className="kv" style={{ padding: 0, border: 0 }}>
                    <span className="k">Last seen</span>
                    <span className="v mono" style={{ fontSize: 11.5 }}>
                      {s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <div className="kv" style={{ padding: 0, border: 0 }}>
                    <span className="k">Source · confidence</span>
                    <span className="v center gap8">
                      {s.source && (
                        <span className="chip" style={{ height: 18, fontSize: 10.5 }}>
                          {s.source}
                        </span>
                      )}
                      {s.confidence != null && <Conf value={s.confidence} />}
                    </span>
                  </div>
                  {siblings && siblings.length > 0 && (
                    <div className="kv" style={{ padding: 0, border: 0 }}>
                      <span className="k">Also on</span>
                      <span className="v mono" style={{ fontSize: 11.5 }}>
                        {siblings
                          .map((i) => i.providerEmail ?? i.emailUsed)
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {s.status !== "active" && (
                  <div className="btn-row" style={{ gap: 7 }}>
                    <button
                      className="btn sm"
                      style={{ flex: 1 }}
                      disabled={pending === s.id}
                      onClick={() => patch(s.id, { status: "active" })}
                    >
                      <Icon name="check" size={14} />
                      Confirm active
                    </button>
                    <button
                      className="btn sm ghost"
                      disabled={pending === s.id}
                      onClick={() => patch(s.id, { status: "ignored" })}
                    >
                      <Icon name="x" size={14} />
                      Ignore
                    </button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Amount</th>
                  <th>Inbox</th>
                  <th>Due</th>
                  <th>Last seen</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="center gap8">
                        <Tile mono={monogram(s.company)} size="sm" />
                        <span style={{ fontWeight: 600 }}>{s.company}</span>
                      </div>
                    </td>
                    <td className="num text-r" style={{ fontWeight: 600 }}>
                      {s.amount != null ? `$${fmt(s.amount)}` : "—"}
                    </td>
                    <td className="num muted" style={{ fontSize: 11.5 }}>
                      {inboxLabel(s)}
                    </td>
                    <td className="num muted">{s.due_date ?? "—"}</td>
                    <td className="num muted">
                      {s.last_seen ? new Date(s.last_seen).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <span className="badge idle">{s.source ?? s.category ?? "—"}</span>
                    </td>
                    <td>{s.confidence != null ? <Conf value={s.confidence} /> : "—"}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <SubMenu id={s.id} disabled={pending === s.id} onPatch={patch} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(grouped ? filteredGroups.length : filtered.length) > visible && (
        <div className="btn-row mt14" style={{ justifyContent: "center" }}>
          <button className="btn sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more ({(grouped ? filteredGroups.length : filtered.length) - visible} remaining)
          </button>
        </div>
      )}
        </>
      )}
    </div>
  )
}

function Empty() {
  return (
    <Card>
      <div className="empty">
        <span className="ico">
          <Icon name="filter" size={20} />
        </span>
        <h4>Nothing here</h4>
        <p>No subscriptions match this filter.</p>
      </div>
    </Card>
  )
}

function SubMenu({
  id,
  disabled,
  onPatch,
}: {
  id: string
  disabled: boolean
  onPatch: (id: string, p: Record<string, string>) => void
}) {
  const [open, setOpen] = useState(false)
  const items: Array<{
    icon: string
    label: string
    payload: Record<string, string>
    danger?: boolean
  }> = [
    { icon: "check", label: "Mark as active", payload: { status: "active" } },
    { icon: "cancel", label: "Mark as cancelled", payload: { status: "cancelled" } },
    { icon: "x", label: "Ignore", payload: { status: "ignored" }, danger: true },
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
              minWidth: 180,
              boxShadow: "var(--shadow-pop)",
              padding: 5,
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
                  onPatch(id, it.payload)
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
