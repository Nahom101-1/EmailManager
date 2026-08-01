import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon, StatusBadge, Tile, fmt, monogram } from "@/components/ui"
import { SyncAllButton } from "@/components/shell/SyncButtons"
import { InboxSyncActions } from "@/components/shell/InboxSyncActions"
import {
  getDashboardStats,
  getLocalUserId,
  listProviders,
  listSubscriptions,
  reclaimStaleSyncRuns,
  type LocalSubscription,
} from "@/lib/db/local"
import { buildBriefing } from "@/lib/ai/context"
import { getUpcomingBills } from "@/lib/db/intelligence"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

const R: React.CSSProperties = { borderRadius: "var(--radius)" }
const R_TOP: React.CSSProperties = { borderRadius: "var(--radius) var(--radius) 0 0" }
const R_MID: React.CSSProperties = { borderRadius: 0 }
const R_BOT: React.CSSProperties = { borderRadius: "0 0 var(--radius) var(--radius)" }

function rowRadius(i: number, total: number): React.CSSProperties {
  if (total === 1) return R
  if (i === 0) return R_TOP
  if (i === total - 1) return R_BOT
  return R_MID
}

export default async function DashboardPage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const stats = getDashboardStats(userId)
  const subs = listSubscriptions(userId) as SubRow[]
  const briefing = buildBriefing(userId)
  const bills = getUpcomingBills(30)

  if (providers.length === 0) {
    return (
      <div className="page fade-in">
        <p className="page-eyebrow">Today</p>
        <h1 className="page-title">Welcome to LifeOS.</h1>
        <p className="page-sub" style={{ marginBottom: 32 }}>
          Connect an inbox to get started. LifeOS reads email metadata to surface subscriptions and
          accounts — everything stays on this machine.
        </p>
        <div className="btn-row">
          <Link href="/connect"><Btn variant="primary" icon="connect">Connect Google</Btn></Link>
          <Link href="/connect"><Btn icon="mail">Manual IMAP</Btn></Link>
        </div>
      </div>
    )
  }

  const syncTargets = providers.map((p) => ({ id: p.id, email: p.email }))
  const actionItems = briefing.dealFirst.slice(0, 6).map((i) => ({ title: i.t, meta: i.meta, to: "/subscriptions" }))
  const activeSubs = subs.filter((s) => s.status === "active")
  const reviewCount = subs.filter((s) => s.status === "unknown").length
  const monthly = activeSubs
    .filter((s) => s.amount != null)
    .reduce((t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : s.amount ?? 0), 0)
  const emailLabel = stats.emailCount >= 1000 ? (stats.emailCount / 1000).toFixed(1) + "k" : String(stats.emailCount)

  return (
    <div className="page fade-in">
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36, gap: 16 }}>
        <div>
          <p className="page-eyebrow">Today</p>
          <h1 className="page-title" style={{ fontSize: 26 }}>
            {stats.emailCount > 0 ? `${emailLabel} emails scanned` : "Ready to scan"}
          </h1>
          <p className="page-sub">
            {monthly > 0
              ? <><span style={{ fontWeight: 600, color: "var(--ink)" }}>${Math.round(monthly)}/mo</span>{" across "}{activeSubs.length} subscription{activeSubs.length !== 1 ? "s" : ""}{reviewCount > 0 && <span style={{ color: "var(--st-warn)" }}> · {reviewCount} to review</span>}</>
              : reviewCount > 0
              ? <span style={{ color: "var(--st-warn)" }}>{reviewCount} subscription{reviewCount !== 1 ? "s" : ""} to review</span>
              : "No subscriptions detected yet"}
          </p>
        </div>
        <SyncAllButton targets={syncTargets} />
      </div>

      {/* needs attention */}
      {actionItems.length > 0 && (
        <Section label="Needs attention" mb={36}>
          {actionItems.map((item, i) => (
            <Link key={i} href={item.to} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "var(--surface)", ...rowRadius(i, actionItems.length), border: "1px solid var(--border)", marginTop: i > 0 ? -1 : 0, textDecoration: "none" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--st-warn)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{item.meta}</div>
              </div>
              <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)", flex: "none" }} />
            </Link>
          ))}
        </Section>
      )}

      {/* bills coming up */}
      {bills.length > 0 && (
        <Section label="Bills coming up" mb={36}>
          {bills.map((bill, i) => {
            const days = daysUntil(bill.due_date)
            const daysLabel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "var(--surface)", ...rowRadius(i, bills.length), border: "1px solid var(--border)", marginTop: i > 0 ? -1 : 0 }}>
                <Tile mono={monogram(bill.vendor ?? "?")} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{bill.vendor ?? "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{daysLabel}</div>
                </div>
                {bill.amount != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                    ${fmt(bill.amount)}/{bill.billing_cycle === "yearly" ? "yr" : "mo"}
                  </span>
                )}
              </div>
            )
          })}
        </Section>
      )}

      {/* all clear */}
      {actionItems.length === 0 && bills.length === 0 && (
        <div style={{ padding: "20px 16px", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)", color: "var(--ink-3)", fontSize: 13.5, marginBottom: 36 }}>
          Nothing needs you right now.
          {stats.emailCount === 0 && <>{" "}<Link href="/connect" style={{ color: "var(--accent)" }}>Run a sync to start scanning.</Link></>}
        </div>
      )}

      {/* inboxes */}
      <Section label="Your inboxes">
        {providers.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "var(--surface)", ...rowRadius(i, providers.length), border: "1px solid var(--border)", marginTop: i > 0 ? -1 : 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <StatusBadge status={p.status} />
                {p.last_sync_at ? `· ${new Date(p.last_sync_at).toLocaleDateString()}` : "· never synced"}
              </div>
            </div>
            <InboxSyncActions
              target={{ id: p.id, email: p.email }}
              status={p.status}
              errorMessage={p.error_message}
              historyComplete={p.history_complete}
            />
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <Link href="/connect"><Btn size="xs" icon="plus">Add inbox</Btn></Link>
        </div>
      </Section>
    </div>
  )
}

function Section({ label, children, mb }: { label: string; children: React.ReactNode; mb?: number }) {
  return (
    <section style={{ marginBottom: mb ?? 0 }}>
      <div className="section-label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </section>
  )
}
