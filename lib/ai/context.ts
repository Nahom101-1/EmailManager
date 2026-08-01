import {
  countEmailsSince,
  getLocalUserId,
  listAccounts,
  listProviderTags,
  listProviders,
  listRecentEmails,
  listSubscriptions,
  type AiScopeId,
  type AiSettings,
  type LocalAccount,
  type LocalSubscription,
} from "@/lib/db/local"
import { buildDigestContext } from "@/lib/ai/tools"
import { listAccountGroups, listSubscriptionGroups } from "@/lib/identity/groups"

export interface BriefItem {
  t: string
  meta: string
}

export interface Briefing {
  newSinceLast: number
  needsReply: number
  inboxLoad: "Quiet" | "Light" | "Normal" | "Busy"
  dealFirst: BriefItem[]
  canWait: BriefItem[]
  ignore: BriefItem[]
}

// Subscriptions may carry an amount/cycle on the row even though the typed
// interface omits them (detection rarely fills them). Read them defensively.
type SubWithAmount = LocalSubscription & {
  amount?: number | null
  billing_cycle?: string | null
}

function monthlyAmount(sub: SubWithAmount): number {
  if (sub.amount == null) return 0
  return sub.billing_cycle === "yearly" ? sub.amount / 12 : sub.amount
}

function senderName(from: string | null): string {
  if (!from) return "Unknown sender"
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</)
  if (named) return named[1].trim()
  return from.replace(/[<>]/g, "").trim()
}

/**
 * Build a grounding string from the user's real data for the assistant. Only
 * sources whose scope is enabled are included — this is the privacy contract,
 * enforced here on the server, never on the client.
 */
export function buildLifeContext(settings: AiSettings, userId = getLocalUserId()): string {
  const on = (id: AiScopeId) => settings.scopes[id]
  const lines: string[] = []

  if (on("inboxes")) {
    const providers = listProviders(userId)
    const tags = listProviderTags(providers.map((p) => p.id))
    if (providers.length === 0) {
      lines.push("Connected inboxes: none yet.")
    } else {
      lines.push(
        `Connected inboxes (${providers.length}): ` +
          providers
            .map((p) => {
              const tag = tags[p.id]
              const purpose = tag ? `, purpose=${tag.purpose}` : ""
              return (
                `${p.email} (${p.type}, ${p.status}${purpose}` +
                (p.last_sync_at
                  ? `, last sync ${new Date(p.last_sync_at).toLocaleDateString()}`
                  : "") +
                ")"
              )
            })
            .join("; ") +
          "."
      )
      lines.push(
        "When answering which email has a service, use the inbox purpose tags and the multi-inbox groups below."
      )
    }
  }

  if (on("subscriptions")) {
    const subs = listSubscriptions(userId) as SubWithAmount[]
    const active = subs.filter((s) => s.status === "active")
    const review = subs.filter((s) => s.status === "unknown")
    const monthly = active.reduce((t, s) => t + monthlyAmount(s), 0)
    lines.push(
      `Subscriptions: ${subs.length} detected, ${active.length} confirmed active, ${review.length} awaiting review.` +
        (monthly > 0 ? ` ~$${monthly.toFixed(0)}/mo across confirmed.` : "")
    )
    if (active.length > 0) {
      const withAmounts = active.filter((s) => s.amount != null).slice(0, 5)
      const noAmounts = active.filter((s) => s.amount == null).slice(0, 3)
      const parts = [
        ...withAmounts.map(
          (s) =>
            `${s.company} ($${s.amount!.toFixed(2)}/${s.billing_cycle === "yearly" ? "yr" : "mo"})`
        ),
        ...noAmounts.map((s) => s.company),
      ]
      if (parts.length > 0) lines.push(`Active subscriptions: ${parts.join(", ")}.`)
    }
    if (review.length > 0) {
      lines.push(
        "Subscriptions needing review (sorted by confidence): " +
          review
            .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
            .slice(0, 8)
            .map((s) => `${s.company} (${s.provider_email ?? s.email_used ?? "inbox"})`)
            .join(", ") +
          "."
      )
    }
    const subGroups = listSubscriptionGroups(userId)
    const multiSubs = subGroups.filter((g) => g.multiInbox).slice(0, 8)
    if (multiSubs.length > 0) {
      lines.push(
        "Subscriptions on multiple inboxes: " +
          multiSubs.map((g) => `${g.company} → ${g.inboxes.join(" + ")}`).join("; ") +
          "."
      )
    }
  }

  if (on("accounts")) {
    const accounts = listAccounts(userId)
    const active = accounts.filter((a) => a.status === "active")
    const review = accounts.filter((a) => a.status === "unknown")
    lines.push(
      `Accounts discovered: ${accounts.length} total, ${active.length} marked active, ${review.length} awaiting review.`
    )
    if (review.length > 0) {
      lines.push(
        "Accounts needing review: " +
          review
            .slice(0, 8)
            .map((a) => `${a.company} (${a.provider_email ?? a.email ?? "inbox"})`)
            .join(", ") +
          "."
      )
    }
    const acctGroups = listAccountGroups(userId)
    const multi = acctGroups.filter((g) => g.multiInbox).slice(0, 10)
    if (multi.length > 0) {
      lines.push(
        "Services on multiple inboxes: " +
          multi.map((g) => `${g.company} → ${g.inboxes.join(" + ")}`).join("; ") +
          "."
      )
    }
    const byInbox = acctGroups
      .filter((g) => !g.multiInbox)
      .slice(0, 12)
      .map((g) => `${g.company} on ${g.inboxes[0] ?? "?"}`)
    if (byInbox.length > 0) {
      lines.push("Sample account→inbox map: " + byInbox.join("; ") + ".")
    }
  }

  if (on("metadata")) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const newSince = countEmailsSince(dayAgo, userId)
    const recent = listRecentEmails(12, userId)
    lines.push(`New messages in the last 24h: ${newSince}.`)
    // Compressed intent/cluster digest — preferred over raw inbox dumps.
    lines.push(buildDigestContext(24))
    if (recent.length > 0) {
      lines.push("Most recent messages:")
      for (const e of recent) {
        const base = `- ${senderName(e.from_address)} — ${e.subject ?? "(no subject)"}`
        // Only attach the snippet (message text) when the content scope is on.
        lines.push(on("content") && e.snippet ? `${base} — "${e.snippet}"` : base)
      }
    }
  }

  return lines.join("\n")
}

