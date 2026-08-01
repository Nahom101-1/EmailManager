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

const AUDITS: {
  id: string
  title: string
  blurb: string
  href: string
  count?: (ctx: Counts) => number | null
}[] = [
  {
    id: "years",
    title: "Review last 3 years",
    blurb: "Guided pass over older mail — relevance first, not date order.",
    href: "/emails",
  },
  {
    id: "unresolved",
    title: "Unresolved requests",
    blurb: "Items that may still be open. No reply ≠ proof ignored.",
    href: "/focus",
    count: (c) => c.reviewTotal || null,
  },
  {
    id: "financial",
    title: "Forgotten financial issues",
    blurb: "Failed payments, refunds, and thin billing evidence.",
    href: "/subscriptions",
  },
  {
    id: "old-accounts",
    title: "Old accounts",
    blurb: "Service accounts with stale or uncertain activity.",
    href: "/accounts",
    count: (c) => c.accounts || null,
  },
  {
    id: "subs",
    title: "Possibly-still-active subscriptions",
    blurb: "Paid-plan candidates without strong inactive evidence.",
    href: "/subscriptions",
    count: (c) => c.subs || null,
  },
  {
    id: "people",
    title: "People I may not have replied to",
    blurb: "Conservative list — abstains when evidence is missing.",
    href: "/people",
  },
  {
    id: "security",
    title: "Security events",
    blurb: "Auth and account-security signals from mail metadata.",
    href: "/emails",
  },
  {
    id: "docs",
    title: "Old documents / deadlines",
    blurb: "Contracts, invoices, and deadline-like messages.",
    href: "/emails",
  },
]

type Counts = {
  emails: number
  subs: number
  accounts: number
  reviewTotal: number
}

export default async function HistoryPage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const stats = getDashboardStats(userId)
  const subs = listSubscriptions(userId)
  const accounts = listAccounts(userId)
  const reviewTotal =
    subs.filter((s) => s.status === "unknown").length +
    accounts.filter((a) => a.status === "unknown").length

  const counts: Counts = {
    emails: stats.emailCount,
    subs: subs.length,
    accounts: accounts.length,
    reviewTotal,
  }

  const summary = [
    reviewTotal > 0 ? `${reviewTotal} unresolved` : null,
    accounts.length > 0 ? `${accounts.length} accounts` : null,
    subs.length > 0 ? `${subs.length} subscription signals` : null,
    stats.emailCount > 0 ? `${stats.emailCount.toLocaleString()} messages scanned` : null,
  ].filter(Boolean)

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">History</p>
          <h1 className="page-title">History</h1>
          <p className="page-sub">
            Guided audits — buttons, not a blank search box. Results will group by relevance status
            when the temporal engine lands.
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {AUDITS.map((audit) => {
          const n = audit.count?.(counts)
          return (
            <Link
              key={audit.id}
              href={audit.href}
              className="focus-card"
              style={{ textDecoration: "none", display: "block" }}
            >
              <div className="focus-card-title-row">
                <h3 className="focus-card-title">{audit.title}</h3>
                {n != null && (
                  <span className="focus-section-count" style={{ marginTop: 2 }}>
                    {n}
                  </span>
                )}
                <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)", marginTop: 2 }} />
              </div>
              <p className="focus-card-explain">{audit.blurb}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
