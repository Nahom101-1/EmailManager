/**
 * Read helpers for UI surfaces (People, Waiting, History) from existing
 * intelligence + email rows — no new claim schema.
 */

import { getDb, getLocalUserId } from "@/lib/db/local"
import type { EmailIntent } from "@/lib/ai/intent"

export type IntentEmailRow = {
  emailId: string
  intent: EmailIntent
  uncertain: number
  intentConfidence: number
  vendor: string | null
  dueDate: string | null
  subject: string | null
  fromAddress: string | null
  date: string | null
  snippet: string | null
  providerEmail: string | null
}

export function listEmailsByIntents(
  intents: EmailIntent[],
  opts: { userId?: string; limit?: number; sinceIso?: string } = {}
): IntentEmailRow[] {
  if (intents.length === 0) return []
  const userId = opts.userId ?? getLocalUserId()
  const limit = opts.limit ?? 40
  const placeholders = intents.map(() => "?").join(",")
  const params: unknown[] = [userId, ...intents]
  let sinceClause = ""
  if (opts.sinceIso) {
    sinceClause = "and coalesce(e.date, e.created_at) >= ?"
    params.push(opts.sinceIso)
  }
  params.push(limit)

  return getDb()
    .prepare(
      `
      select e.id as emailId, i.intent, i.uncertain, i.intent_confidence as intentConfidence,
             i.vendor, i.due_date as dueDate,
             e.subject, e.from_address as fromAddress, e.date, e.snippet,
             p.email as providerEmail
      from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ? and i.intent in (${placeholders})
        ${sinceClause}
      order by i.intent_confidence desc, coalesce(e.date, e.created_at) desc
      limit ?
    `
    )
    .all(...params) as IntentEmailRow[]
}

export type SenderAgg = {
  address: string
  display: string
  count: number
  lastDate: string | null
  sampleSubject: string | null
  sampleEmailId: string | null
  needsReplyCount: number
  uncertainCount: number
}

/** Aggregate senders from recent mail + needs_reply intents. */
export function listTopSenders(opts: { userId?: string; limit?: number } = {}): SenderAgg[] {
  const userId = opts.userId ?? getLocalUserId()
  const limit = opts.limit ?? 40

  const rows = getDb()
    .prepare(
      `
      select e.id as emailId, e.from_address as fromAddress, e.subject, e.date,
             i.intent, i.uncertain
      from emails e
      join providers p on p.id = e.provider_id
      left join email_intelligence i on i.email_id = e.id
      where p.user_id = ? and e.from_address is not null and trim(e.from_address) != ''
      order by coalesce(e.date, e.created_at) desc
      limit 400
    `
    )
    .all(userId) as Array<{
    emailId: string
    fromAddress: string
    subject: string | null
    date: string | null
    intent: string | null
    uncertain: number | null
  }>

  const map = new Map<string, SenderAgg>()
  for (const row of rows) {
    const address = normalizeAddress(row.fromAddress)
    if (!address || isAutomated(address)) continue
    const existing = map.get(address)
    if (existing) {
      existing.count += 1
      if (row.intent === "needs_reply") existing.needsReplyCount += 1
      if (row.uncertain) existing.uncertainCount += 1
      if (!existing.lastDate || (row.date && row.date > existing.lastDate)) {
        existing.lastDate = row.date
        existing.sampleSubject = row.subject
        existing.sampleEmailId = row.emailId
      }
    } else {
      map.set(address, {
        address,
        display: displayFrom(row.fromAddress),
        count: 1,
        lastDate: row.date,
        sampleSubject: row.subject,
        sampleEmailId: row.emailId,
        needsReplyCount: row.intent === "needs_reply" ? 1 : 0,
        uncertainCount: row.uncertain ? 1 : 0,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (a.needsReplyCount !== b.needsReplyCount) return b.needsReplyCount - a.needsReplyCount
      return b.count - a.count
    })
    .slice(0, limit)
}

function normalizeAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  return (m ? m[1] : raw).trim().toLowerCase()
}

function displayFrom(raw: string): string {
  const named = raw.match(/^\s*"?([^"<]+?)"?\s*</)
  if (named) return named[1].trim()
  return normalizeAddress(raw)
}

function isAutomated(address: string): boolean {
  return /^(no-?reply|noreply|mailer-daemon|notifications?|news(letter)?|billing|receipts?)@/i.test(
    address
  )
}
