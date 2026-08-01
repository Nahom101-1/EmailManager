import Link from "next/link"
import { connection } from "next/server"
import { Btn } from "@/components/ui"
import { FocusBoard } from "@/components/focus/FocusBoard"
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
import { listEmailsByIntents } from "@/lib/db/email-signals"
import { buildTodayFocus } from "@/lib/ui/today-focus"
import type { FocusCardModel } from "@/components/focus/FocusCard"

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

  const needsReply = listEmailsByIntents(["needs_reply", "action_required", "security"], {
    userId,
    limit: 12,
  })

  const replyCards: FocusCardModel[] = needsReply.map((row) => ({
    id: `intent-${row.emailId}`,
    title: row.subject ?? `${row.intent.replace(/_/g, " ")} signal`,
    explanation: row.snippet
      ? row.snippet.slice(0, 160)
      : `Classified as ${row.intent.replace(/_/g, " ")}${row.uncertain ? " (uncertain)" : ""}.`,
    whyItMatters: row.uncertain ? "Model marked this uncertain" : undefined,
    mailbox: row.providerEmail ?? undefined,
    personOrOrg: row.fromAddress ?? row.vendor ?? undefined,
    evidenceCount: 1,
    evidenceHref: `/emails/${row.emailId}`,
    confidence: row.intentConfidence,
    priority: row.intent === "security" || row.intent === "action_required" ? "high" : "medium",
    primaryAction: { label: "Open thread", href: `/emails/${row.emailId}` },
  }))

  const sections = [
    { id: "now", label: "Now", items: [...replyCards, ...today.now] },
    { id: "week", label: "This week", items: today.thisWeek },
    {
      id: "forgotten",
      label: "Possibly forgotten",
      items: today.forgotten,
      defaultOpen: today.now.length + replyCards.length === 0,
    },
  ]

  const total = sections.reduce((n, s) => n + s.items.length, 0)

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Focus</p>
          <h1 className="page-title">Focus</h1>
          <p className="page-sub">
            {total > 0
              ? `${total} item${total === 1 ? "" : "s"} that may need you. Uncertainty stays visible.`
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

      <FocusBoard sections={sections} />
    </div>
  )
}
