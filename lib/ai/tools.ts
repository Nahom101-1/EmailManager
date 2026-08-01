/**
 * Tool implementations the assistant can call for retrieval / digest / explain.
 */

import { getEmailById, listSubscriptions, getLocalUserId, getAiSettings } from "@/lib/db/local"
import {
  getCluster,
  getDailyDigestRows,
  getIntelligence,
  getOverviewStats,
  listClusters,
  listIntelligenceByIntent,
  listOverviewDaily,
  upsertEmailIntelligence,
  getEmailEmbedding,
} from "@/lib/db/intelligence"
import { hybridSearchEmails } from "@/lib/ai/search"
import { classifyIntent, EMAIL_INTENTS, type EmailIntent } from "@/lib/ai/intent"
import { extractWithRules } from "@/lib/ai/extract"

export const ASSISTANT_TOOLS = [
  {
    name: "search_emails",
    description:
      "Hybrid search over the user's emails (keyword + semantic). Use for finding receipts, vendors, topics.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language or keyword query" },
        limit: { type: "number", description: "Max results (default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_daily_digest_inputs",
    description:
      "Return compressed daily digest inputs: corpus rollups, intent counts, money events, action items, clusters.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours: { type: "number", description: "Lookback window in hours (default 24)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "list_by_intent",
    description: "List recent emails classified with a given intent.",
    input_schema: {
      type: "object" as const,
      properties: {
        intent: {
          type: "string",
          enum: EMAIL_INTENTS,
          description: "Intent label",
        },
        limit: { type: "number" },
      },
      required: ["intent"],
    },
  },
  {
    name: "get_cluster",
    description: "Get a near-duplicate email cluster by id, or list top clusters if id omitted.",
    input_schema: {
      type: "object" as const,
      properties: {
        cluster_id: { type: "string", description: "Cluster id (optional)" },
      },
      required: [] as string[],
    },
  },
  {
    name: "explain_subscription",
    description: "Explain a subscription using its evidence email and extracted fields.",
    input_schema: {
      type: "object" as const,
      properties: {
        subscription_id: { type: "string" },
        company: { type: "string", description: "Company name if id unknown" },
      },
      required: [] as string[],
    },
  },
  {
    name: "reclassify_email",
    description: "Re-run intent classification for an email id.",
    input_schema: {
      type: "object" as const,
      properties: {
        email_id: { type: "string" },
      },
      required: ["email_id"],
    },
  },
]

