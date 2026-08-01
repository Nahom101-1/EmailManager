/**
 * Incremental post-sync email intelligence:
 * embed (batched) → intent → extract → incremental cluster → FTS → overview rollups.
 */

import {
  emailEmbedText,
  embedTexts,
  EMBEDDING_DIMS,
} from "@/lib/ai/embeddings"
import { classifyIntent, warmIntentPrototypes } from "@/lib/ai/intent"
import {
  assignToClusters,
  clusterToEmailCluster,
  type ClusterableEmail,
} from "@/lib/ai/cluster"
import { extractFields, isHighSignal } from "@/lib/ai/extract"
import { invalidateEmbeddingCache } from "@/lib/ai/vector-cache"
import { getAiSettings, getGoogleAccount, getLocalUserId } from "@/lib/db/local"
import { getValidGoogleAccessToken } from "@/lib/google/oauth"
import {
  countEmailsNeedingIntelligence,
  getClusterRebuildDebt,
  getEmailEmbedding,
  listAllEmbeddings,
  listEmailsNeedingIntelligence,
  loadMutableClusters,
  refreshOverviewRollups,
  replaceClusters,
  setClusterRebuildDebt,
  updateEmailBodyText,
  updateEmailClusterIds,
  upsertEmailEmbeddingsBatch,
  upsertEmailFts,
  upsertEmailIntelligence,
  type EmailForIntelligence,
} from "@/lib/db/intelligence"

const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
const MAX_BODY_FETCH = 8
const MAX_LLM_EXTRACT = 3
const MAX_PER_RUN = 300
const FULL_REBUILD_EVERY = 200

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function looksHighSignalForBody(email: EmailForIntelligence): boolean {
  const hay = `${email.subject ?? ""} ${email.snippet ?? ""}`.toLowerCase()
  return /receipt|invoice|renew|trial|payment|security|verify|password|billing|charged|subscription/.test(
    hay
  )
}

async function fetchGmailBodyText(input: {
  accessToken: string
  gmailMessageId: string
}): Promise<string | null> {
  const url = new URL(`${GMAIL_MESSAGES_URL}/${input.gmailMessageId}`)
  url.searchParams.set("format", "full")

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    snippet?: string
    payload?: {
      mimeType?: string
      body?: { data?: string }
      parts?: Array<{
        mimeType?: string
        body?: { data?: string }
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>
      }>
    }
  }

  const texts: string[] = []
  const walk = (part?: {
    mimeType?: string
    body?: { data?: string }
    parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>
  }) => {
    if (!part) return
    if (part.mimeType === "text/plain" && part.body?.data) {
      texts.push(Buffer.from(part.body.data, "base64url").toString("utf8"))
    }
    if (part.parts) {
      for (const child of part.parts as Array<typeof part>) walk(child)
    }
  }
  walk(data.payload)

  const body = texts.join("\n").replace(/\s+/g, " ").trim()
  return body.slice(0, 8000) || data.snippet || null
}

async function maybeFetchBodies(input: {
  providerId: string
  origin: string
  emails: EmailForIntelligence[]
}) {
  const candidates = input.emails
    .filter((e) => !e.body_text && e.gmail_message_id && looksHighSignalForBody(e))
    .slice(0, MAX_BODY_FETCH)

  if (candidates.length === 0) return

  const account = getGoogleAccount(input.providerId)
  if (!account) return

  try {
    const accessToken = await getValidGoogleAccessToken({ account, origin: input.origin })
    for (const email of candidates) {
      if (!email.gmail_message_id) continue
      const body = await fetchGmailBodyText({
        accessToken,
        gmailMessageId: email.gmail_message_id,
      })
      if (body) {
        updateEmailBodyText(email.id, body)
        email.body_text = body
      }
      await new Promise((r) => setTimeout(r, 80))
    }
  } catch (err) {
    console.warn("[pipeline] body fetch skipped:", err)
  }
}

