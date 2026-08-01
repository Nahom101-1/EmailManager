import type { FocusCardModel, FocusPriority } from "@/components/focus/FocusCard"
import type { Briefing } from "@/lib/ai/context"
import type { LocalAccount, LocalSubscription } from "@/lib/db/local"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

export type TodayFocusModel = {
  overload: { messages: number; needYou: number }
  now: FocusCardModel[]
  thisWeek: FocusCardModel[]
  waiting: FocusCardModel[]
  forgotten: FocusCardModel[]
  lowPriority: { newsletters: number; receipts: number; other: number }
}

function priorityFromConfidence(confidence: number | null | undefined): FocusPriority {
  if (confidence == null) return "uncertain"
  if (confidence >= 0.75) return "high"
  if (confidence >= 0.5) return "medium"
  return "uncertain"
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/**
 * Map existing detection/briefing signals into Today Focus sections.
 * Conservative: no invented deadlines or fake reply needs.
 */
export function buildTodayFocus(input: {
  briefing: Briefing
  emailCount: number
  subs: SubRow[]
  accounts: LocalAccount[]
  bills: {
    vendor: string | null
    due_date: string
    amount: number | null
    billing_cycle: string | null
    provider_email?: string | null
  }[]
}): TodayFocusModel {
  const { briefing, emailCount, subs, accounts, bills } = input

  const reviewSubs = subs.filter((s) => s.status === "unknown")
  const reviewAccts = accounts.filter((a) => a.status === "unknown")

  const now: FocusCardModel[] = []

  for (const sub of reviewSubs.slice(0, 4)) {
    const conf = sub.confidence
    now.push({
      id: `sub-${sub.id}`,
      title: `Review subscription — ${sub.company}`,
      explanation:
        "Detected from email metadata. Confirm whether this is a paid plan, mailing list, or noise.",
      whyItMatters: sub.category ? `Category guess: ${sub.category}` : "Needs a human look",
      mailbox: undefined,
      personOrOrg: sub.company,
      evidenceCount: 1,
      evidenceHref: "/subscriptions",
      confidence: conf ?? undefined,
      priority: priorityFromConfidence(conf),
      primaryAction: { label: "Review", href: "/subscriptions" },
    })
  }

  for (const acct of reviewAccts.slice(0, 3)) {
    const conf = acct.confidence
    now.push({
      id: `acct-${acct.id}`,
      title: `Review account — ${acct.company}`,
      explanation: "Possible service account tied to your inbox. Merge policy stays conservative.",
      whyItMatters: acct.domain ? `Domain: ${acct.domain}` : "Identity not fully resolved",
      personOrOrg: acct.company,
      evidenceCount: 1,
      evidenceHref: `/accounts/${acct.id}`,
      confidence: conf ?? undefined,
      priority: priorityFromConfidence(conf),
      primaryAction: { label: "Open account", href: `/accounts/${acct.id}` },
    })
  }

  // Surface briefing deal-first items that aren't already covered.
  if (now.length === 0) {
    for (const [i, item] of briefing.dealFirst.entries()) {
      now.push({
        id: `brief-now-${i}`,
        title: item.t,
        explanation: item.meta,
        priority: "medium",
        primaryAction: { label: "Open Money", href: "/subscriptions" },
      })
    }
  }

  const thisWeek: FocusCardModel[] = bills.slice(0, 6).map((bill, i) => {
    const days = daysUntil(bill.due_date)
    const when = days <= 0 ? "due today" : days === 1 ? "due tomorrow" : `in ${days} days`
    return {
      id: `bill-${i}-${bill.due_date}`,
      title: `${bill.vendor ?? "Upcoming charge"} ${when}`,
      explanation:
        bill.amount != null
          ? `Estimated ${bill.billing_cycle === "yearly" ? "annual" : "monthly"} charge from billing signals.`
          : "Upcoming bill signal — amount not confirmed.",
      deadline: when,
      mailbox: bill.provider_email ?? undefined,
      personOrOrg: bill.vendor ?? undefined,
      evidenceCount: 1,
      evidenceHref: "/subscriptions",
      priority: days <= 2 ? "high" : "medium",
      primaryAction: { label: "Open Money", href: "/subscriptions" },
    }
  })

  const waiting: FocusCardModel[] = briefing.canWait.slice(0, 4).map((item, i) => ({
    id: `wait-${i}`,
    title: item.t,
    explanation: item.meta || "Tracked, but not urgent based on current signals.",
    priority: "low",
    primaryAction: { label: "Open Focus", href: "/focus" },
  }))

  const forgotten: FocusCardModel[] = []
  const staleUnknown = [...reviewSubs, ...reviewAccts]
    .filter((x) => (x.confidence ?? 0) < 0.55)
    .slice(0, 4)
  for (const item of staleUnknown) {
    const isSub = "category" in item
    forgotten.push({
      id: `forgot-${isSub ? "s" : "a"}-${item.id}`,
      title: `Possibly forgotten — ${item.company}`,
      explanation:
        "Low-confidence or unresolved detection. Not proof it is inactive — only that evidence is thin.",
      personOrOrg: item.company,
      confidence: item.confidence ?? undefined,
      priority: "uncertain",
      evidenceHref: isSub ? "/subscriptions" : `/accounts/${item.id}`,
      primaryAction: {
        label: "Review",
        href: isSub ? "/subscriptions" : `/accounts/${item.id}`,
      },
    })
  }

  const newsletters = subs.filter(
    (s) => s.kind === "mailing_list" || s.category === "newsletter"
  ).length
  const receipts = subs.filter((s) => s.category === "receipt" || s.category === "order").length
  const other = Math.max(0, briefing.ignore.reduce((n, i) => n + (/\d+/.test(i.t) ? 0 : 1), 0))

  return {
    overload: {
      messages: emailCount,
      needYou: Math.max(briefing.needsReply, now.length),
    },
    now,
    thisWeek,
    waiting,
    forgotten,
    lowPriority: {
      newsletters,
      receipts,
      other: other + briefing.ignore.length,
    },
  }
}
