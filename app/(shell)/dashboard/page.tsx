import Link from "next/link"
import { connection } from "next/server"
import { Btn, Card, Conf, Icon, Provider, StatusBadge, Tile, fmt, monogram } from "@/components/ui"
import { SyncAllButton, SyncButton } from "@/components/shell/SyncButtons"
import {
  getDashboardStats,
  getLocalUserId,
  listAccounts,
  listProviders,
  listSubscriptions,
  listSyncRuns,
  type LocalSubscription,
} from "@/lib/db/local"
import { buildBriefing } from "@/lib/ai/context"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

function monthlyTotal(subs: SubRow[]) {
  return subs
    .filter((s) => s.status === "active" && s.amount != null)
    .reduce((t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : s.amount ?? 0), 0)
}

function relTime(iso: string | null): { v: string; small?: string } {
  if (!iso) return { v: "—" }
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return { v: "now" }
  if (m < 60) return { v: String(m), small: "m ago" }
  const h = Math.round(m / 60)
  if (h < 24) return { v: String(h), small: "h ago" }
  return { v: String(Math.round(h / 24)), small: "d ago" }
}

export default async function DashboardPage() {
  await connection()
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const stats = getDashboardStats(userId)
  const subs = listSubscriptions(userId) as SubRow[]
  const accounts = listAccounts(userId)
  const runs = listSyncRuns(userId, 4)
  const briefing = buildBriefing(userId)

  const syncTargets = providers.filter((p) => p.status !== "error").map((p) => ({ id: p.id, email: p.email }))

  if (providers.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Dashboard</div>
            <h1 className="page-title">Your life, organized.</h1>
          </div>
        </div>
        <Card>
          <div className="empty">
            <span className="ico"><Icon name="mail" size={22} /></span>
            <h4>Connect your first inbox</h4>
            <p>LifeOS scans email metadata to surface subscriptions and accounts. Nothing happens until you connect an inbox — and it all stays on your machine.</p>
            <div className="btn-row mt14" style={{ justifyContent: "center" }}>
              <Link href="/connect"><Btn variant="primary" icon="connect">Connect Google</Btn></Link>
              <Link href="/connect"><Btn icon="mail">Manual IMAP</Btn></Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const activeSubs = subs.filter((s) => s.status === "active")
  const monthly = monthlyTotal(subs)
  const last = relTime(stats.lastSyncAt)

  const statCards = [
    { l: "Accounts connected", v: String(providers.length), ic: "mail", sub: `${providers.filter((p) => p.status === "active").length} active` },
    { l: "Emails scanned", v: stats.emailCount >= 1000 ? (stats.emailCount / 1000).toFixed(1) + "k" : String(stats.emailCount), ic: "search", sub: "across all inboxes" },
    { l: "Subscriptions", v: String(activeSubs.length), ic: "subs", sub: `${subs.length} detected` },
    { l: "Monthly spend", v: monthly > 0 ? "$" + Math.round(monthly) : "—", ic: "receipt", sub: monthly > 0 ? "$" + Math.round(monthly * 12).toLocaleString() + " / yr" : "no amounts detected" },
    { l: "Last sync", v: last.v, small: last.small, ic: "clock", sub: stats.syncing ? "syncing now" : "manual" },
  ]

  const insights = [
    ...briefing.dealFirst.slice(0, 2).map((i) => ({ priority: "now" as const, icon: "flag", tone: "warn", title: i.t, body: i.meta, action: "Review", to: "/subscriptions" })),
    ...briefing.canWait.slice(0, 1).map((i) => ({ priority: "wait" as const, icon: "clock", tone: "sync", title: i.t, body: i.meta, action: "View", to: "/subscriptions" })),
    ...briefing.ignore.slice(0, 1).map((i) => ({ priority: "ignore" as const, icon: "archive", tone: "idle", title: i.t, body: i.meta, action: "", to: "" })),
  ].slice(0, 4)

  const reviewSubs = subs.filter((s) => s.status === "unknown")
  const reviewAccts = accounts.filter((a) => a.status === "unknown")
  const errorProviders = providers.filter((p) => p.status === "error")
  const queue: Array<{ kind: string; title: string; desc: string; to: string }> = []
  if (reviewSubs.length) queue.push({ kind: "review", title: `Confirm ${reviewSubs.length} detected subscription${reviewSubs.length === 1 ? "" : "s"}`, desc: "Low-confidence matches need review", to: "/subscriptions" })
  if (reviewAccts.length) queue.push({ kind: "duplicate", title: `Review ${reviewAccts.length} discovered account${reviewAccts.length === 1 ? "" : "s"}`, desc: "Confirm or ignore detected sign-ups", to: "/accounts" })
  for (const p of errorProviders) queue.push({ kind: "error", title: `Fix connection: ${p.email}`, desc: p.error_message ?? "Sync failed — check credentials", to: "/connect" })
  if (queue.length === 0) queue.push({ kind: "review", title: "You're all caught up", desc: "No detections need your attention", to: "/subscriptions" })

  const queueColor = (k: string) => ({ review: "var(--st-warn)", trial: "var(--st-sync)", error: "var(--st-error)", duplicate: "var(--accent)" }[k] ?? "var(--ink-3)")
  const queueIcon = (k: string) => ({ review: "flag", trial: "clock", error: "alert", duplicate: "layers" }[k] ?? "info")

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <h1 className="page-title">Your life, organized.</h1>
          <p className="page-sub">A calm overview of every inbox, subscription, and account LifeOS has found.</p>
        </div>
        <div className="btn-row">
          <SyncAllButton targets={syncTargets} />
          <Link href="/connect"><Btn variant="primary" icon="plus">Connect inbox</Btn></Link>
        </div>
      </div>

      <div style={{ marginBottom: "var(--gap)" }}>
        <Card style={{ overflow: "hidden", borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border))" }}>
          <div className="card-head">
            <h3 className="center gap8"><Icon name="bolt" size={15} style={{ color: "var(--accent)" }} />Assistant briefing</h3>
            <Link href="/assistant"><Btn variant="ghost" size="xs" iconR="chevR">Open assistant</Btn></Link>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
            {insights.length === 0 ? (
              <div className="card-pad muted" style={{ fontSize: 12.5 }}>Nothing needs you right now — run a sync to scan for activity.</div>
            ) : insights.map((i, idx) => (
              <div key={idx} className="card-pad" style={{ borderRight: idx < insights.length - 1 ? "1px solid var(--border)" : 0, display: "flex", flexDirection: "column", gap: 9 }}>
                <div className="center gap8">
                  <span className="mono-tile sm" style={{ background: `var(--st-${i.tone}-bg)`, color: `var(--st-${i.tone})`, border: 0 }}><Icon name={i.icon} size={14} /></span>
                  <span className="badge outline" style={{ height: 18, fontSize: 9.5 }}>{i.priority === "now" ? "DEAL NOW" : i.priority === "wait" ? "CAN WAIT" : "IGNORE"}</span>
                </div>
                <div>
                  <div className="row-title" style={{ fontSize: 13 }}>{i.title}</div>
                  <div className="row-sub" style={{ marginTop: 3, lineHeight: 1.45 }}>{i.body}</div>
                </div>
                {i.action && i.to && (
                  <Link href={i.to} className="center gap6" style={{ color: "var(--accent)", fontWeight: 650, fontSize: 12, marginTop: "auto" }}>{i.action}<Icon name="chevR" size={13} /></Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {statCards.map((st) => (
          <Card key={st.l} className="stat">
            <span className="label"><Icon name={st.ic} size={13} />{st.l}</span>
            <span className="val">{st.v}{st.small && <small> {st.small}</small>}</span>
            <span className="delta">{st.sub}</span>
          </Card>
        ))}
      </div>

      <div className="grid mt18" style={{ gridTemplateColumns: "1.55fr 1fr", alignItems: "start" }}>
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head">
              <h3>Connected inboxes</h3>
              <Link href="/connect"><Btn variant="ghost" size="xs" iconR="chevR">Manage</Btn></Link>
            </div>
            <div className="list">
              {providers.map((ib) => {
                const syncing = ib.status === "syncing"
                return (
                  <div key={ib.id} className="list-row">
                    <Provider provider={ib.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="center gap8">
                        <span className="row-title ellip">{ib.email}</span>
                        <StatusBadge status={ib.status} pulse={syncing} />
                      </div>
                      <div className="row-sub">{ib.type.toUpperCase()} · <span className="mono">{ib.last_sync_at ? new Date(ib.last_sync_at).toLocaleDateString() : "never synced"}</span></div>
                    </div>
                    {ib.status === "error" ? (
                      <Link href="/connect"><Btn variant="danger" size="xs" icon="alert">Fix</Btn></Link>
                    ) : (
                      <SyncButton target={{ id: ib.id, email: ib.email }} />
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Detected subscriptions</h3>
              <Link href="/subscriptions"><Btn variant="ghost" size="xs" iconR="chevR">View all {subs.length}</Btn></Link>
            </div>
            <div className="list">
              {subs.slice(0, 5).map((sub) => (
                <Link key={sub.id} href="/subscriptions" className="list-row click">
                  <Tile mono={monogram(sub.company)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title">{sub.company}</div>
                    <div className="row-sub">{sub.category ?? "recurring"}{sub.email_used && <> · <span className="mono">{sub.email_used.split("@")[0]}@…</span></>}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {sub.amount != null ? (
                      <>
                        <div className="num" style={{ fontWeight: 600 }}>${fmt(sub.amount)}</div>
                        <div className="row-sub mono">/{sub.billing_cycle === "yearly" ? "yr" : "mo"}</div>
                      </>
                    ) : (
                      <StatusBadge status={sub.status} />
                    )}
                  </div>
                </Link>
              ))}
              {subs.length === 0 && <div className="card-pad muted" style={{ fontSize: 12.5 }}>No subscriptions detected yet.</div>}
            </div>
          </Card>
        </div>

        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head"><h3>Action queue</h3><span className="badge">{queue.length}</span></div>
            <div className="list">
              {queue.map((q, i) => (
                <Link key={i} href={q.to} className="list-row click">
                  <span className="mono-tile sm" style={{ background: queueColor(q.kind) + "1f", color: queueColor(q.kind), border: 0 }}>
                    <Icon name={queueIcon(q.kind)} size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title" style={{ fontSize: 12.5 }}>{q.title}</div>
                    <div className="row-sub">{q.desc}</div>
                  </div>
                  <Icon name="chevR" size={15} className="faint" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Recent sync activity</h3>
              <Link href="/inbox-sync"><Btn variant="ghost" size="xs" iconR="chevR">History</Btn></Link>
            </div>
            <div className="card-pad">
              {runs.length === 0 ? (
                <p className="muted" style={{ fontSize: 12.5 }}>No sync activity yet.</p>
              ) : (
                <div className="timeline">
                  {runs.map((a) => (
                    <div key={a.id} className={"tl-item" + (a.status === "success" ? " acc" : "")}>
                      <span className="tl-dot" style={a.status === "error" ? { borderColor: "var(--st-error)", background: "var(--st-error)" } : {}} />
                      <div className="tl-time">{new Date(a.started_at).toLocaleString()}</div>
                      <div className="tl-title">
                        {a.status === "error" ? "Sync failed" : "Sync complete"}
                        {a.status === "error" && <span className="badge error" style={{ marginLeft: 4 }}>error</span>}
                      </div>
                      <div className="tl-desc">{a.provider_name ?? a.provider_email}</div>
                      <div className="tl-desc">{a.error ?? `${a.emails_stored} stored · ${a.subscriptions_detected} subs · ${a.accounts_detected} accounts`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="section-label">Across your digital life</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="subs" size={14} className="muted" />Subscriptions to review</h3><span className="badge warn">{reviewSubs.length}</span></div>
          <div className="list">
            {reviewSubs.slice(0, 4).map((s) => (
              <Link key={s.id} href="/subscriptions" className="list-row click">
                <Tile mono={monogram(s.company)} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 12.5 }}>{s.company}</div>
                  <div className="row-sub ellip">{s.category ?? "recurring"}</div>
                </div>
                <Conf value={s.confidence ?? 0} />
              </Link>
            ))}
            {reviewSubs.length === 0 && <div className="card-pad muted" style={{ fontSize: 12.5 }}>Nothing to review.</div>}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="accounts" size={14} className="muted" />Accounts to review</h3><span className="badge warn">{reviewAccts.length}</span></div>
          <div className="list">
            {reviewAccts.slice(0, 4).map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="list-row click">
                <Tile mono={monogram(a.company)} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 12.5 }}>{a.company}</div>
                  <div className="row-sub ellip mono">{a.domain ?? a.email ?? ""}</div>
                </div>
                <Conf value={a.confidence ?? 0} />
              </Link>
            ))}
            {reviewAccts.length === 0 && <div className="card-pad muted" style={{ fontSize: 12.5 }}>Nothing to review.</div>}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="sync" size={14} className="muted" />Inbox health</h3><span className="badge">{providers.length}</span></div>
          <div className="list">
            {providers.slice(0, 4).map((p) => (
              <div key={p.id} className="list-row">
                <Provider provider={p.type} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title ellip" style={{ fontSize: 12.5 }}>{p.email}</div>
                  <div className="row-sub mono">{p.last_sync_at ? new Date(p.last_sync_at).toLocaleDateString() : "never synced"}</div>
                </div>
                <StatusBadge status={p.status} pulse={p.status === "syncing"} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
