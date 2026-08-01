import Link from "next/link"
import { connection } from "next/server"
import { Btn, Card, Icon, Provider, StatusBadge } from "@/components/ui"
import { SyncAllButton, SyncButton } from "@/components/shell/SyncButtons"
import {
  countEmailsByProvider,
  countEmailsSince,
  getDashboardStats,
  getLocalUserId,
  listProviders,
  listSyncRuns,
  type LocalSyncRun,
} from "@/lib/db/local"

function runTitle(run: LocalSyncRun): string {
  if (run.status === "running") return "Sync in progress"
  if (run.status === "error") return "Sync failed"
  return "Sync complete"
}

function runDesc(run: LocalSyncRun): string {
  if (run.error) return run.error
  if (run.status === "running") return "Scan in progress…"
  return `${run.emails_seen.toLocaleString()} scanned · ${run.emails_stored.toLocaleString()} stored · ${run.subscriptions_detected} subs · ${run.accounts_detected} accounts`
}

export default async function InboxSyncPage() {
  await connection()
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const stats = getDashboardStats(userId)
  const runs = listSyncRuns(userId)
  const scannedByProvider = countEmailsByProvider(userId)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const newThisWeek = countEmailsSince(weekAgo, userId)
  const syncTargets = providers.filter((p) => p.status !== "error").map((p) => ({ id: p.id, email: p.email }))

  const statCards = [
    { l: "Messages scanned", v: stats.emailCount.toLocaleString(), ic: "search" },
    { l: "New this week", v: newThisWeek.toLocaleString(), ic: "arrowDown" },
    { l: "Subscriptions detected", v: String(stats.subscriptionCount), ic: "subs" },
    { l: "Accounts detected", v: String(stats.accountCount), ic: "accounts" },
  ]

  const grouped: Array<{ date: string; items: LocalSyncRun[] }> = []
  for (const run of runs) {
    const date = new Date(run.started_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    const bucket = grouped.find((g) => g.date === date)
    if (bucket) bucket.items.push(run)
    else grouped.push({ date, items: [run] })
  }

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Inbox Sync</div>
          <h1 className="page-title">Sync activity</h1>
          <p className="page-sub">Every scan, token refresh, and detection run across your connected inboxes.</p>
        </div>
        <SyncAllButton targets={syncTargets} variant="primary" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
        {statCards.map((s) => (
          <Card key={s.l} className="stat">
            <span className="label"><Icon name={s.ic} size={13} />{s.l}</span>
            <span className="val" style={{ fontSize: 22 }}>{s.v}</span>
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.4fr", alignItems: "start" }}>
        <Card>
          <div className="card-head"><h3>Inboxes</h3></div>
          {providers.length === 0 ? (
            <div className="empty">
              <span className="ico"><Icon name="mail" size={20} /></span>
              <h4>No inboxes connected</h4>
              <p>Connect an inbox to start scanning for subscriptions and accounts.</p>
              <div className="btn-row mt14" style={{ justifyContent: "center" }}>
                <Link href="/connect"><Btn variant="primary" icon="connect">Connect inbox</Btn></Link>
              </div>
            </div>
          ) : (
            <div className="list">
              {providers.map((ib) => {
                const syncing = ib.status === "syncing"
                return (
                  <div key={ib.id} className="list-row">
                    <Provider provider={ib.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="center gap8"><span className="row-title ellip" style={{ fontSize: 12.5 }}>{ib.email}</span><StatusBadge status={ib.status} pulse={syncing} /></div>
                      <div className="row-sub mono">{(scannedByProvider[ib.id] ?? 0).toLocaleString()} scanned · {ib.last_sync_at ? new Date(ib.last_sync_at).toLocaleDateString() : "never synced"}</div>
                    </div>
                    {ib.status === "error" ? (
                      <Link href="/connect"><Btn size="xs" variant="danger" icon="alert">Fix</Btn></Link>
                    ) : (
                      <SyncButton target={{ id: ib.id, email: ib.email }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-head"><h3>Activity log</h3><span className="sub">Most recent first</span></div>
          <div className="card-pad">
            {grouped.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>No sync activity yet. Run a sync to see it logged here.</p>
            ) : (
              grouped.map((group) => (
                <div key={group.date} style={{ marginBottom: 14 }}>
                  <div className="section-label" style={{ margin: "0 0 8px" }}>{group.date}</div>
                  <div className="timeline">
                    {group.items.map((run) => (
                      <div key={run.id} className={"tl-item" + (run.status === "success" ? " acc" : "")}>
                        <span className="tl-dot" style={run.status === "error" ? { borderColor: "var(--st-error)", background: "var(--st-error)" } : {}} />
                        <div className="tl-time">{new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        <div className="tl-title">{runTitle(run)} <span className="mono faint" style={{ fontWeight: 400, fontSize: 11 }}>· {run.provider_name ?? run.provider_email}</span></div>
                        <div className="tl-desc" style={run.error ? { color: "var(--st-error)" } : {}}>{runDesc(run)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
