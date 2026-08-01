/**
 * Suggest purpose tags for connected inboxes (personal / work / shopping).
 */

import { callClaude, AiUnavailableError } from "@/lib/ai/client"
import {
  getAiSettings,
  getProviderTag,
  listProviders,
  listRecentEmails,
  setProviderTag,
  type ProviderPurpose,
  type ProviderTag,
} from "@/lib/db/local"

const PURPOSES: ProviderPurpose[] = ["personal", "work", "shopping", "other"]

function heuristicPurpose(email: string): ProviderPurpose {
  const lower = email.toLowerCase()
  if (/work|corp|company|job|office/.test(lower)) return "work"
  if (/shop|buy|deals|promo/.test(lower)) return "shopping"
  if (/gmail|icloud|yahoo|hotmail|outlook|proton|me\.com/.test(lower)) return "personal"
  return "other"
}

export async function suggestProviderTags(input?: {
  force?: boolean
}): Promise<{ updated: number; tags: Record<string, ProviderTag> }> {
  const providers = listProviders()
  const settings = getAiSettings()
  const recent = listRecentEmails(40)
  const tags: Record<string, ProviderTag> = {}
  let updated = 0

  const samples = providers.map((p) => {
    const msgs = recent
      .filter((e) => e.provider_email?.toLowerCase() === p.email.toLowerCase())
      .slice(0, 5)
      .map((e) => `${e.from_address ?? ""} — ${e.subject ?? ""}`)
    return { id: p.id, email: p.email, samples: msgs }
  })

  let llmMap: Record<string, ProviderPurpose> | null = null
  if (settings.cloudAiEnabled && samples.length > 0) {
    try {
      const prompt =
        `Classify each inbox purpose as one of: personal, work, shopping, other.\n` +
        `Reply JSON only: {"tags":[{"id":"...","purpose":"..."}]}\n\n` +
        samples
          .map(
            (s) =>
              `Inbox ${s.id} <${s.email}>\n` +
              (s.samples.length ? s.samples.map((m) => `  - ${m}`).join("\n") : "  (no recent mail)")
          )
          .join("\n\n")
      const text = await callClaude(
        "You classify personal email inboxes by purpose. JSON only.",
        [{ role: "user", content: prompt }]
      )
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as {
          tags?: Array<{ id?: string; purpose?: string }>
        }
        llmMap = {}
        for (const row of parsed.tags ?? []) {
          if (row.id && PURPOSES.includes(row.purpose as ProviderPurpose)) {
            llmMap[row.id] = row.purpose as ProviderPurpose
          }
        }
      }
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) {
        console.warn("[provider-tags] AI suggest failed:", err)
      }
    }
  }

  for (const p of providers) {
    const existing = getProviderTag(p.id)
    if (existing?.source === "user" && !input?.force) {
      tags[p.id] = existing
      continue
    }
    const purpose = llmMap?.[p.id] ?? heuristicPurpose(p.email)
    const tag: ProviderTag = { purpose, source: "ai" }
    setProviderTag(p.id, tag)
    tags[p.id] = tag
    updated += 1
  }

  return { updated, tags }
}
