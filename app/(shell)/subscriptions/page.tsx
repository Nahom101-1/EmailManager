import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon, Tile, fmt, monogram } from "@/components/ui"
import { SubscriptionsBrowser } from "@/components/subscriptions/SubscriptionsBrowser"
import { getLocalUserId, listSubscriptions, type LocalSubscription } from "@/lib/db/local"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

function monthlyTotal(subs: SubRow[]) {
  return subs
    .filter((s) => s.status === "active" && s.amount != null)
    .reduce((t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : s.amount ?? 0), 0)
}

export default async function SubscriptionsPage() {
  await connection()
  const subs = listSubscriptions(getLocalUserId()) as SubRow[]

  if (subs.length === 0) {
    return (
      <div className="page fade-in">
        <p className="page-eyebrow">Money</p>
        <h1 className="page-title">Subscriptions</h1>
        <p className="page-sub" style={{ marginBottom: 32 }}>
          Recurring charges detected from receipts and billing emails.
        </p>
        <div style={{ padding: "32px 24px", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginBottom: 16 }}>No subscriptions found yet.</div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/inbox-sync"><Btn variant="primary" icon="refresh">Sync now</Btn></Link>
            <Link href="/connect"><Btn icon="connect">Connect inbox</Btn></Link>
          </div>
        </div>
      </div>
    )
  }

  const active = subs.filter((s) => s.status === "active")
  const review = subs.filter((s) => s.status === "unknown")
  const monthly = monthlyTotal(subs)

  return (
    <div className="page fade-in">
      {/* header */}
      <p className="page-eyebrow">Money</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 className="page-title" style={{ fontSize: 36, margin: 0 }}>
          {monthly > 0 ? `$${Math.round(monthly)}/mo` : "—"}
        </h1>
        {monthly > 0 && (
          <span style={{ color: "var(--ink-3)", fontSize: 14 }}>
            ${Math.round(monthly * 12).toLocaleString()}/yr across {active.length} subscription{active.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {review.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--st-warn)", marginBottom: 28 }}>
          <Icon name="flag" size={12} style={{ marginRight: 5, verticalAlign: "middle" }} />
          {review.length} subscription{review.length !== 1 ? "s" : ""} need confirmation — amounts may be off until you review them.
        </p>
      )}

      <SubscriptionsBrowser subscriptions={subs} />
    </div>
  )
}
