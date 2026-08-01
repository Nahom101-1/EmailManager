/**
 * History audit results grouped by relevance status (UI_UX_SPEC §7).
 * Uses existing detections/intelligence — honest scaffolds where engines are thin.
 */

import type { LocalAccount, LocalSubscription } from "@/lib/db/local"
import type { IntentEmailRow } from "@/lib/db/email-signals"

export type RelevanceStatus =
  | "open_and_relevant"
  | "resolved_indirectly"
  | "expired"
  | "superseded"
  | "probably_irrelevant"
  | "uncertain"

export type HistoryResult = {
  id: string
  title: string
  blurb: string
  href: string
  status: RelevanceStatus
  evidenceNote?: string
}

export const RELEVANCE_ORDER: RelevanceStatus[] = [
  "open_and_relevant",
  "uncertain",
  "expired",
  "resolved_indirectly",
  "superseded",
  "probably_irrelevant",
]

export const RELEVANCE_LABEL: Record<RelevanceStatus, string> = {
  open_and_relevant: "Open & relevant",
  resolved_indirectly: "Resolved indirectly",
  expired: "Expired",
  superseded: "Superseded",
  probably_irrelevant: "Probably irrelevant",
  uncertain: "Uncertain",
}

export function buildHistoryResults(input: {
  accounts: LocalAccount[]
  subs: LocalSubscription[]
  security: IntentEmailRow[]
  needsReply: IntentEmailRow[]
  auditId: string
}): HistoryResult[] {
  const { accounts, subs, security, needsReply, auditId } = input
  const out: HistoryResult[] = []

  const isPaid = (s: LocalSubscription) =>
    s.kind === "paid" || (s.kind == null && s.category !== "newsletter")

  if (auditId === "unresolved" || auditId === "years") {
    for (const a of accounts.filter((x) => x.status === "unknown").slice(0, 20)) {
      out.push({
        id: `acct-${a.id}`,
        title: `Review account — ${a.company}`,
        blurb: a.source_subject ?? a.source ?? "Uncertain account detection",
        href: `/accounts/${a.id}`,
        status: (a.confidence ?? 0) < 0.55 ? "uncertain" : "open_and_relevant",
        evidenceNote: a.last_seen ? `Last seen ${a.last_seen.slice(0, 10)}` : undefined,
      })
    }
    for (const s of subs.filter((x) => x.status === "unknown" && isPaid(x)).slice(0, 20)) {
      out.push({
        id: `sub-${s.id}`,
        title: `Confirm paid plan — ${s.company}`,
        blurb: s.source_subject ?? "Paid-plan candidate without confirmation",
        href: "/subscriptions",
        status: (s.confidence ?? 0) < 0.55 ? "uncertain" : "open_and_relevant",
      })
    }
    for (const row of needsReply.slice(0, 15)) {
      out.push({
        id: `nr-${row.emailId}`,
        title: row.subject ?? "Possible open request",
        blurb: `Intent ${row.intent.replace(/_/g, " ")}${row.uncertain ? " · uncertain" : ""}`,
        href: `/emails/${row.emailId}`,
        status: row.uncertain ? "uncertain" : "open_and_relevant",
        evidenceNote: row.fromAddress ?? undefined,
      })
    }
  }

  if (auditId === "old-accounts" || auditId === "years") {
    for (const a of accounts) {
      const year = a.last_seen?.slice(0, 4)
      if (year && year < "2025") {
        out.push({
          id: `old-${a.id}`,
          title: a.company,
          blurb: `Last activity ~${year}. Not proof inactive — thin recent evidence.`,
          href: `/accounts/${a.id}`,
          status: a.status === "closed" ? "expired" : "uncertain",
        })
      }
    }
  }

  if (auditId === "subs" || auditId === "financial") {
    for (const s of subs.filter((x) => isPaid(x) && x.status === "unknown").slice(0, 25)) {
      out.push({
        id: `psub-${s.id}`,
        title: s.company,
        blurb:
          s.amount != null
            ? `Amount signal present · status unknown`
            : "No observed payment — not proof inactive",
        href: "/subscriptions",
        status: "uncertain",
      })
    }
    for (const s of subs.filter((x) => isPaid(x) && x.status === "cancelled").slice(0, 10)) {
      out.push({
        id: `canc-${s.id}`,
        title: s.company,
        blurb: "Marked cancelled — may still be active until period end (not modeled yet).",
        href: "/subscriptions",
        status: "superseded",
      })
    }
  }

  if (auditId === "people") {
    for (const row of needsReply.slice(0, 25)) {
      out.push({
        id: `ppl-${row.emailId}`,
        title: row.fromAddress ?? "Unknown sender",
        blurb: row.subject ?? "needs_reply signal — no reply found is not proof ignored",
        href: `/emails/${row.emailId}`,
        status: row.uncertain ? "uncertain" : "open_and_relevant",
      })
    }
  }

  if (auditId === "security") {
    for (const row of security.slice(0, 30)) {
      out.push({
        id: `sec-${row.emailId}`,
        title: row.subject ?? "Security signal",
        blurb: row.fromAddress ?? "Auth/security intent from metadata",
        href: `/emails/${row.emailId}`,
        status: row.uncertain ? "uncertain" : "open_and_relevant",
      })
    }
  }

  if (auditId === "docs") {
    for (const s of subs
      .filter((x) => /invoice|contract|receipt/i.test(`${x.category ?? ""} ${x.source ?? ""}`))
      .slice(0, 15)) {
      out.push({
        id: `doc-${s.id}`,
        title: s.company,
        blurb: s.source_subject ?? "Document-like billing signal",
        href: s.source_email_id ? `/emails/${s.source_email_id}` : "/subscriptions",
        status: "uncertain",
      })
    }
  }

  if (auditId === "years") {
    for (const s of subs.filter((x) => x.kind === "mailing_list" || x.category === "newsletter").slice(0, 20)) {
      out.push({
        id: `nl-${s.id}`,
        title: s.company,
        blurb: "Mailing list / newsletter — usually low priority",
        href: "/subscriptions",
        status: "probably_irrelevant",
      })
    }
  }

  // Deduplicate by id
  const seen = new Set<string>()
  return out.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

export function groupByRelevance(results: HistoryResult[]): Record<RelevanceStatus, HistoryResult[]> {
  const groups = Object.fromEntries(RELEVANCE_ORDER.map((s) => [s, [] as HistoryResult[]])) as Record<
    RelevanceStatus,
    HistoryResult[]
  >
  for (const r of results) groups[r.status].push(r)
  return groups
}
