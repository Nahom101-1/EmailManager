import {
  createSyncRun,
  finishSyncRun,
  getEmailIdMap,
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
import { decryptPassword } from "@/lib/crypto/credentials"
import { fetchEmails } from "@/lib/imap/client"
import type { ImapConfig } from "@/types/provider"

export async function syncImapProvider(input: { providerId: string }) {
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

  if (hasRunningSyncRun(input.providerId)) {
    throw new Error("A sync is already running for this account")
  }

  const password = decryptPassword(provider.encrypted_password)

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
    const rawEmails = await fetchEmails(config, input.providerId)

    const messages: GmailMessageInput[] = rawEmails.map((raw) => ({
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

    const stored = upsertGmailMessages(messages)

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

    updateProviderSyncStatus({
      providerId: input.providerId,
      status: "active",
      lastSyncAt: new Date().toISOString(),
      errorMessage: null,
    })

    finishSyncRun({
      id: syncRunId,
      status: "success",
      emailsSeen: rawEmails.length,
      emailsStored: stored,
      subscriptionsDetected,
      accountsDetected,
    })

    return {
      listed: rawEmails.length,
      stored,
      subscriptionsDetected,
      accountsDetected,
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
