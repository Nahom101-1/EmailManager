/**
 * Distinguish paid recurring services (Netflix) from email mailing-list
 * subscriptions using sentence-transformer prototypes (MiniLM) with a hash
 * embedding fallback — same stack as intent classification.
 */

import { cosineSimilarity, embedText, hashEmbed } from "@/lib/ai/embeddings"
import type { EmailIntent } from "@/lib/ai/intent"

export type SubscriptionKind = "paid" | "mailing_list"

export interface KindResult {
  kind: SubscriptionKind
  confidence: number
  reasons: string[]
  source: "rules" | "embedding" | "intent"
}

const PAID_PROTOTYPES = [
  "Your Netflix subscription receipt you were charged $15.49 for your monthly plan",
  "Payment successful invoice for Spotify Premium renews automatically billing",
  "Your membership renews tomorrow auto-renewal $9.99/mo charged to your card",
  "Free trial ending upgrade now to keep access recurring subscription payment",
  "Adobe Creative Cloud billing receipt annual plan payment confirmation",
]

const LIST_PROTOTYPES = [
  "Weekly newsletter digest this week in tech unsubscribe from this mailing list",
  "Thanks for subscribing to our email list confirm your newsletter subscription",
  "Daily digest top stories for you manage preferences unsubscribe link",
  "You're subscribed to marketing emails promotional updates List-Unsubscribe",
  "New post from Substack newsletter open in browser view in browser unsubscribe",
]

let paidVectors: Float32Array[] | null = null
let listVectors: Float32Array[] | null = null

function ensureHashPrototypes() {
  if (!paidVectors) paidVectors = PAID_PROTOTYPES.map((t) => hashEmbed(t))
  if (!listVectors) listVectors = LIST_PROTOTYPES.map((t) => hashEmbed(t))
}

function maxCosine(vector: Float32Array, prototypes: Float32Array[]): number {
  let best = -1
  for (const p of prototypes) {
    const s = cosineSimilarity(vector, p)
    if (s > best) best = s
  }
  return best
}

function haystackOf(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
}): string {
  return `${input.from ?? ""} ${input.subject ?? ""} ${input.snippet ?? ""}`.toLowerCase()
}

function hasListHeader(headers?: Record<string, string> | null): boolean {
  if (!headers) return false
  return Boolean(headers["List-Unsubscribe"] || headers["List-ID"] || headers["List-Id"])
}

const MONEY_RE =
  /\$\s*\d|\d+\.\d{2}\s*(?:\/\s*(?:mo|yr)|usd|eur)|charged|invoice|receipt|billing|payment|auto-?renew|renews?\b|membership|your plan|trial ends|was charged|total due/i
const LIST_RE =
  /newsletter|mailing list|weekly digest|daily digest|unsubscribe|view in browser|manage preferences|email list|you're subscribed to our|thanks for (subscribing|joining)/i

/** Fast rule layer used before / alongside embeddings. */
export function heuristicSubscriptionKind(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  headers?: Record<string, string> | null
  amount?: number | null
  category?: string | null
}): KindResult | null {
  const hay = haystackOf(input)
  const listHeader = hasListHeader(input.headers)
  const money = MONEY_RE.test(hay) || (input.amount != null && input.amount > 0)
  const listWords = LIST_RE.test(hay) || listHeader
  const newsletterCat = input.category === "newsletter"

  if (money && !listWords) {
    return {
      kind: "paid",
      confidence: 0.85,
      reasons: ["Payment / billing language"],
      source: "rules",
    }
  }
  if (money && listWords) {
    // Receipts often include unsubscribe — prefer paid when money is present.
    return {
      kind: "paid",
      confidence: 0.75,
      reasons: ["Payment signals override list/unsubscribe headers"],
      source: "rules",
    }
  }
  if (listWords || newsletterCat) {
    return {
      kind: "mailing_list",
      confidence: listHeader || newsletterCat ? 0.8 : 0.7,
      reasons: [
        listHeader ? "List-Unsubscribe / List-ID header" : "Newsletter / mailing-list language",
      ],
      source: "rules",
    }
  }
  return null
}