export async function runAssistantTool(
  name: string,
  rawInput: Record<string, unknown>
): Promise<string> {
  const settings = getAiSettings()
  const allowContent = Boolean(settings.scopes.content)
  const allowMetadata = Boolean(settings.scopes.metadata)

  switch (name) {
    case "search_emails": {
      if (!allowMetadata && !allowContent) {
        return JSON.stringify({ error: "metadata or content scope required for email search" })
      }
      const query = String(rawInput.query ?? "")
      const limit = Number(rawInput.limit ?? 8)
      const hits = await hybridSearchEmails(query, Math.min(20, limit || 8))
      return JSON.stringify(
        hits.map((h) => ({
          emailId: h.emailId,
          from: h.fromAddress,
          subject: h.subject,
          date: h.date,
          score: Number(h.score.toFixed(3)),
          source: h.source,
          intent: h.intent ?? null,
          // Snippets are message content — only when content scope is on.
          snippet: allowContent ? (h.snippet?.slice(0, 160) ?? null) : null,
        })),
        null,
        0
      )
    }
    case "get_daily_digest_inputs": {
      const hours = Number(rawInput.hours ?? 24) || 24
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      const overview = getOverviewStats()
      const rows = getDailyDigestRows(since, undefined, 40)
      const daily = listOverviewDaily(undefined, 7)

      const byIntent: Record<string, number> = {}
      const money: Array<Record<string, unknown>> = []
      const actions: Array<Record<string, unknown>> = []

      for (const row of rows) {
        byIntent[row.intent] = (byIntent[row.intent] ?? 0) + 1
        if (row.amount != null && money.length < 10) {
          money.push({
            vendor: row.vendor,
            amount: row.amount,
            currency: row.currency,
            cycle: row.billing_cycle,
            subject: row.subject,
            date: row.date,
          })
        }
        if (
          actions.length < 10 &&
          (row.intent === "security" ||
            row.intent === "action_required" ||
            row.intent === "needs_reply" ||
            row.intent === "renewal" ||
            row.intent === "trial" ||
            row.uncertain)
        ) {
          actions.push({
            intent: row.intent,
            vendor: row.vendor,
            subject: row.subject,
            from: row.from_address,
            dueDate: row.due_date,
            confidence: row.intent_confidence,
          })
        }
      }

      const clusters = listClusters(10).filter((c) => c.size > 1)

      return JSON.stringify(
        {
          windowHours: hours,
          corpus: overview
            ? {
                emails: overview.email_count,
                embedded: overview.embedded_count,
                classified: overview.classified_count,
                intents: overview.intent_counts,
                moneyEvents: overview.money_event_count,
                actions: overview.action_count,
                clusters: overview.cluster_count,
              }
            : null,
          windowIntentCounts: byIntent,
          actions,
          moneyEvents: money,
          recentDays: daily.map((d) => ({
            day: d.day,
            emails: d.email_count,
            actions: d.action_count,
            money: d.money_event_count,
          })),
          clusters: clusters.map((c) => ({
            id: c.id,
            label: c.label,
            intent: c.intent,
            size: c.size,
          })),
        },
        null,
        0
      )
    }
    case "list_by_intent": {
      const intent = String(rawInput.intent) as EmailIntent
      if (!EMAIL_INTENTS.includes(intent)) {
        return JSON.stringify({ error: "invalid intent" })
      }
      const limit = Number(rawInput.limit ?? 12)
      const rows = listIntelligenceByIntent(intent, Math.min(30, limit || 12))
      return JSON.stringify(
        rows.map((r) => ({
          emailId: r.email_id,
          subject: r.subject,
          from: r.from_address,
          date: r.date,
          confidence: r.intent_confidence,
          vendor: r.vendor,
          amount: r.amount,
        })),
        null,
        0
      )
    }
    case "get_cluster": {
      const clusterId = rawInput.cluster_id ? String(rawInput.cluster_id) : null
      if (!clusterId) {
        return JSON.stringify(
          listClusters(12).map((c) => ({
            id: c.id,
            label: c.label,
            intent: c.intent,
            size: c.size,
            representativeId: c.representativeId,
          })),
          null,
          0
        )
      }
      const cluster = getCluster(clusterId)
      if (!cluster) return JSON.stringify({ error: "cluster not found" })
      const members = cluster.memberIds.slice(0, 12).map((id) => {
        const email = getEmailById(id)
        return {
          emailId: id,
          subject: email?.subject ?? null,
          from: email?.from_address ?? null,
          date: email?.date ?? null,
        }
      })
      return JSON.stringify({ ...cluster, members }, null, 0)
    }
    case "explain_subscription": {
      const subs = listSubscriptions(getLocalUserId())
      const id = rawInput.subscription_id ? String(rawInput.subscription_id) : null
      const company = rawInput.company ? String(rawInput.company).toLowerCase() : null
      const sub = id
        ? subs.find((s) => s.id === id)
        : company
          ? subs.find((s) => s.company.toLowerCase() === company)
          : null
      if (!sub) return JSON.stringify({ error: "subscription not found" })

      const evidence = sub.source_email_id ? getEmailById(sub.source_email_id) : null
      const intel = sub.source_email_id ? getIntelligence(sub.source_email_id) : null
      return JSON.stringify(
        {
          id: sub.id,
          company: sub.company,
          category: sub.category,
          status: sub.status,
          confidence: sub.confidence,
          source: sub.source,
          amount: (sub as { amount?: number | null }).amount ?? intel?.amount ?? null,
          billingCycle:
            (sub as { billing_cycle?: string | null }).billing_cycle ??
            intel?.billing_cycle ??
            null,
          evidence: evidence
            ? {
                emailId: evidence.id,
                from: evidence.from_address,
                subject: evidence.subject,
                date: evidence.date,
                snippet: allowContent ? evidence.snippet : null,
                intent: intel?.intent ?? null,
                vendor: intel?.vendor ?? null,
              }
            : null,
        },
        null,
        0
      )
    }
    case "reclassify_email": {
      const emailId = String(rawInput.email_id ?? "")
      const email = getEmailById(emailId)
      if (!email) return JSON.stringify({ error: "email not found" })
      const emb = getEmailEmbedding(emailId)
      const result = classifyIntent({
        from: email.from_address,
        subject: email.subject,
        snippet: email.snippet,
        labels: email.labels,
        headers: email.headers,
        vector: emb?.vector,
      })
      const extract = extractWithRules({
        from: email.from_address,
        subject: email.subject,
        snippet: email.snippet,
        intent: result.intent,
      })
      upsertEmailIntelligence({
        emailId,
        intent: result.intent,
        intentConfidence: result.confidence,
        uncertain: result.uncertain,
        extract,
        reasons: result.reasons,
      })
      return JSON.stringify({
        emailId,
        intent: result.intent,
        confidence: result.confidence,
        uncertain: result.uncertain,
        reasons: result.reasons,
        extract,
      })
    }
    default:
      return JSON.stringify({ error: `unknown tool ${name}` })
  }
}

