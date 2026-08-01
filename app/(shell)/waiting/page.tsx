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

export default async function WaitingPage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)

  if (providers.length === 0) {
    return (
      <div className="page page-wide fade-in">
        <p className="page-eyebrow">Waiting</p>
        <h1 className="page-title">Waiting on others</h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Threads and obligations where the next move is not yours — once LifeOS can detect them
          reliably.
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

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Waiting</p>
          <h1 className="page-title">Waiting</h1>
          <p className="page-sub">
            Ball-in-their-court items. Absence of a reply is not treated as proof you ignored
            something.
          </p>
        </div>
      </div>

      {today.waiting.length === 0 ? (
        <div className="digest-row">
          <span>
            No clear waiting items yet. As conversation state improves, open loops will land here.
          </span>
          <span className="uncertain-chip">uncertain</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {today.waiting.map((item) => (
            <FocusCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