/** Embedding kNN against paid vs mailing-list prototypes. */
export function embeddingSubscriptionKind(vector: Float32Array): KindResult {
  ensureHashPrototypes()
  const paidScore = maxCosine(vector, paidVectors!)
  const listScore = maxCosine(vector, listVectors!)
  const kind: SubscriptionKind = paidScore >= listScore ? "paid" : "mailing_list"
  const best = Math.max(paidScore, listScore)
  const margin = Math.abs(paidScore - listScore)
  const confidence = Math.max(0.35, Math.min(0.92, (best + 1) / 2 + margin * 0.25))
  return {
    kind,
    confidence,
    reasons: [
      kind === "paid"
        ? `Closer to paid-plan prototypes (Δ=${margin.toFixed(2)})`
        : `Closer to mailing-list prototypes (Δ=${margin.toFixed(2)})`,
    ],
    source: "embedding",
  }
}

export function kindFromIntent(intent: EmailIntent): KindResult | null {
  if (intent === "receipt" || intent === "renewal" || intent === "trial") {
    return {
      kind: "paid",
      confidence: 0.88,
      reasons: [`AI intent: ${intent}`],
      source: "intent",
    }
  }
  if (intent === "newsletter" || intent === "promo") {
    return {
      kind: "mailing_list",
      confidence: intent === "newsletter" ? 0.85 : 0.7,
      reasons: [`AI intent: ${intent}`],
      source: "intent",
    }
  }
  return null
}

/**
 * Combine rules + intent + MiniLM/hash embedding.
 * Prefer strong money/list rules; otherwise use embedding / intent.
 */
export function classifySubscriptionKind(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  headers?: Record<string, string> | null
  amount?: number | null
  category?: string | null
  intent?: EmailIntent | null
  vector?: Float32Array | null
}): KindResult {
  const rules = heuristicSubscriptionKind(input)
  const fromIntent = input.intent ? kindFromIntent(input.intent) : null

  if (rules && rules.confidence >= 0.8 && !rules.reasons[0]?.includes("override")) {
    return rules
  }
  if (rules?.kind === "paid" && rules.confidence >= 0.75) {
    return rules
  }

  if (input.vector) {
    const emb = embeddingSubscriptionKind(input.vector)
    if (fromIntent && fromIntent.kind === emb.kind) {
      return {
        kind: emb.kind,
        confidence: Math.min(0.95, (emb.confidence + fromIntent.confidence) / 2 + 0.08),
        reasons: [...fromIntent.reasons, ...emb.reasons],
        source: "embedding",
      }
    }
    if (fromIntent && fromIntent.confidence > emb.confidence + 0.12) return fromIntent
    if (rules && rules.kind === emb.kind) {
      return {
        kind: emb.kind,
        confidence: Math.min(0.93, (rules.confidence + emb.confidence) / 2 + 0.05),
        reasons: [...rules.reasons, ...emb.reasons],
        source: "embedding",
      }
    }
    if (emb.confidence >= 0.55) return emb
  }

  if (fromIntent) return fromIntent
  if (rules) return rules

  // Sync path without vector: embed text with hash for a cheap prototype vote.
  ensureHashPrototypes()
  const text = `${input.subject ?? ""} ${input.snippet ?? ""} ${input.from ?? ""}`.trim()
  if (text) {
    return embeddingSubscriptionKind(hashEmbed(text))
  }

  return {
    kind: "mailing_list",
    confidence: 0.35,
    reasons: ["Low signal — defaulted away from paid Money"],
    source: "rules",
  }
}

/** Warm prototypes with real MiniLM vectors when the transformer is available. */
export async function warmSubscriptionKindPrototypes() {
  const paid = await Promise.all(PAID_PROTOTYPES.map((t) => embedText(t)))
  const list = await Promise.all(LIST_PROTOTYPES.map((t) => embedText(t)))
  paidVectors = paid.map((p) => p.vector)
  listVectors = list.map((p) => p.vector)
}