/** Deterministic triage briefing derived from real detection state. */
export function buildBriefing(userId = getLocalUserId()): Briefing {
  const subs = listSubscriptions(userId)
  const accounts = listAccounts(userId)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const newSinceLast = countEmailsSince(dayAgo, userId)

  const reviewSubs = subs.filter((s) => s.status === "unknown")
  const reviewAccts = accounts.filter((a) => a.status === "unknown")
  const needsReply = reviewSubs.length + reviewAccts.length

  const conf = (n: number | null) => (n == null ? 0 : Math.round(n * 100))

  // Deal with first: highest-confidence unreviewed detections.
  const dealFirst: BriefItem[] = [...reviewSubs, ...reviewAccts]
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 4)
    .map((item) => {
      if ("category" in item) {
        const sub = item as SubWithAmount
        const amtStr =
          sub.amount != null
            ? ` · ${sub.billing_cycle === "yearly" ? `$${sub.amount.toFixed(2)}/yr` : `$${sub.amount.toFixed(2)}/mo`}`
            : ""
        return {
          t: `Confirm subscription — ${item.company}`,
          meta: `${item.category ?? "recurring"}${amtStr} · ${conf(item.confidence)}% match`,
        }
      }
      return {
        t: `Review account — ${item.company}`,
        meta: `${(item as LocalAccount).domain ?? "service"} · ${conf(item.confidence)}% match`,
      }
    })

  // Can wait: confirmed-active items, surfaced lightly.
  const activeSubs = subs.filter((s) => s.status === "active")
  const activeAccts = accounts.filter((a) => a.status === "active")
  const canWait: BriefItem[] = []
  if (activeSubs.length > 0) {
    canWait.push({
      t: `${activeSubs.length} active subscription${activeSubs.length === 1 ? "" : "s"} tracked`,
      meta: activeSubs
        .slice(0, 3)
        .map((s) => s.company)
        .join(", "),
    })
  }
  if (activeAccts.length > 0) {
    canWait.push({
      t: `${activeAccts.length} account${activeAccts.length === 1 ? "" : "s"} confirmed active`,
      meta: activeAccts
        .slice(0, 3)
        .map((a) => a.company)
        .join(", "),
    })
  }

  // Safe to ignore: things already dismissed or low-signal.
  const ignoredSubs = subs.filter((s) => s.status === "ignored")
  const ignoredAccts = accounts.filter((a) => a.status === "ignore")
  const ignore: BriefItem[] = []
  if (ignoredSubs.length + ignoredAccts.length > 0) {
    ignore.push({
      t: `${ignoredSubs.length + ignoredAccts.length} item${ignoredSubs.length + ignoredAccts.length === 1 ? "" : "s"} you've ignored`,
      meta: "Hidden from your active view",
    })
  }
  const lowConf = [...subs, ...accounts].filter(
    (x) => x.status === "unknown" && (x.confidence ?? 0) < 0.5
  )
  if (lowConf.length > 0) {
    ignore.push({
      t: `${lowConf.length} low-confidence guesses`,
      meta: "Under 50% — probably noise",
    })
  }

  const inboxLoad: Briefing["inboxLoad"] =
    newSinceLast === 0
      ? "Quiet"
      : newSinceLast < 20
        ? "Light"
        : newSinceLast < 60
          ? "Normal"
          : "Busy"

  return { newSinceLast, needsReply, inboxLoad, dealFirst, canWait, ignore }
}
