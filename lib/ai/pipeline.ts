/**
 * Post-sync email intelligence pipeline:
 * embed → intent → extract (high-signal) → cluster → FTS index.
 */

import {
  emailEmbedText,
  embedText,
  EMBEDDING_DIMS,
} from "@/lib/ai/embeddings"
import { classifyIntent, warmIntentPrototypes } from "@/lib/ai/intent"
import { clusterEmails } from "@/lib/ai/cluster"
import { extractFields, isHighSignal } from "@/lib/ai/extract"
import { getAiSettings } from "@/lib/db/local"
import {
  getEmailEmbedding,
  listAllEmbeddings,
  listEmailsByIds,
  listEmailsNeedingEmbed,
  replaceClusters,
  updateEmailBodyText,
  updateEmailClusterIds,
  upsertEmailEmbedding,
  upsertEmailFts,
  upsertEmailIntelligence,
  type EmailForIntelligence,
} from "@/lib/db/intelligence"
import { getValidGoogleAccessToken } from "@/lib/google/oauth"
import { getGoogleAccount } from "@/lib/db/local"

const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
const MAX_BODY_FETCH = 8
const MAX_LLM_EXTRACT = 3

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
      await new Promise((r) => setTimeout(r, 120))
    }
  } catch (err) {
    console.warn("[pipeline] body fetch skipped:", err)
  }
}

export async function runEmailIntelligence(input: {
  providerId: string
  origin: string
  emailIds?: string[]
}): Promise<{ embedded: number; classified: number; clusters: number }> {
  const settings = getAiSettings()
  const allowLlm = settings.cloudAiEnabled

  // Best-effort: upgrade prototype vectors with the transformer model.
  void warmIntentPrototypes().catch(() => {})

  let emails = listEmailsNeedingEmbed(input.providerId, input.emailIds)
  // Also reprocess explicitly requested emails even if already embedded.
  if (input.emailIds && input.emailIds.length > 0) {
    const existing = new Set(emails.map((e) => e.id))
    const extras = listEmailsByIds(input.emailIds).filter((e) => !existing.has(e.id))
    emails = [...emails, ...extras]
  }

  if (emails.length === 0 && (!input.emailIds || input.emailIds.length === 0)) {
    // Still refresh clusters from existing embeddings.
    const clusters = rebuildClusters()
    return { embedded: 0, classified: 0, clusters }
  }

  await maybeFetchBodies({
    providerId: input.providerId,
    origin: input.origin,
    emails,
  })

  let embedded = 0
  let classified = 0
  let llmExtracts = 0

  for (const email of emails) {
    const text = emailEmbedText({
      from: email.from_address,
      subject: email.subject,
      snippet: email.snippet,
      bodyText: email.body_text,
    })

    let vector = getEmailEmbedding(email.id)?.vector
    if (!vector) {
      const result = await embedText(text)
      upsertEmailEmbedding({
        emailId: email.id,
        model: result.model,
        dims: result.vector.length || EMBEDDING_DIMS,
        vector: result.vector,
      })
      vector = result.vector
      embedded += 1
    }

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
        snippet: email.snippet,
        bodyText: email.body_text,
        intent: intentResult.intent,
        uncertain: intentResult.uncertain,
        allowLlm: useLlm,
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

    classified += 1
  }

  const clusters = rebuildClusters()
  return { embedded, classified, clusters }
}

function rebuildClusters(): number {
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

  const clusters = clusterEmails(clusterable)
  replaceClusters(clusters)

  const assignments: Array<{ emailId: string; clusterId: string }> = []
  for (const c of clusters) {
    for (const emailId of c.memberIds) {
      assignments.push({ emailId, clusterId: c.id })
    }
  }
  updateEmailClusterIds(assignments)
  return clusters.length
}
