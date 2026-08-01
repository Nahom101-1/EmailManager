import {
  countProviderEmails,
  createSyncRun,
  finishSyncRun,
  getEmailIdMap,
  getProvider,
  hasRunningSyncRun,
  reclaimStaleSyncRuns,
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
import { decryptPassword } from "@/lib/crypto/credentials"
import { fetchEmails, IMAP_HISTORY_TARGET, IMAP_MESSAGES_PER_SYNC } from "@/lib/imap/client"
import type { ImapConfig } from "@/types/provider"
import { runEmailIntelligence } from "@/lib/ai/pipeline"

export async function syncImapProvider(input: {
  providerId: string
  historyTarget?: number
  messagesPerSync?: number
}) {
  const provider = getProvider(input.providerId)
  if (!provider || provider.type !== "imap") {
    throw new Error("Provider is not a connected IMAP account")
  }

  if (!provider.host || !provider.port) {
    throw new Error("IMAP provider is missing host or port")
  }

  if (!provider.encrypted_password) {
    throw new Error("IMAP provider has no stored password. Reconnect the account.")
  }

  reclaimStaleSyncRuns()
  if (hasRunningSyncRun(input.providerId)) {
    throw new Error("A sync is already running for this account")
  }

  const password = decryptPassword(provider.encrypted_password)
  const historyTarget = input.historyTarget ?? provider.history_target ?? IMAP_HISTORY_TARGET
  const messagesPerSync = input.messagesPerSync ?? IMAP_MESSAGES_PER_SYNC
  const resumeOffset = provider.history_complete
    ? 0
    : Math.max(0, Number.parseInt(provider.history_page_token ?? "0", 10) || 0)

  const config: ImapConfig = {
    host: provider.host,
    port: provider.port,
    tls: provider.tls ?? true,
    email: provider.email,
    username: provider.username ?? undefined,
    password,
  }

  const syncRunId = createSyncRun(input.providerId)
  updateProviderSyncStatus({ providerId: input.providerId, status: "syncing", errorMessage: null })

  try {
    // After history complete: only pull a small newest page for incremental updates.
    const fetchOffset = provider.history_complete ? 0 : resumeOffset
    const fetchMax = provider.history_complete ? Math.min(100, messagesPerSync) : messagesPerSync

    const fetched = await fetchEmails(config, input.providerId, {
      offset: fetchOffset,
      maxMessages: fetchMax,
      historyTarget,
    })

    const messages: GmailMessageInput[] = fetched.emails.map((raw) => ({
      providerId: raw.providerId,
      gmailMessageId: raw.messageId,
      threadId: undefined,
      from: raw.from,
      to: raw.to,
      subject: raw.subject,
      date: raw.date instanceof Date ? raw.date.toISOString() : raw.date,
      snippet: undefined,
      labels: [raw.folder],
      headers: {},
    }))

    const upsert = upsertGmailMessages(messages)
    const stored = upsert.inserted

    const emailIdMap = getEmailIdMap(
      input.providerId,
      messages.map((m) => m.gmailMessageId)
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
          kind: subscription.kind,
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

    const uniqueStored = countProviderEmails(input.providerId)
    let historyComplete = provider.history_complete
    let persistToken: string | null = null

    if (!provider.history_complete) {
      const hitTarget = uniqueStored >= historyTarget
      historyComplete = hitTarget || fetched.complete
      persistToken = historyComplete ? null : String(fetched.nextOffset)
    }

    const newestInternalDate = messages.reduce<string | null>((best, m) => {
      if (!m.date) return best
      if (!best || m.date > best) return m.date
      return best
    }, provider.newest_internal_date)

    updateProviderHistoryCursor({
      providerId: input.providerId,
      historyPageToken: persistToken,
      historySyncedCount: uniqueStored,
      historyComplete,
      historyTarget,
      newestInternalDate,
    })

    // Best-effort incremental intelligence (snippet-only for IMAP — no body fetch).
    let intelligence = { embedded: 0, classified: 0, clusters: 0, backlogRemaining: 0 }
    try {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"
      intelligence = await runEmailIntelligence({ providerId: input.providerId, origin })
    } catch (err) {
      console.warn("[imap-sync] intelligence pipeline skipped:", err)
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
      emailsSeen: fetched.emails.length,
      emailsStored: stored,
      subscriptionsDetected,
      accountsDetected,
    })

    return {
      listed: fetched.emails.length,
      stored,
      subscriptionsDetected,
      accountsDetected,
      intelligence,
      history: {
        synced: uniqueStored,
        target: historyTarget,
        complete: historyComplete,
        pageTokenPresent: Boolean(persistToken),
        mode: provider.history_complete ? "recent" : "crawl",
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP sync failed"
    updateProviderSyncStatus({
      providerId: input.providerId,
      status: "error",
      errorMessage: message,
    })
    finishSyncRun({ id: syncRunId, status: "error", error: message })
    throw error
  }
}
