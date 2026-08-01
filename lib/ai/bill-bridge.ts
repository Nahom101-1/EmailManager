/**
 * Promote high-signal intelligence extracts into subscription rows.
 */

import { extractSenderEmail, extractDomain } from "@/lib/detection"
import {
  getLocalUserId,
  upsertDetectedSubscriptions,
  type DetectedSubscriptionRecord,
} from "@/lib/db/local"
import type { EmailIntent } from "@/lib/ai/intent"
import type { ExtractedFields } from "@/lib/ai/extract"

const MONEY_INTENTS: EmailIntent[] = ["receipt", "renewal", "trial"]

export function shouldBridgeToSubscription(
  intent: EmailIntent,
  extract: ExtractedFields | null
): boolean {
  if (!extract) return false
  if (!MONEY_INTENTS.includes(intent)) return false
  if (!extract.vendor) return false
  return extract.amount != null || extract.billingCycle != null || extract.dueDate != null
}

export function bridgeExtractToSubscription(input: {
  providerId: string
  emailId: string
  fromAddress?: string | null
  toAddress?: string | null
  seenAt?: string | null
  intent: EmailIntent
  extract: ExtractedFields
}): number {
  if (!shouldBridgeToSubscription(input.intent, input.extract)) return 0

  const senderEmail = extractSenderEmail(input.fromAddress ?? undefined)
  const senderDomain = extractDomain(senderEmail)
  const source =
    input.intent === "trial"
      ? "ai-trial"
      : input.intent === "renewal"
        ? "ai-renewal"
        : input.extract.source === "llm"
          ? "ai-extract"
          : "ai-rules"

  const confidence = Math.min(
    0.95,
    Math.max(0.55, input.extract.confidence + (input.extract.source === "llm" ? 0.1 : 0))
  )

  const record: DetectedSubscriptionRecord = {
    providerId: input.providerId,
    company: input.extract.vendor!,
    senderEmail,
    senderDomain,
    category: "other",
    confidence,
    source,
    emailUsed: input.toAddress ?? null,
    evidenceEmailId: input.emailId,
    seenAt: input.seenAt ?? new Date().toISOString(),
    amount: input.extract.amount,
    billing_cycle: input.extract.billingCycle,
    due_date: input.extract.dueDate,
    currency: input.extract.currency,
  }

  return upsertDetectedSubscriptions({
    userId: getLocalUserId(),
    records: [record],
  })
}
