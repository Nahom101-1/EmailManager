/**
 * Email intent classification via heuristics + embedding prototype kNN.
 * Heuristics (L0) win when confident; prototypes refine the rest.
 */

import { cosineSimilarity, embedText, hashEmbed } from "@/lib/ai/embeddings"
import { getLearnedIntentPrototypes } from "@/lib/ai/learning"

export type EmailIntent =
  | "needs_reply"
  | "action_required"
  | "receipt"
  | "renewal"
  | "trial"
  | "security"
  | "newsletter"
  | "promo"
  | "fyi"

export const EMAIL_INTENTS: EmailIntent[] = [
  "needs_reply",
  "action_required",
  "receipt",
  "renewal",
  "trial",
  "security",
  "newsletter",
  "promo",
  "fyi",
]

export interface IntentResult {
  intent: EmailIntent
  confidence: number
  reasons: string[]
  uncertain: boolean
}

const PROTOTYPES: Array<{ intent: EmailIntent; text: string }> = [
  { intent: "receipt", text: "Your receipt for payment of $12.99 subscription invoice charged successfully" },
  { intent: "renewal", text: "Your subscription renews tomorrow auto-renewal billing notice" },
  { intent: "trial", text: "Your free trial ends in 3 days upgrade now to keep access" },
  { intent: "security", text: "Security alert new sign-in to your account password reset verification code" },
  { intent: "newsletter", text: "Weekly digest newsletter this week in tech unsubscribe from mailing list" },
  { intent: "promo", text: "Limited time offer 50% off sale discount promo code expires soon" },
  { intent: "action_required", text: "Action required please confirm your payment method update billing" },
  { intent: "needs_reply", text: "Can you get back to me about the meeting proposal looking forward to your reply" },
  { intent: "fyi", text: "FYI shipment delivered notification for your records no action needed" },
]

let prototypeVectors: Array<{ intent: EmailIntent; vector: Float32Array }> | null = null

function getPrototypeVectors() {
  if (!prototypeVectors) {
    // Sync hash embeddings for prototypes — fast and always available.
    prototypeVectors = PROTOTYPES.map((p) => ({
      intent: p.intent,
      vector: hashEmbed(p.text),
    }))
  }
  return prototypeVectors
}

function haystackOf(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  labels?: string[]
}): string {
  return `${input.from ?? ""} ${input.subject ?? ""} ${input.snippet ?? ""} ${(input.labels ?? []).join(" ")}`.toLowerCase()
}

/** Rule-based intent signals (L0). */
export function heuristicIntent(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  labels?: string[]
  headers?: Record<string, string>
}): IntentResult | null {
  const hay = haystackOf(input)
  const reasons: string[] = []
  const labels = (input.labels ?? []).map((l) => l.toLowerCase())

  const score = (intent: EmailIntent, weight: number, reason: string) => {
    reasons.push(reason)
    return { intent, weight }
  }

  const hits: Array<{ intent: EmailIntent; weight: number }> = []

  if (/security alert|password reset|verify your|verification code|two-factor|new sign-?in|suspicious/.test(hay)) {
    hits.push(score("security", 0.85, "Security language"))
  }
  if (/receipt|invoice|payment received|order confirmation|charged \$|you paid/.test(hay)) {
    hits.push(score("receipt", 0.8, "Receipt/invoice language"))
  }
  if (/renews?|renewal|auto-?renew/.test(hay)) {
    hits.push(score("renewal", 0.8, "Renewal language"))
  }
  if (/\bfree trial\b|\btrial (ends|ending|expir)/.test(hay)) {
    hits.push(score("trial", 0.8, "Trial language"))
  }
  if (/unsubscribe|newsletter|weekly digest|daily digest|mailing list/.test(hay) || input.headers?.["List-Unsubscribe"]) {
    hits.push(score("newsletter", 0.7, "Newsletter signals"))
  }
  if (/% off|limited time|promo code|sale ends|discount|deal of/.test(hay) || labels.includes("category_promotions")) {
    hits.push(score("promo", 0.75, "Promo language"))
  }
  if (/action required|please (confirm|update|verify)|payment (failed|declined)|update your (card|payment)/.test(hay)) {
    hits.push(score("action_required", 0.8, "Action-required language"))
  }
  if (/please reply|looking forward to (hearing|your)|can you|would you|rsvp|\?/.test(hay) && !input.headers?.["List-Unsubscribe"]) {
    hits.push(score("needs_reply", 0.55, "Looks like it wants a reply"))
  }

  if (hits.length === 0) return null

  hits.sort((a, b) => b.weight - a.weight)
  const best = hits[0]
  return {
    intent: best.intent,
    confidence: Math.min(0.95, best.weight),
    reasons,
    uncertain: best.weight < 0.65,
  }
}

/** kNN against intent prototypes using an email embedding. */
export function prototypeIntent(vector: Float32Array): IntentResult {
  const prototypes = [...getPrototypeVectors(), ...getLearnedIntentPrototypes()]
  let bestIntent: EmailIntent = "fyi"
  let bestScore = -1
  for (const p of prototypes) {
    const score = cosineSimilarity(vector, p.vector)
    if (score > bestScore) {
      bestScore = score
      bestIntent = p.intent
    }
  }
  // Hash-space cosine is typically lower; map into a usable confidence band.
  const confidence = Math.max(0.2, Math.min(0.9, (bestScore + 1) / 2))
  return {
    intent: bestIntent,
    confidence,
    reasons: [`Similar to ${bestIntent} prototype`],
    uncertain: confidence < 0.55,
  }
}

export function classifyIntent(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  labels?: string[]
  headers?: Record<string, string>
  vector?: Float32Array | null
}): IntentResult {
  const heuristic = heuristicIntent(input)
  if (heuristic && !heuristic.uncertain) return heuristic

  if (input.vector) {
    const proto = prototypeIntent(input.vector)
    if (heuristic) {
      // Blend: prefer heuristic intent if close, else prototype.
      if (heuristic.intent === proto.intent) {
        return {
          intent: heuristic.intent,
          confidence: Math.min(0.95, (heuristic.confidence + proto.confidence) / 2 + 0.1),
          reasons: [...heuristic.reasons, ...proto.reasons],
          uncertain: false,
        }
      }
      if (proto.confidence > heuristic.confidence + 0.1) return proto
      return heuristic
    }
    return proto
  }

  return (
    heuristic ?? {
      intent: "fyi",
      confidence: 0.3,
      reasons: ["No strong signals"],
      uncertain: true,
    }
  )
}

/** Warm prototype cache asynchronously with real transformer vectors when available. */
export async function warmIntentPrototypes() {
  const next: Array<{ intent: EmailIntent; vector: Float32Array }> = []
  for (const p of PROTOTYPES) {
    const { vector } = await embedText(p.text)
    next.push({ intent: p.intent, vector })
  }
  prototypeVectors = next
}