export async function runEmailIntelligence(input: {
  providerId: string
  origin: string
}): Promise<{ embedded: number; classified: number; clusters: number; backlogRemaining: number }> {
  const settings = getAiSettings()
  // Cloud LLM extract only when cloud AI is on AND content scope is enabled.
  const allowContent = Boolean(settings.scopes.content)
  const allowLlm = settings.cloudAiEnabled && allowContent

  void warmIntentPrototypes().catch(() => {})

  const emails = listEmailsNeedingIntelligence(input.providerId, MAX_PER_RUN)
  const backlogBefore = countEmailsNeedingIntelligence(input.providerId)

  if (emails.length === 0) {
    refreshOverviewRollups(getLocalUserId())
    return {
      embedded: 0,
      classified: 0,
      clusters: loadMutableClusters().length,
      backlogRemaining: 0,
    }
  }

  // Body fetch is local-only storage; still respect content scope as the
  // privacy contract for reading message contents at all.
  if (allowContent) {
    await maybeFetchBodies({
      providerId: input.providerId,
      origin: input.origin,
      emails,
    })
  }

  // Batch-embed emails that still lack vectors.
  const needEmbed = emails.filter((e) => !getEmailEmbedding(e.id))
  const texts = needEmbed.map((e) =>
    emailEmbedText({
      from: e.from_address,
      subject: e.subject,
      snippet: e.snippet,
      bodyText: e.body_text,
    })
  )
  const embeddedVectors = texts.length > 0 ? await embedTexts(texts) : []
  if (embeddedVectors.length > 0) {
    upsertEmailEmbeddingsBatch(
      needEmbed.map((e, i) => ({
        emailId: e.id,
        model: embeddedVectors[i].model,
        dims: embeddedVectors[i].vector.length || EMBEDDING_DIMS,
        vector: embeddedVectors[i].vector,
      }))
    )
    invalidateEmbeddingCache()
  }

  let classified = 0
  let llmExtracts = 0
  const newlyClassified: ClusterableEmail[] = []

  for (const email of emails) {
    const emb = getEmailEmbedding(email.id)
    if (!emb) continue
    const vector = emb.vector

    const labels = safeJsonParse<string[]>(email.labels, [])
    const headers = safeJsonParse<Record<string, string>>(email.headers, {})
    const intentResult = classifyIntent({
      from: email.from_address,
      subject: email.subject,
      snippet: email.snippet,
      labels,
      headers,
      vector,
    })

    let extract = null
    if (isHighSignal(intentResult.intent, intentResult.uncertain)) {
      const useLlm = allowLlm && llmExtracts < MAX_LLM_EXTRACT
      extract = await extractFields({
        from: email.from_address,
        subject: email.subject,
        snippet: allowContent ? email.snippet : null,
        bodyText: allowContent ? email.body_text : null,
        intent: intentResult.intent,
        uncertain: intentResult.uncertain,
        allowLlm: useLlm,
        allowContent,
      })
      if (extract.source === "llm") llmExtracts += 1
    }

    upsertEmailIntelligence({
      emailId: email.id,
      intent: intentResult.intent,
      intentConfidence: intentResult.confidence,
      uncertain: intentResult.uncertain,
      extract,
      reasons: intentResult.reasons,
    })

    upsertEmailFts({
      emailId: email.id,
      subject: email.subject,
      snippet: email.snippet,
      fromAddress: email.from_address,
      bodyText: email.body_text,
    })

    newlyClassified.push({
      id: email.id,
      vector,
      intent: intentResult.intent,
      fromAddress: email.from_address,
      subject: email.subject,
      date: email.date,
    })
    classified += 1
  }

  const clusterCount = updateClustersIncremental(newlyClassified)
  refreshOverviewRollups(getLocalUserId())
  invalidateEmbeddingCache()

  const backlogRemaining = Math.max(0, backlogBefore - emails.length)

  return {
    embedded: needEmbed.length,
    classified,
    clusters: clusterCount,
    backlogRemaining,
  }
}

function updateClustersIncremental(newlyClassified: ClusterableEmail[]): number {
  if (newlyClassified.length === 0) {
    return loadMutableClusters().length
  }

  const debt = getClusterRebuildDebt() + newlyClassified.length
  const existing = loadMutableClusters()

  // Full rebuild when no clusters yet, missing centroids, or debt threshold hit.
  if (existing.length === 0 || debt >= FULL_REBUILD_EVERY) {
    const count = rebuildClustersFull()
    setClusterRebuildDebt(0)
    return count
  }

  const { clusters, assignments } = assignToClusters(existing, newlyClassified)
  replaceClusters(
    clusters.map((c) => ({
      ...clusterToEmailCluster(c),
      sender: c.sender,
      centroid: c.centroid,
    }))
  )
  updateEmailClusterIds(assignments)
  setClusterRebuildDebt(debt)
  return clusters.length
}

function rebuildClustersFull(): number {
  const embeddings = listAllEmbeddings()
  const clusterable = embeddings
    .filter((e) => e.intent)
    .map((e) => ({
      id: e.email_id,
      vector: e.vector,
      intent: e.intent!,
      fromAddress: e.from_address,
      subject: e.subject,
      date: e.date,
    }))

  const { clusters: mutable, assignments } = assignToClusters([], clusterable)
  replaceClusters(
    mutable.map((c) => ({
      ...clusterToEmailCluster(c),
      sender: c.sender,
      centroid: c.centroid,
    }))
  )
  updateEmailClusterIds(assignments)
  return mutable.length
}
