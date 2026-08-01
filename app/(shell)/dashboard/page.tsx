import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon, StatusBadge } from "@/components/ui"
import { SyncAllButton } from "@/components/shell/SyncButtons"
import { InboxSyncActions } from "@/components/shell/InboxSyncActions"
import { FocusBoard } from "@/components/focus/FocusBoard"
import { FocusSection } from "@/components/focus/FocusSection"
import {
  getDashboardStats,
  getLocalUserId,
  listAccounts,
  listProviders,
  listSubscriptions,
  reclaimStaleSyncRuns,
  type LocalSubscription,
} from "@/lib/db/local"
import { buildBriefing } from "@/lib/ai/context"
import { getUpcomingBills } from "@/lib/db/intelligence"
import { buildTodayFocus } from "@/lib/ui/today-focus"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

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
  const accounts = listAccounts(userId)
  const briefing = buildBriefing(userId)
  const bills = getUpcomingBills(30)
  const today = buildTodayFocus({
    briefing,
    emailCount: stats.emailCount,
    subs,
    accounts,
    bills,
  })

  if (providers.length === 0) {
    return (
      <div className="page page-wide fade-in">
        <p className="page-eyebrow">Today</p>
        <h1 className="page-title">Welcome to LifeOS.</h1>
        <p className="page-sub" style={{ marginBottom: 20 }}>
          Connect a mailbox to get started. Today will show what needs you, what can wait, and what
          changed — with evidence, not vanity unread counts.
        </p>
        <div
          className="focus-card"
          style={{ marginBottom: 24, opacity: 0.85 }}
          aria-hidden="true"
        >
          <div className="focus-card-title-row">
            <h3 className="focus-card-title">Reply to landlord about lease document</h3>
            <span className="focus-priority focus-priority-high">
              <span className="focus-priority-mark" />
              <span className="focus-priority-label">high</span>
            </span>
          </div>
          <p className="focus-card-explain">Sample of what a Focus card will look like.</p>
          <p className="focus-card-why">
            <span className="focus-card-why-label">Why it matters:</span> deadline Fri · evidence
            linked · confidence shown honestly
          </p>
        </div>
        <div className="btn-row">
          <Link href="/connect">
            <Btn variant="primary" icon="connect">
              Connect a mailbox
            </Btn>
          </Link>
          <Link href="/connect">
            <Btn icon="mail">Manual IMAP</Btn>
          </Link>
        </div>
      </div>
    )
  }

  const syncTargets = providers.map((p) => ({ id: p.id, email: p.email }))
  const hasFocus =
    today.now.length + today.thisWeek.length + today.waiting.length + today.forgotten.length > 0
  const digestParts = [
    today.lowPriority.newsletters > 0
      ? `${today.lowPriority.newsletters} newsletters`
      : null,
    today.lowPriority.receipts > 0 ? `${today.lowPriority.receipts} receipts` : null,
    today.lowPriority.other > 0 ? `${today.lowPriority.other} low-signal items` : null,
  ].filter(Boolean)

  return (
    <div className="page page-wide fade-in">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          gap: 16,
        }}
      >
        <div>
          <p className="page-eyebrow">Today</p>
          <h1 className="page-title" style={{ fontSize: 26 }}>
            What needs you now
          </h1>
          <p className="overload-signal">
            {today.overload.messages > 0 ? (
              <>
                {today.overload.messages.toLocaleString()} messages scanned,{" "}
                <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                  {today.overload.needYou} seem to need you
                </strong>
                .
              </>
            ) : (
              "No messages scanned yet — sync an inbox to start."
            )}
          </p>
        </div>
        <SyncAllButton targets={syncTargets} />
      </div>

      {(today.now.length > 0 ||
        today.thisWeek.length > 0 ||
        today.waiting.length > 0 ||
        today.forgotten.length > 0) && (
        <FocusBoard
          sections={[
            { id: "now", label: "Now", items: today.now },
            { id: "week", label: "This week", items: today.thisWeek },
            { id: "waiting", label: "Waiting for others", items: today.waiting },
            {
              id: "forgotten",
              label: "Possibly forgotten",
              items: today.forgotten,
              defaultOpen: today.now.length === 0,
            },
          ].filter((s) => s.items.length > 0)}
        />
      )}

      {digestParts.length > 0 && (
        <FocusSection id="low" label="Low-priority" count={digestParts.length} defaultOpen={false}>
          <div className="digest-row">
            <Icon name="archive" size={15} style={{ color: "var(--ink-3)", flex: "none" }} />
            <span>
              <strong>Digest</strong> · {digestParts.join(" · ")}
            </span>
            <span style={{ flex: 1 }} />
            <Link href="/history">
              <Btn size="xs" variant="ghost">
                Review later
              </Btn>
            </Link>
          </div>
        </FocusSection>
      )}

      {!hasFocus && (
        <div
          style={{
            padding: "20px 16px",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            color: "var(--ink-3)",
            fontSize: 13.5,
            marginBottom: 28,
          }}
        >
          Nothing needs you right now.
          {stats.emailCount === 0 && (
            <>
              {" "}
              <Link href="/inbox-sync" style={{ color: "var(--accent)" }}>
                Run a sync to start scanning.
              </Link>
            </>
          )}
        </div>
      )}

      <section style={{ marginTop: 12 }}>
        <div className="section-label" style={{ marginTop: 0, marginBottom: 8 }}>
          Your inboxes
        </div>
        {providers.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "13px 16px",
              background: "var(--surface)",
              ...rowRadius(i, providers.length),
              border: "1px solid var(--border)",
              marginTop: i > 0 ? -1 : 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--ink)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.email}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-3)",
                  marginTop: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <StatusBadge status={p.status} />
                {p.last_sync_at
                  ? `· ${new Date(p.last_sync_at).toLocaleDateString()}`
                  : "· never synced"}
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
          <Link href="/connect">
            <Btn size="xs" icon="plus">
              Add inbox
            </Btn>
          </Link>
        </div>
      </section>
    </div>
  )
}
