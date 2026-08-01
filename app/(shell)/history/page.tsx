import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon } from "@/components/ui"
import {
  getDashboardStats,
  getLocalUserId,
  listAccounts,
  listProviders,
  listSubscriptions,
  reclaimStaleSyncRuns,
} from "@/lib/db/local"
import { listEmailsByIntents } from "@/lib/db/email-signals"
import {
  RELEVANCE_LABEL,
  RELEVANCE_ORDER,
  buildHistoryResults,
  groupByRelevance,
  type RelevanceStatus,
} from "@/lib/ui/history-audits"

const AUDITS: { id: string; title: string; blurb: string }[] = [
  {
    id: "years",
    title: "Review last 3 years",
    blurb: "Guided pass — relevance first, not date order.",
  },
  {
    id: "unresolved",
    title: "Unresolved requests",
    blurb: "Items that may still be open. No reply ≠ proof ignored.",
  },
  {
    id: "financial",
    title: "Forgotten financial issues",
    blurb: "Thin billing evidence and unconfirmed paid plans.",
  },
  {
    id: "old-accounts",
    title: "Old accounts",
    blurb: "Service accounts with stale or uncertain activity.",
  },
  {
    id: "subs",
    title: "Possibly-still-active subscriptions",
    blurb: "Paid-plan candidates without strong inactive evidence.",
  },
  {
    id: "people",
    title: "People I may not have replied to",
    blurb: "Conservative needs_reply signals — abstains when thin.",
  },
  {
    id: "security",
    title: "Security events",
    blurb: "Auth and account-security intents from mail metadata.",
  },
  {
    id: "docs",
    title: "Old documents / deadlines",
    blurb: "Invoice/contract-like billing signals.",
  },
]

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ audit?: string }>
}) {
  await connection()
  reclaimStaleSyncRuns()
  const sp = await searchParams
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const stats = getDashboardStats(userId)
  const subs = listSubscriptions(userId)
  const accounts = listAccounts(userId)
  const security = listEmailsByIntents(["security"], { userId, limit: 40 })
  const needsReply = listEmailsByIntents(["needs_reply", "action_required"], {
    userId,
    limit: 40,
  })

  const reviewTotal =
    subs.filter((s) => s.status === "unknown").length +
    accounts.filter((a) => a.status === "unknown").length
  const newsletters = subs.filter(
    (s) => s.kind === "mailing_list" || s.category === "newsletter"
  ).length
  const oldAccounts = accounts.filter((a) => (a.last_seen?.slice(0, 4) ?? "9999") < "2025").length

  const summary = [
    reviewTotal > 0 ? `${reviewTotal} unresolved` : null,
    oldAccounts > 0 ? `${oldAccounts} old accounts` : null,
    subs.filter((s) => s.status === "unknown").length > 0
      ? `${subs.filter((s) => s.status === "unknown").length} possible recurring`
      : null,
    needsReply.length > 0 ? `${needsReply.length} people/requests` : null,
    newsletters > 0 ? `${newsletters} stale newsletters` : null,
  ].filter(Boolean)

  const auditId = AUDITS.some((a) => a.id === sp.audit) ? (sp.audit as string) : null
  const results = auditId
    ? buildHistoryResults({ accounts, subs, security, needsReply, auditId })
    : []
  const grouped = groupByRelevance(results)
  const activeAudit = AUDITS.find((a) => a.id === auditId) ?? null

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">History</p>
          <h1 className="page-title">History</h1>
          <p className="page-sub">
            Guided audits — buttons, not a blank search box. Results group by relevance status, not
            date. Temporal resolution stays conservative.
          </p>
        </div>
      </div>

      {summary.length > 0 && (
        <p className="overload-signal" style={{ marginBottom: 22 }}>
          {summary.join(" · ")}.
        </p>
      )}

      {providers.length === 0 ? (
        <div className="digest-row" style={{ marginBottom: 18 }}>
          <span>Connect a mailbox to run audits over your real history.</span>
          <Link href="/connect">
            <Btn size="xs" variant="primary" icon="connect">
              Connect
            </Btn>
          </Link>
        </div>
      ) : null}

      <div className="history-audits" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {AUDITS.map((audit) => {
          const on = audit.id === auditId
          return (
            <Link
              key={audit.id}
              href={on ? "/history" : `/history?audit=${audit.id}`}
              className={"focus-card" + (on ? " is-selected" : "")}
              style={{ textDecoration: "none", display: "block" }}
              aria-current={on ? "true" : undefined}
            >
              <div className="focus-card-title-row">
                <h3 className="focus-card-title">{audit.title}</h3>
                <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)", marginTop: 2 }} />
              </div>
              <p className="focus-card-explain">{audit.blurb}</p>
            </Link>
          )
        })}
      </div>

      {activeAudit && (
        <div className="history-results" style={{ marginTop: 28 }}>
          <div className="between" style={{ marginBottom: 14, alignItems: "baseline" }}>
            <div>
              <p className="page-eyebrow">Results</p>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                {activeAudit.title}
              </h2>
              <p className="page-sub">
                {results.length} item{results.length === 1 ? "" : "s"} · grouped by relevance
                status
              </p>
            </div>
            <Link href="/history">
              <Btn size="xs" variant="ghost">
                Clear
              </Btn>
            </Link>
          </div>

          {results.length === 0 ? (
            <div className="digest-row">
              <span className="uncertain-chip">no matches</span>
              <span>
                No rows from current detections for this audit. Engines for resolved-indirectly /
                superseded stay thin until the temporal graph lands.
              </span>
            </div>
          ) : (
            RELEVANCE_ORDER.map((status) => {
              const items = grouped[status]
              if (items.length === 0) return null
              return (
                <RelevanceGroup key={status} status={status} items={items} />
              )
            })
          )}

          <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
            Statuses without rows are omitted. Absence of a group is not a claim that nothing exists
            — only that we lack evidence for it.
          </p>
        </div>
      )}

      {!activeAudit && stats.emailCount > 0 && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 18 }}>
          Pick an audit above. Results use existing detections — not a full historical re-ranker
          yet.
        </p>
      )}
    </div>
  )
}

function RelevanceGroup({
  status,
  items,
}: {
  status: RelevanceStatus
  items: ReturnType<typeof buildHistoryResults>
}) {
  return (
    <section className="focus-section" style={{ marginBottom: 16 }}>
      <div className="focus-section-head" style={{ cursor: "default" }}>
        <span className="focus-section-label">{RELEVANCE_LABEL[status]}</span>
        <span className="focus-section-count">{items.length}</span>
        {status === "uncertain" && <span className="uncertain-chip">uncertain</span>}
      </div>
      <div className="focus-section-body">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="digest-row"
            style={{ textDecoration: "none" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{item.title}</strong>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {item.blurb}
                {item.evidenceNote ? ` · ${item.evidenceNote}` : ""}
              </div>
            </div>
            <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)", flex: "none" }} />
          </Link>
        ))}
      </div>
    </section>
  )
}
