import {
  createSyncRun,
  finishSyncRun,
  getEmailIdMap,
  getGoogleAccount,
  getProvider,
  hasRunningSyncRun,
  updateProviderSyncStatus,
  upsertDetectedAccounts,
  upsertDetectedSubscriptions,
  upsertGmailMessages,
  type DetectedAccountRecord,
  type DetectedSubscriptionRecord,
  type GmailMessageInput,
} from "@/lib/db/local"
import { detectAccount, detectSubscription } from "@/lib/detection"
import { getValidGoogleAccessToken } from "@/lib/google/oauth"
import { runEmailIntelligence } from "@/lib/ai/pipeline"

const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
const METADATA_HEADERS = [
  "From",
  "To",
  "Subject",
  "Date",
  "Message-ID",
  "List-Unsubscribe",
  "List-ID",
  "Reply-To",
  "Sender",
]
// Keep concurrency at 1 and pace requests — Gmail returns 429s under bursts.
const FETCH_DELAY_MS = 120
const MAX_RETRIES = 4

export async function syncGmailProvider(input: {
  providerId: string
  origin: string
  maxResults?: number
}) {
  const provider = getProvider(input.providerId)
  if (!provider || provider.type !== "gmail") {
    throw new Error("Provider is not a connected Google account")
  }

  const account = getGoogleAccount(input.providerId)
  if (!account) {
    throw new Error("Google token record was not found. Reconnect the account.")
  }

  if (hasRunningSyncRun(input.providerId)) {
    throw new Error("A sync is already running for this account")
  }

  const syncRunId = createSyncRun(input.providerId)
  updateProviderSyncStatus({ providerId: input.providerId, status: "syncing", errorMessage: null })

  try {
    const accessToken = await getValidGoogleAccessToken({ account, origin: input.origin })
    const listed = await listGmailMessages({
      accessToken,
      maxResults: input.maxResults ?? 50,
    })

    const messages: GmailMessageInput[] = []
    for (const message of listed) {
      messages.push(
        await getGmailMessageMetadata({
          accessToken,
          providerId: input.providerId,
          messageId: message.id,
        })
      )
      await delay(FETCH_DELAY_MS)
    }

    const stored = upsertGmailMessages(messages)

    // Resolve stored email row ids so detected items can link evidence.
    const emailIdMap = getEmailIdMap(
      input.providerId,
      messages.map((message) => message.gmailMessageId)
    )

    const subscriptionRecords: DetectedSubscriptionRecord[] = []
    const accountRecords: DetectedAccountRecord[] = []

    for (const message of messages) {
      const evidenceEmailId = emailIdMap.get(message.gmailMessageId) ?? null
      const seenAt = message.date ?? new Date().toISOString()

      const subscription = detectSubscription(message)
      if (subscription) {
        subscriptionRecords.push({
          providerId: input.providerId,
          company: subscription.company,
          senderEmail: subscription.senderEmail,
          senderDomain: subscription.senderDomain,
          category: subscription.category,
          confidence: subscription.confidence,
          source: subscription.reasons.join(" · "),
          emailUsed: message.to ?? null,
          evidenceEmailId,
          seenAt,
          amount: subscription.amount,
          billing_cycle: subscription.billingCycle,
        })
      }

      const detectedAccount = detectAccount(message)
      if (detectedAccount) {
        accountRecords.push({
          providerId: input.providerId,
          company: detectedAccount.company,
          domain: detectedAccount.domain,
          email: detectedAccount.email,
          confidence: detectedAccount.confidence,
          source: detectedAccount.reasons.join(" · "),
          evidenceEmailId,
          seenAt,
        })
      }
    }

    const subscriptionsDetected = upsertDetectedSubscriptions({ records: subscriptionRecords })
    const accountsDetected = upsertDetectedAccounts({ records: accountRecords })

    // Local embeddings + intent/cluster/extract (best-effort; never fail the sync).
    // Process the just-synced batch, then backfill any older rows still missing vectors.
    let intelligence = { embedded: 0, classified: 0, clusters: 0 }
    try {
      const batch = await runEmailIntelligence({
        providerId: input.providerId,
        origin: input.origin,
        emailIds: [...emailIdMap.values()],
      })
      const backlog = await runEmailIntelligence({
        providerId: input.providerId,
        origin: input.origin,
      })
      intelligence = {
        embedded: batch.embedded + backlog.embedded,
        classified: batch.classified + backlog.classified,
        clusters: backlog.clusters || batch.clusters,
      }
    } catch (err) {
      console.warn("[gmail] email intelligence pipeline failed:", err)
    }

    updateProviderSyncStatus({
      providerId: input.providerId,
      status: "active",
      lastSyncAt: new Date().toISOString(),
      errorMessage: null,
    })

    finishSyncRun({
      id: syncRunId,
      status: "success",
      emailsSeen: listed.length,
      emailsStored: stored,
      subscriptionsDetected,
      accountsDetected,
    })

    return {
      listed: listed.length,
      stored,
      subscriptionsDetected,
      accountsDetected,
      intelligence,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed"
    updateProviderSyncStatus({
      providerId: input.providerId,
      status: "error",
      errorMessage: message,
    })
    finishSyncRun({ id: syncRunId, status: "error", error: message })
    throw error
  }
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

interface GmailMessageResponse {
  id: string
  threadId?: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

async function listGmailMessages(input: {
  accessToken: string
  maxResults: number
}) {
  const url = new URL(GMAIL_MESSAGES_URL)
  url.searchParams.set("maxResults", String(input.maxResults))
  url.searchParams.set("q", "newer_than:365d")

  const res = await gmailFetch(url, input.accessToken)
  if (!res.ok) {
    throw new Error(describeGmailError("list", res.status, await res.text()))
  }

  const data = (await res.json()) as GmailListResponse
  return data.messages ?? []
}

async function getGmailMessageMetadata(input: {
  accessToken: string
  providerId: string
  messageId: string
}): Promise<GmailMessageInput> {
  const url = new URL(`${GMAIL_MESSAGES_URL}/${input.messageId}`)
  url.searchParams.set("format", "metadata")
  for (const header of METADATA_HEADERS) {
    url.searchParams.append("metadataHeaders", header)
  }

  const res = await gmailFetch(url, input.accessToken)
  if (!res.ok) {
    throw new Error(describeGmailError("message", res.status, await res.text()))
  }

  const message = (await res.json()) as GmailMessageResponse
  const headers = Object.fromEntries(
    (message.payload?.headers ?? []).map((header) => [header.name, header.value])
  )

  return {
    providerId: input.providerId,
    gmailMessageId: message.id,
    threadId: message.threadId,
    from: headers.From,
    to: headers.To,
    subject: headers.Subject,
    date: headers.Date ? safeDate(headers.Date) : dateFromInternalDate(message.internalDate),
    snippet: message.snippet,
    labels: message.labelIds ?? [],
    headers,
  }
}

// Fetch with backoff on 429 / 5xx so a transient rate limit doesn't fail a sync.
async function gmailFetch(url: URL, accessToken: string): Promise<Response> {
  let attempt = 0
  while (true) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status !== 429 && res.status < 500) return res
    if (attempt >= MAX_RETRIES) return res

    const backoff = Math.min(2000, 250 * 2 ** attempt)
    await delay(backoff)
    attempt += 1
  }
}

function describeGmailError(scope: string, status: number, body: string) {
  if (status === 401) return "Google access was rejected (401). Reconnect the account."
  if (status === 403) return "Gmail API access is forbidden (403). Check the granted scopes."
  if (status === 429) return "Gmail rate limit hit (429). Try syncing again in a moment."
  return `Gmail ${scope} request failed (${status}): ${body.slice(0, 300)}`
}

function safeDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function dateFromInternalDate(value?: string) {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return new Date(parsed).toISOString()
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
