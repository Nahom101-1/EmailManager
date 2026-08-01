import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon } from "@/components/ui"
import { SubscriptionsBrowser } from "@/components/subscriptions/SubscriptionsBrowser"
import { getLocalUserId, listProviders, listSubscriptions } from "@/lib/db/local"
import { listSubscriptionGroups } from "@/lib/identity/groups"

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ inbox?: string }>
}) {
  await connection()
  const sp = await searchParams
  const userId = getLocalUserId()
  const subs = listSubscriptions(userId)
  const groups = listSubscriptionGroups(userId)
  const inboxes = listProviders(userId).map((p) => p.email)

  if (subs.length === 0) {
    return (
      <div className="page fade-in">
        <p className="page-eyebrow">Money</p>
        <h1 className="page-title">Subscriptions</h1>
        <p className="page-sub" style={{ marginBottom: 32 }}>
          Recurring charges detected from receipts and billing emails.
        </p>
        <div
          style={{
            padding: "32px 24px",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginBottom: 16 }}>
            No subscriptions found yet.
          </div>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <Link href="/inbox-sync">
              <Btn variant="primary" icon="refresh">
                Sync now
              </Btn>
            </Link>
            <Link href="/connect">
              <Btn icon="connect">Connect inbox</Btn>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isPaid = (s: (typeof subs)[number]) =>
    s.kind === "paid" || ((s.kind == null || s.kind === undefined) && s.category !== "newsletter")
  const paid = subs.filter(isPaid)
  const lists = subs.filter((s) => !isPaid(s))
  const active = paid.filter((s) => s.status === "active")
  const review = paid.filter((s) => s.status === "unknown")
  const monthly = active
    .filter((s) => s.amount != null)
    .reduce(
      (t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : (s.amount ?? 0)),
      0
    )

  return (
    <div className="page fade-in">
      <p className="page-eyebrow">Money</p>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <h1 className="page-title" style={{ fontSize: 36, margin: 0 }}>
          {monthly > 0 ? `$${Math.round(monthly)}/mo` : "—"}
        </h1>
        {monthly > 0 && (
          <span style={{ color: "var(--ink-3)", fontSize: 14 }}>
            ${Math.round(monthly * 12).toLocaleString()}/yr across {active.length} paid plan
            {active.length !== 1 ? "s" : ""}
            {lists.length > 0
              ? ` · ${lists.length} email list${lists.length !== 1 ? "s" : ""}`
              : ""}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: review.length > 0 ? 8 : 28 }}>
        Paid plans (Netflix-style) are separate from email mailing lists. Defaults to Paid plans.
      </p>
      {review.length > 0 && (
        <p style={{ fontSize: 13, color: "var(--st-warn)", marginBottom: 28 }}>
          <Icon name="flag" size={12} style={{ marginRight: 5, verticalAlign: "middle" }} />
          {review.length} paid plan{review.length !== 1 ? "s" : ""} need confirmation — amounts may
          be off until you review them.
        </p>
      )}

      <SubscriptionsBrowser
        subscriptions={subs}
        groups={groups}
        inboxes={inboxes}
        initialInbox={sp.inbox && inboxes.includes(sp.inbox) ? sp.inbox : "all"}
      />
    </div>
  )
}
