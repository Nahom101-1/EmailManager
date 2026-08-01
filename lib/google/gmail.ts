import {
  createSyncRun,
  finishSyncRun,
  getEmailIdMap,
  getGoogleAccount,
  getProvider,
  hasRunningSyncRun,
  updateProviderHistoryCursor,
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

const PAGE_SIZE = 100
const DEFAULT_HISTORY_TARGET = 2000
/** Messages fetched per Sync click (continues from cursor). */
const MESSAGES_PER_SYNC = 400
const FETCH_CONCURRENCY = 2
const FETCH_DELAY_MS = 80
const MAX_RETRIES = 4

export async function syncGmailProvider(input: {
  providerId: string
  origin: string
  /** Override history target (default 2000). */
  historyTarget?: number
  /** Messages to pull this run (default 400). */
  messagesPerSync?: number
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

  const historyTarget = input.historyTarget ?? provider.history_target ?? DEFAULT_HISTORY_TARGET
  const messagesPerSync = input.messagesPerSync ?? MESSAGES_PER_SYNC
  const syncRunId = createSyncRun(input.providerId)
  updateProviderSyncStatus({ providerId: input.providerId, status: "syncing", errorMessage: null })

  try {
    const accessToken = await getValidGoogleAccessToken({ account, origin: input.origin })

    // Resume history crawl when incomplete; otherwise pull newest pages (incremental).
    const resumeToken =
      !provider.history_complete && provider.history_page_token
        ? provider.history_page_token
        : undefined

    const listed = await listGmailMessagesPaged({
      accessToken,
      pageSize: PAGE_SIZE,
      maxMessages: messagesPerSync,
      pageToken: resumeToken,
    })

    const messages = await fetchMetadataBatch({
      accessToken,
      providerId: input.providerId,
      messageIds: listed.messages.map((m) => m.id),
    })

    const stored = upsertGmailMessages(messages)

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

    // Update history cursor. When history is complete, keep complete=true and
    // clear page token so later syncs pull fresh first pages (incremental).
    let historySyncedCount = provider.history_synced_count
    let historyComplete = provider.history_complete
    let nextToken: string | null = listed.nextPageToken

    if (!historyComplete) {
      historySyncedCount = Math.min(historyTarget, historySyncedCount + listed.messages.length)
      const hitTarget = historySyncedCount >= historyTarget
      const exhausted = !listed.nextPageToken
      historyComplete = hitTarget || exhausted
      if (historyComplete) nextToken = null
    } else {
      // Incremental mode: pull newest pages; keep crawl counters stable.
      nextToken = null
    }

    updateProviderHistoryCursor({
      providerId: input.providerId,
      historyPageToken: nextToken,
      historySyncedCount,
      historyComplete,
      historyTarget,
    })

    let intelligence = { embedded: 0, classified: 0, clusters: 0 }
    try {
      intelligence = await runEmailIntelligence({
        providerId: input.providerId,
        origin: input.origin,
      })
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
      emailsSeen: listed.messages.length,
      emailsStored: stored,
      subscriptionsDetected,
      accountsDetected,
    })

    return {
      listed: listed.messages.length,
      stored,
      subscriptionsDetected,
      accountsDetected,
      intelligence,
      history: {
        synced: historySyncedCount,
        target: historyTarget,
        complete: historyComplete,
        pageTokenPresent: Boolean(nextToken),
      },
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

async function listGmailMessagesPaged(input: {
  accessToken: string
  pageSize: number
  maxMessages: number
  pageToken?: string
}): Promise<{
  messages: Array<{ id: string; threadId: string }>
  nextPageToken: string | null
}> {
  const collected: Array<{ id: string; threadId: string }> = []
  let pageToken: string | undefined = input.pageToken
  let nextPageToken: string | null = null

  while (collected.length < input.maxMessages) {
    const remaining = input.maxMessages - collected.length
    const pageSize = Math.min(input.pageSize, remaining)

    const url = new URL(GMAIL_MESSAGES_URL)
    url.searchParams.set("maxResults", String(pageSize))
    url.searchParams.set("q", "newer_than:365d")
    if (pageToken) url.searchParams.set("pageToken", pageToken)

    const res = await gmailFetch(url, input.accessToken)
    if (!res.ok) {
      throw new Error(describeGmailError("list", res.status, await res.text()))
    }

    const data = (await res.json()) as GmailListResponse
    const batch = data.messages ?? []
    collected.push(...batch)
    nextPageToken = data.nextPageToken ?? null

    if (!data.nextPageToken || batch.length === 0) break
    pageToken = data.nextPageToken
  }

  return { messages: collected, nextPageToken }
}

async function fetchMetadataBatch(input: {
  accessToken: string
  providerId: string
  messageIds: string[]
}): Promise<GmailMessageInput[]> {
  const results: GmailMessageInput[] = new Array(input.messageIds.length)
  let cursor = 0

  async function worker() {
    while (cursor < input.messageIds.length) {
      const idx = cursor
      cursor += 1
      const messageId = input.messageIds[idx]
      results[idx] = await getGmailMessageMetadata({
        accessToken: input.accessToken,
        providerId: input.providerId,
        messageId,
      })
      await delay(FETCH_DELAY_MS)
    }
  }

  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, input.messageIds.length) }, () =>
    worker()
  )
  await Promise.all(workers)
  return results.filter(Boolean)
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
