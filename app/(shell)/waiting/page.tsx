import Link from "next/link"
import { connection } from "next/server"
import { Btn } from "@/components/ui"
import { FocusBoard } from "@/components/focus/FocusBoard"
import type { FocusCardModel } from "@/components/focus/FocusCard"
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
import { getEndingTrials, getUpcomingBills } from "@/lib/db/intelligence"
import { listEmailsByIntents } from "@/lib/db/email-signals"
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
          Threads and obligations where the next move may not be yours.
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

  const trials = getEndingTrials(21)
  const trialCards: FocusCardModel[] = trials.map((t) => ({
    id: `trial-${t.emailId}`,
    title: `Trial signal — ${t.vendor ?? "Unknown"}`,
    explanation:
      "Ending-trial intent from mail intelligence. Waiting on a decision or vendor — not proof of an open obligation.",
    deadline: `due ${t.due_date}`,
    personOrOrg: t.vendor ?? undefined,
    evidenceCount: 1,
    evidenceHref: `/emails/${t.emailId}`,
    priority: "medium",
    primaryAction: { label: "Open thread", href: `/emails/${t.emailId}` },
  }))

  // action_required often means someone wants something from you — keep off Waiting.
  // renewal without your reply yet can be "waiting on billing cycle".
  const renewals = listEmailsByIntents(["renewal", "trial"], { userId, limit: 15 })
  const renewalCards: FocusCardModel[] = renewals
    .filter((r) => !trials.some((t) => t.emailId === r.emailId))
    .map((row) => ({
      id: `wait-intent-${row.emailId}`,
      title: row.subject ?? `${row.intent} signal`,
      explanation:
        "Vendor/system signal. Treated as possibly waiting — conversation state is not confirmed.",
      mailbox: row.providerEmail ?? undefined,
      personOrOrg: row.fromAddress ?? row.vendor ?? undefined,
      evidenceCount: 1,
      evidenceHref: `/emails/${row.emailId}`,
      confidence: row.intentConfidence,
      priority: row.uncertain ? "uncertain" : "low",
      primaryAction: { label: "Open thread", href: `/emails/${row.emailId}` },
    }))

  const billCards: FocusCardModel[] = today.thisWeek.map((b) => ({
    ...b,
    id: `wait-${b.id}`,
    explanation: `${b.explanation} Surfaced here as a calendar wait — not a person waiting on you.`,
    priority: b.priority ?? "low",
  }))

  const sections = [
    {
      id: "loops",
      label: "Possibly waiting on others",
      items: [...today.waiting, ...trialCards, ...renewalCards],
    },
    {
      id: "calendar",
      label: "Upcoming (calendar wait)",
      items: billCards,
      defaultOpen: today.waiting.length + trialCards.length === 0,
    },
  ]

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Waiting</p>
          <h1 className="page-title">Waiting</h1>
          <p className="page-sub">
            Ball-in-their-court is hard to prove from metadata alone. Items here are signals, not
            confirmed open loops.
          </p>
        </div>
        <Link href="/focus">
          <Btn size="sm" variant="ghost">
            Needs you (Focus)
          </Btn>
        </Link>
      </div>

      <FocusBoard
        sections={sections}
        emptyMessage="No clear waiting signals yet. As conversation state improves, open loops will land here."
      />
    </div>
  )
}
