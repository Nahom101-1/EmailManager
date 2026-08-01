import Link from "next/link"
import { connection } from "next/server"
import { Btn, Card, Icon } from "@/components/ui"
import { SubscriptionsBrowser } from "@/components/subscriptions/SubscriptionsBrowser"
import { getLocalUserId, listSubscriptions, type LocalSubscription } from "@/lib/db/local"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

export default async function SubscriptionsPage() {
  await connection()
  const subs = listSubscriptions(getLocalUserId()) as SubRow[]

  if (subs.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Subscriptions</div>
            <h1 className="page-title">Subscriptions</h1>
            <p className="page-sub">Recurring charges detected from receipts and billing emails.</p>
          </div>
        </div>
        <Card>
          <div className="empty">
            <span className="ico"><Icon name="subs" size={22} /></span>
            <h4>No subscriptions found yet</h4>
            <p>Sync an inbox to scan recent receipts and billing emails. Detected subscriptions will appear here for review.</p>
            <div className="btn-row mt14" style={{ justifyContent: "center" }}>
              <Link href="/inbox-sync"><Btn variant="primary" icon="refresh">Sync now</Btn></Link>
              <Link href="/connect"><Btn icon="connect">Connect inbox</Btn></Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const active = subs.filter((s) => s.status === "active")
  const review = subs.filter((s) => s.status === "unknown").length
  const monthly = active.filter((s) => s.amount != null).reduce((t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : s.amount ?? 0), 0)

  const stats = [
    { l: "Active subscriptions", v: String(active.length), ic: "subs", delta: `${subs.length} detected` },
    { l: "Monthly spend", v: monthly > 0 ? "$" + Math.round(monthly) : "—", ic: "receipt", delta: monthly > 0 ? "est. across active" : "no amounts detected" },
    { l: "Annualized", v: monthly > 0 ? "$" + Math.round(monthly * 12).toLocaleString() : "—", ic: "refresh", delta: "per year" },
    { l: "Needs review", v: String(review), ic: "flag", delta: "confirm to sharpen totals", warn: review > 0 },
  ]

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Subscriptions</div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-sub">Recurring charges detected from receipts and billing emails. Confirm the uncertain ones to sharpen your totals.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        {stats.map((s) => (
          <Card key={s.l} className="stat">
            <span className="label"><Icon name={s.ic} size={13} />{s.l}</span>
            <span className="val" style={s.warn ? { color: "var(--st-warn)" } : {}}>{s.v}</span>
            <span className="delta">{s.delta}</span>
          </Card>
        ))}
      </div>

      <SubscriptionsBrowser subscriptions={subs} />
    </div>
  )
}
