import Link from "next/link"
import { connection } from "next/server"
import { Btn } from "@/components/ui"
import { ReviewQueue, type ReviewItem } from "@/components/review/ReviewQueue"
import {
  getLocalUserId,
  listAccounts,
  listProviders,
  listSubscriptions,
  reclaimStaleSyncRuns,
} from "@/lib/db/local"

function evidenceLines(parts: Array<string | null | undefined>): string[] {
  return parts.filter((p): p is string => Boolean(p && p.trim()))
}

export default async function ReviewPage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)

  if (providers.length === 0) {
    return (
      <div className="page page-wide fade-in">
        <p className="page-eyebrow">Review</p>
        <h1 className="page-title">Review queue</h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Fast corrections for uncertain detections. Connect a mailbox to populate the queue.
        </p>
        <Link href="/connect">
          <Btn variant="primary" icon="connect">
            Connect a mailbox
          </Btn>
        </Link>
      </div>
    )
  }

  const accounts = listAccounts(userId).filter((a) => a.status === "unknown")
  const subs = listSubscriptions(userId).filter((s) => s.status === "unknown")

  const items: ReviewItem[] = [
    ...accounts.map((a) => {
      // Conservative: stale year-from-ISO only (no Date.now in render).
      const lastYear = a.last_seen?.slice(0, 4)
      const hypothesis =
        lastYear && lastYear < "2025"
          ? `this may be an inactive ${a.company} account`
          : `this ${a.company} account needs a human look`
      return {
        id: a.id,
        kind: "account" as const,
        title: `${a.company}${a.provider_email ? ` · ${a.provider_email}` : ""}`,
        hypothesis,
        evidence: evidenceLines([
          a.source ? `Signal: ${a.source}` : null,
          a.last_seen ? `Last activity: ${new Date(a.last_seen).toLocaleDateString()}` : null,
          a.first_seen ? `First seen: ${new Date(a.first_seen).toLocaleDateString()}` : null,
          a.source_subject ? `Email: ${a.source_subject}` : null,
          !a.source && !a.last_seen ? "no recent billing evidence stored" : null,
        ]),
        confidence: a.confidence,
        href: `/accounts/${a.id}`,
        status: a.status,
      }
    }),
    ...subs.map((s) => ({
      id: s.id,
      kind: "subscription" as const,
      title: `${s.company}${s.provider_email ? ` · ${s.provider_email}` : ""}`,
      hypothesis:
        s.kind === "mailing_list" || s.category === "newsletter"
          ? `${s.company} looks like a mailing list, not a paid plan`
          : `${s.company} may be a paid plan — confirm or correct`,
      evidence: evidenceLines([
        s.category ? `Category guess: ${s.category}` : null,
        s.amount != null
          ? `Amount signal: ${s.amount}${s.billing_cycle === "yearly" ? "/yr" : "/mo"}`
          : "no amount observed (not proof of inactivity)",
        s.last_seen ? `Last seen: ${new Date(s.last_seen).toLocaleDateString()}` : null,
        s.source_subject ? `Email: ${s.source_subject}` : null,
      ]),
      confidence: s.confidence,
      href: "/subscriptions",
      status: s.status,
    })),
  ]

  // Highest confidence first — faster wins; low-confidence stay explicit.
  items.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">Review</p>
          <h1 className="page-title">Review queue</h1>
          <p className="page-sub">
            {items.length} item{items.length === 1 ? "" : "s"} awaiting a correction. Choices map to
            existing status APIs (and learning labels on confirm/ignore) — not a new persistence
            layer.
          </p>
        </div>
        <Link href="/focus">
          <Btn size="sm" variant="ghost">
            Back to Focus
          </Btn>
        </Link>
      </div>

      <ReviewQueue items={items} />
    </div>
  )
}
