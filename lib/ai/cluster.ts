/**
 * Simple agglomerative clustering of emails by embedding cosine similarity.
 * Groups near-duplicates (same vendor receipts, newsletter series) for digests.
 */

import { cosineSimilarity } from "@/lib/ai/embeddings"
import type { EmailIntent } from "@/lib/ai/intent"

export interface ClusterableEmail {
  id: string
  vector: Float32Array
  intent: EmailIntent
  fromAddress: string | null
  subject: string | null
  date: string | null
}

export interface EmailCluster {
  id: string
  intent: EmailIntent
  memberIds: string[]
  representativeId: string
  label: string
  size: number
}

const DEFAULT_THRESHOLD = 0.82

function senderKey(from: string | null): string {
  if (!from) return "unknown"
  const email = from.match(/<([^>]+)>/)?.[1] ?? from
  const domain = email.split("@")[1]?.toLowerCase() ?? email.toLowerCase()
  return domain.replace(/^(mail|email|no-?reply|notifications?)\./, "")
}

/**
 * Greedy clustering: assign each email to the first cluster with same intent,
 * same sender domain, and cosine ≥ threshold; else start a new cluster.
 */
export function clusterEmails(
  emails: ClusterableEmail[],
  threshold = DEFAULT_THRESHOLD
): EmailCluster[] {
  const clusters: Array<{
    intent: EmailIntent
    sender: string
    centroid: Float32Array
    members: ClusterableEmail[]
  }> = []

  const sorted = [...emails].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))

  for (const email of sorted) {
    const sender = senderKey(email.fromAddress)
    let bestIdx = -1
    let bestScore = -1

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i]
      if (c.intent !== email.intent || c.sender !== sender) continue
      const score = cosineSimilarity(email.vector, c.centroid)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    if (bestIdx >= 0 && bestScore >= threshold) {
      const c = clusters[bestIdx]
      c.members.push(email)
      // Incremental mean of normalized vectors (approx centroid).
      const n = c.members.length
      for (let d = 0; d < c.centroid.length; d++) {
        c.centroid[d] = c.centroid[d] * ((n - 1) / n) + email.vector[d] / n
      }
    } else {
      clusters.push({
        intent: email.intent,
        sender,
        centroid: new Float32Array(email.vector),
        members: [email],
      })
    }
  }

  return clusters.map((c, idx) => {
    const representative = c.members[0]
    const label =
      c.members.length > 1
        ? `${c.intent} · ${c.sender} (${c.members.length})`
        : `${c.intent} · ${representative.subject ?? c.sender}`
    return {
      id: `cluster-${idx}-${c.sender}-${c.intent}`,
      intent: c.intent,
      memberIds: c.members.map((m) => m.id),
      representativeId: representative.id,
      label,
      size: c.members.length,
    }
  })
}
