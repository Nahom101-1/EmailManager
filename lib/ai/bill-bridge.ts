/**
 * Promote high-signal intelligence extracts into subscription rows.
 * Paid intents → Money; newsletter/promo → email mailing lists.
 */

import { extractSenderEmail, extractDomain } from "@/lib/detection"
import {
  getLocalUserId,
  upsertDetectedSubscriptions,
  type DetectedSubscriptionRecord,
  type SubscriptionKind,
} from "@/lib/db/local"
import type { EmailIntent } from "@/lib/ai/intent"
import type { ExtractedFields } from "@/lib/ai/extract"
import { classifySubscriptionKind } from "@/lib/ai/subscription-kind"

const MONEY_INTENTS: EmailIntent[] = ["receipt", "renewal", "trial"]
const LIST_INTENTS: EmailIntent[] = ["newsletter", "promo"]

export function shouldBridgeToSubscription(
  intent: EmailIntent,
  extract: ExtractedFields | null
): boolean {
  if (LIST_INTENTS.includes(intent) && extract?.vendor) return true
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
  subject?: string | null
  snippet?: string | null
  headers?: Record<string, string> | null
  intent: EmailIntent
  extract: ExtractedFields
  vector?: Float32Array | null
}): number {
  if (!shouldBridgeToSubscription(input.intent, input.extract)) return 0

  const senderEmail = extractSenderEmail(input.fromAddress ?? undefined)
  const senderDomain = extractDomain(senderEmail)

  const kindResult = classifySubscriptionKind({
    from: input.fromAddress,
    subject: input.subject,
    snippet: input.snippet,
    headers: input.headers,
    amount: input.extract.amount,
    category: LIST_INTENTS.includes(input.intent) ? "newsletter" : "other",
    intent: input.intent,
    vector: input.vector,
  })

  const kind: SubscriptionKind = kindResult.kind
  const isPaid = kind === "paid"

  const source =
    input.intent === "trial"
      ? "ai-trial"
      : input.intent === "renewal"
        ? "ai-renewal"
        : input.intent === "newsletter" || input.intent === "promo"
          ? "ai-mailing-list"
          : input.extract.source === "llm"
            ? "ai-extract"
            : "ai-rules"

  const confidence = Math.min(
    0.95,
    Math.max(
      0.55,
      Math.max(input.extract.confidence, kindResult.confidence) +
        (input.extract.source === "llm" ? 0.08 : 0)
    )
  )

  const record: DetectedSubscriptionRecord = {
    providerId: input.providerId,
    company: input.extract.vendor!,
    senderEmail,
    senderDomain,
    category: isPaid ? "other" : "newsletter",
    kind,
    confidence,
    source: `${source} · ${kindResult.reasons.join(" · ")}`,
    emailUsed: input.toAddress ?? null,
    evidenceEmailId: input.emailId,
    seenAt: input.seenAt ?? new Date().toISOString(),
    amount: isPaid ? input.extract.amount : null,
    billing_cycle: isPaid ? input.extract.billingCycle : null,
    due_date: isPaid ? input.extract.dueDate : null,
    currency: isPaid ? input.extract.currency : null,
  }

  return upsertDetectedSubscriptions({
    userId: getLocalUserId(),
    records: [record],
  })
}
