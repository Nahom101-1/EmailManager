import Link from "next/link"
import { connection } from "next/server"
import { Btn } from "@/components/ui"
import { FocusCard } from "@/components/focus/FocusCard"
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

export default async function FocusPage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)

  if (providers.length === 0) {
    return (
      <div className="page page-wide fade-in">
        <p className="page-eyebrow">Focus</p>
        <h1 className="page-title">Your focus queue</h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Items that seem to need a reply, decision, or review — with confidence and evidence, not a
          raw unread pile.
        </p>
        <Link href="/connect">
          <Btn variant="primary" icon="connect">
            Connect a mailbox
          </Btn>
        </Link>
      </div>
    )
  }

  const stats = getDashboardStats(userId)
  const today = buildTodayFocus({
    briefing: buildBriefing(userId),
    emailCount: stats.emailCount,
    subs: listSubscriptions(userId) as SubRow[],
    accounts: listAccounts(userId),
    bills: getUpcomingBills(30),
  })

  const items = [...today.now, ...today.thisWeek, ...today.forgotten]

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Focus</p>
          <h1 className="page-title">Focus</h1>
          <p className="page-sub">
            {items.length > 0
              ? `${items.length} item${items.length === 1 ? "" : "s"} that may need you. Uncertainty stays visible.`
              : "Nothing in the focus queue right now."}
          </p>
        </div>
        <div className="btn-row">
          <Link href="/review">
            <Btn size="sm" variant="primary">
              Review queue
            </Btn>
          </Link>
          <Link href="/dashboard">
            <Btn size="sm" variant="ghost">
              Back to Today
            </Btn>
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <FocusCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
