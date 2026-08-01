/**
 * In-process Float32 embedding matrix for hybrid search.
 * Avoids decoding every BLOB from SQLite on each keystroke.
 */

import { EMBEDDING_DIMS, bufferToVector } from "@/lib/ai/embeddings"
import { getDb, getLocalUserId } from "@/lib/db/local"
import type { EmailIntent } from "@/lib/ai/intent"

export interface CachedEmbeddingRow {
  emailId: string
  subject: string | null
  snippet: string | null
  fromAddress: string | null
  date: string | null
  intent: EmailIntent | null
  /** Offset into the shared matrix (row * dims). */
  offset: number
}

interface CacheState {
  userId: string
  count: number
  maxUpdatedAt: string
  model: string
  matrix: Float32Array
  rows: CachedEmbeddingRow[]
}

let cache: CacheState | null = null

export function invalidateEmbeddingCache() {
  cache = null
}

function cacheFingerprint(userId: string): { count: number; maxUpdatedAt: string; model: string } {
  const row = getDb()
    .prepare(
      `
      select count(*) as count,
             coalesce(max(emb.updated_at), '') as maxUpdatedAt,
             coalesce(max(emb.model), '') as model
      from email_embeddings emb
      join emails e on e.id = emb.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ?
    `
    )
    .get(userId) as { count: number; maxUpdatedAt: string; model: string }

  return row
}

function loadCache(userId: string): CacheState {
  const fp = cacheFingerprint(userId)
  if (
    cache &&
    cache.userId === userId &&
    cache.count === fp.count &&
    cache.maxUpdatedAt === fp.maxUpdatedAt
  ) {
    return cache
  }

  const rows = getDb()
    .prepare(
      `
      select emb.email_id, emb.model, emb.dims, emb.vector,
             e.from_address, e.subject, e.snippet, e.date,
             i.intent
      from email_embeddings emb
      join emails e on e.id = emb.email_id
      join providers p on p.id = e.provider_id
      left join email_intelligence i on i.email_id = e.id
      where p.user_id = ?
      order by emb.email_id
    `
    )
    .all(userId) as Array<{
    email_id: string
    model: string
    dims: number
    vector: Buffer
    from_address: string | null
    subject: string | null
    snippet: string | null
    date: string | null
    intent: EmailIntent | null
  }>

  const dims = EMBEDDING_DIMS
  const matrix = new Float32Array(rows.length * dims)
  const cachedRows: CachedEmbeddingRow[] = []

  rows.forEach((r, idx) => {
    const vec = bufferToVector(r.vector)
    const offset = idx * dims
    const n = Math.min(dims, vec.length)
    matrix.set(vec.subarray(0, n), offset)
    cachedRows.push({
      emailId: r.email_id,
      subject: r.subject,
      snippet: r.snippet,
      fromAddress: r.from_address,
      date: r.date,
      intent: r.intent,
      offset,
    })
  })

  cache = {
    userId,
    count: fp.count,
    maxUpdatedAt: fp.maxUpdatedAt,
    model: fp.model,
    matrix,
    rows: cachedRows,
  }
  return cache
}

export function getEmbeddingCache(userId = getLocalUserId()): CacheState {
  return loadCache(userId)
}

/** Score query vector against the cached matrix; returns top hits. */
export function searchCachedVectors(
  query: Float32Array,
  limit: number,
  minScore = 0.25,
  userId = getLocalUserId()
): Array<{
  emailId: string
  subject: string | null
  snippet: string | null
  fromAddress: string | null
  date: string | null
  intent: EmailIntent | null
  score: number
}> {
  const state = getEmbeddingCache(userId)
  const dims = EMBEDDING_DIMS
  const scores: Array<{ idx: number; score: number }> = []

  for (let i = 0; i < state.rows.length; i++) {
    let dot = 0
    const base = i * dims
    for (let d = 0; d < dims; d++) {
      dot += query[d] * state.matrix[base + d]
    }
    if (dot > minScore) scores.push({ idx: i, score: dot })
  }

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, limit).map(({ idx, score }) => {
    const row = state.rows[idx]
    return {
      emailId: row.emailId,
      subject: row.subject,
      snippet: row.snippet,
      fromAddress: row.fromAddress,
      date: row.date,
      intent: row.intent,
      score,
    }
  })
}
