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

export interface MutableCluster {
  id: string
  intent: EmailIntent
  sender: string
  centroid: Float32Array
  memberIds: string[]
  representativeId: string
  label: string
}

/** Assign new emails into existing clusters; creates new clusters when needed. */
export function assignToClusters(
  existing: MutableCluster[],
  emails: ClusterableEmail[],
  threshold = DEFAULT_THRESHOLD
): { clusters: MutableCluster[]; assignments: Array<{ emailId: string; clusterId: string }> } {
  const clusters: MutableCluster[] = existing.map((c) => ({
    ...c,
    centroid: new Float32Array(c.centroid),
    memberIds: [...c.memberIds],
  }))
  const assignments: Array<{ emailId: string; clusterId: string }> = []

  for (const email of emails) {
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
      c.memberIds.push(email.id)
      const n = c.memberIds.length
      for (let d = 0; d < c.centroid.length; d++) {
        c.centroid[d] = c.centroid[d] * ((n - 1) / n) + email.vector[d] / n
      }
      c.label =
        n > 1 ? `${c.intent} · ${c.sender} (${n})` : `${c.intent} · ${email.subject ?? c.sender}`
      assignments.push({ emailId: email.id, clusterId: c.id })
    } else {
      const id = `cluster-${Date.now().toString(36)}-${sender}-${email.intent}-${email.id.slice(0, 8)}`
      clusters.push({
        id,
        intent: email.intent,
        sender,
        centroid: new Float32Array(email.vector),
        memberIds: [email.id],
        representativeId: email.id,
        label: `${email.intent} · ${email.subject ?? sender}`,
      })
      assignments.push({ emailId: email.id, clusterId: id })
    }
  }

  return { clusters, assignments }
}

export function clusterToEmailCluster(c: MutableCluster): EmailCluster {
  return {
    id: c.id,
    intent: c.intent,
    memberIds: c.memberIds,
    representativeId: c.representativeId,
    label: c.label,
    size: c.memberIds.length,
  }
}
