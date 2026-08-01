/**
 * Hybrid search: FTS5 keyword precision + embedding cosine recall.
 */

import { cosineSimilarity, embedText } from "@/lib/ai/embeddings"
import {
  ftsSearchEmails,
  listAllEmbeddings,
  searchSubscriptionsAccounts,
} from "@/lib/db/intelligence"

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

export async function hybridSearchEmails(
  query: string,
  limit = 12
): Promise<HybridEmailHit[]> {
  const q = query.trim()
  if (!q) return []

  const ftsHits = ftsSearchEmails(q, limit * 2)
  const ftsScores = new Map<string, { hit: (typeof ftsHits)[0]; score: number }>()
  ftsHits.forEach((hit, idx) => {
    // bm25 is lower-is-better; invert into a 0..1-ish score.
    const score = 1 / (1 + Math.max(0, hit.rank + 3)) + (ftsHits.length - idx) * 0.01
    ftsScores.set(hit.email_id, { hit, score })
  })

  const { vector } = await embedText(q)
  const embeddings = listAllEmbeddings()
  const vectorHits = embeddings
    .map((e) => ({
      emailId: e.email_id,
      subject: e.subject,
      snippet: e.snippet,
      fromAddress: e.from_address,
      date: e.date,
      intent: e.intent,
      score: cosineSimilarity(vector, e.vector),
    }))
    .filter((h) => h.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit * 2)

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
