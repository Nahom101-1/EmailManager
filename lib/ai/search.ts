/**
 * Hybrid search: FTS5 keyword precision + cached embedding cosine recall.
 */

import { embedText } from "@/lib/ai/embeddings"
import { searchCachedVectors } from "@/lib/ai/vector-cache"
import { ftsSearchEmails, searchSubscriptionsAccounts } from "@/lib/db/intelligence"

export interface HybridEmailHit {
  emailId: string
  subject: string | null
  snippet: string | null
  fromAddress: string | null
  date: string | null
  score: number
  source: "fts" | "vector" | "both"
  intent?: string | null
}

export interface SearchResult {
  emails: HybridEmailHit[]
  entities: Array<{
    kind: "subscription" | "account"
    id: string
    title: string
    meta: string
  }>
}

export async function hybridSearchEmails(query: string, limit = 12): Promise<HybridEmailHit[]> {
  const q = query.trim()
  if (!q) return []

  const ftsHits = ftsSearchEmails(q, limit * 2)
  const ftsScores = new Map<string, { hit: (typeof ftsHits)[0]; score: number }>()
  ftsHits.forEach((hit, idx) => {
    const score = 1 / (1 + Math.max(0, hit.rank + 3)) + (ftsHits.length - idx) * 0.01
    ftsScores.set(hit.email_id, { hit, score })
  })

  const { vector } = await embedText(q)
  const vectorHits = searchCachedVectors(vector, limit * 2, 0.25)

  const merged = new Map<string, HybridEmailHit>()

  for (const [emailId, { hit, score }] of ftsScores) {
    merged.set(emailId, {
      emailId,
      subject: hit.subject,
      snippet: hit.snippet,
      fromAddress: hit.from_address,
      date: hit.date,
      score,
      source: "fts",
    })
  }

  for (const hit of vectorHits) {
    const existing = merged.get(hit.emailId)
    if (existing) {
      existing.score = existing.score * 0.55 + hit.score * 0.45 + 0.08
      existing.source = "both"
      existing.intent = hit.intent
    } else {
      merged.set(hit.emailId, {
        emailId: hit.emailId,
        subject: hit.subject,
        snippet: hit.snippet,
        fromAddress: hit.fromAddress,
        date: hit.date,
        score: hit.score,
        source: "vector",
        intent: hit.intent,
      })
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

export async function hybridSearch(query: string, limit = 12): Promise<SearchResult> {
  const [emails, entities] = await Promise.all([
    hybridSearchEmails(query, limit),
    Promise.resolve(searchSubscriptionsAccounts(query, undefined, limit)),
  ])
  return { emails, entities }
}