/** Compressed digest block for briefing context — uses rollups + top-K. */
export function buildDigestContext(hours = 24): string {
  const overview = getOverviewStats()
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const rows = getDailyDigestRows(since, undefined, 40)
  const clusters = listClusters(8).filter((c) => c.size > 1)

  const lines: string[] = []

  if (overview) {
    lines.push(
      `Corpus: ${overview.email_count} emails · ${overview.embedded_count} embedded · ${overview.classified_count} classified · ${overview.cluster_count} clusters.`
    )
    const intentStr = (Object.entries(overview.intent_counts) as Array<[string, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    if (intentStr) lines.push(`All-time intents: ${intentStr}.`)
    lines.push(
      `Money events: ${overview.money_event_count}; action-like: ${overview.action_count}.`
    )
  }

  if (rows.length === 0) {
    lines.push(`Last ${hours}h: no newly classified messages in the lookback window.`)
  } else {
    const byIntent: Record<string, number> = {}
    let moneyCount = 0
    let actionCount = 0
    for (const row of rows) {
      byIntent[row.intent] = (byIntent[row.intent] ?? 0) + 1
      if (row.amount != null) moneyCount += 1
      if (
        ["security", "action_required", "needs_reply", "renewal", "trial"].includes(row.intent) ||
        row.uncertain
      ) {
        actionCount += 1
      }
    }
    lines.push(
      `Last ${hours}h sample: ${rows.length} top items · intents ${Object.entries(byIntent)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")} · actions ${actionCount} · money ${moneyCount}.`
    )

    const topActions = rows
      .filter((r) =>
        ["security", "action_required", "needs_reply", "renewal", "trial"].includes(r.intent)
      )
      .slice(0, 5)
    if (topActions.length > 0) {
      lines.push("Top action items:")
      for (const a of topActions) {
        lines.push(
          `- [${a.intent}] ${a.vendor ?? a.from_address ?? "unknown"} — ${a.subject ?? "(no subject)"}` +
            (a.amount != null ? ` ($${a.amount})` : "")
        )
      }
    }
  }

  if (clusters.length > 0) {
    lines.push(
      "Collapsed clusters: " +
        clusters
          .slice(0, 5)
          .map((c) => c.label)
          .join("; ") +
        "."
    )
  }

  return lines.join("\n") || "Email intelligence digest: nothing indexed yet. Run a sync."
}
