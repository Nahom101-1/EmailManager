/**
 * Active learning from confirm/ignore labels.
 * Biases subscription/account detection and intent prototypes.
 */

import { getSetting, setSetting } from "@/lib/db/local"
import { hashEmbed } from "@/lib/ai/embeddings"
import type { EmailIntent } from "@/lib/ai/intent"

const LEARNING_KEY = "detection_labels_v1"

export type LabelKind = "confirm" | "ignore"

export interface LearningLabel {
  kind: LabelKind
  entity: "subscription" | "account"
  company: string
  domain: string | null
  at: string
}

export interface LearningStore {
  labels: LearningLabel[]
  /** domain → net score (+confirm, -ignore) */
  domainBias: Record<string, number>
  /** company lower → net score */
  companyBias: Record<string, number>
}

function emptyStore(): LearningStore {
  return { labels: [], domainBias: {}, companyBias: {} }
}

export function getLearningStore(): LearningStore {
  const raw = getSetting(LEARNING_KEY)
  if (!raw) return emptyStore()
  try {
    const parsed = JSON.parse(raw) as LearningStore
    return {
      labels: parsed.labels ?? [],
      domainBias: parsed.domainBias ?? {},
      companyBias: parsed.companyBias ?? {},
    }
  } catch {
    return emptyStore()
  }
}

function persist(store: LearningStore) {
  // Cap history; keep bias maps intact.
  if (store.labels.length > 500) {
    store.labels = store.labels.slice(-500)
  }
  setSetting(LEARNING_KEY, JSON.stringify(store))
}

function bump(map: Record<string, number>, key: string, delta: number) {
  map[key] = (map[key] ?? 0) + delta
}

/** Record a user confirm/ignore for a detected entity. */
export function recordLearningLabel(input: {
  kind: LabelKind
  entity: "subscription" | "account"
  company: string
  domain?: string | null
}) {
  const store = getLearningStore()
  const company = input.company.trim()
  const domain = input.domain?.trim().toLowerCase() || null
  const delta = input.kind === "confirm" ? 1 : -1

  store.labels.push({
    kind: input.kind,
    entity: input.entity,
    company,
    domain,
    at: new Date().toISOString(),
  })

  bump(store.companyBias, company.toLowerCase(), delta)
  if (domain) bump(store.domainBias, domain, delta)

  persist(store)
  // Invalidate prototype cache so next classify picks up new examples.
  learnedPrototypeCache = null
}

/** Confidence adjustment in [-0.25, +0.25] from user labels. */
export function learningConfidenceBias(input: {
  company?: string | null
  domain?: string | null
}): number {
  const store = getLearningStore()
  let score = 0
  if (input.domain) {
    score += store.domainBias[input.domain.toLowerCase()] ?? 0
  }
  if (input.company) {
    score += store.companyBias[input.company.toLowerCase()] ?? 0
  }
  if (score === 0) return 0
  // Soft saturation: 1 label ≈ ±0.12, many labels cap at ±0.25
  const sign = score > 0 ? 1 : -1
  return sign * Math.min(0.25, 0.12 * Math.sqrt(Math.abs(score)))
}

let learnedPrototypeCache: Array<{ intent: EmailIntent; vector: Float32Array }> | null = null

/**
 * Extra intent prototypes derived from confirmed subscriptions
 * (bias toward renewal/receipt) and ignored ones (newsletter/promo).
 */
export function getLearnedIntentPrototypes(): Array<{ intent: EmailIntent; vector: Float32Array }> {
  if (learnedPrototypeCache) return learnedPrototypeCache

  const store = getLearningStore()
  const out: Array<{ intent: EmailIntent; vector: Float32Array }> = []
  const seen = new Set<string>()

  // Most recent labels first for diversity.
  for (const label of [...store.labels].reverse()) {
    const key = `${label.kind}:${label.company}`
    if (seen.has(key)) continue
    seen.add(key)
    if (seen.size > 24) break

    const name = label.company
    if (label.kind === "confirm" && label.entity === "subscription") {
      out.push({
        intent: "renewal",
        vector: hashEmbed(`${name} subscription renews billing receipt payment`),
      })
      out.push({
        intent: "receipt",
        vector: hashEmbed(`${name} payment receipt invoice charged`),
      })
    } else if (label.kind === "ignore") {
      out.push({
        intent: "newsletter",
        vector: hashEmbed(`${name} newsletter digest unsubscribe marketing`),
      })
      out.push({
        intent: "promo",
        vector: hashEmbed(`${name} promo sale discount offer`),
      })
    }
  }

  learnedPrototypeCache = out
  return out
}
