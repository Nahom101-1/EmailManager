/**
 * Structured field extraction for high-signal / uncertain emails.
 * Rule-based first; optional Claude pass when cloud AI is enabled.
 */

import { parseAmount, extractSenderEmail, extractDomain } from "@/lib/detection"
import type { EmailIntent } from "@/lib/ai/intent"
import { callClaude, AiUnavailableError } from "@/lib/ai/client"

export interface ExtractedFields {
  vendor: string | null
  amount: number | null
  currency: string | null
  billingCycle: "monthly" | "yearly" | null
  dueDate: string | null
  intent: EmailIntent | null
  confidence: number
  source: "rules" | "llm"
}

const HIGH_SIGNAL: EmailIntent[] = ["receipt", "renewal", "trial", "security", "action_required"]

export function isHighSignal(intent: EmailIntent, uncertain: boolean): boolean {
  return HIGH_SIGNAL.includes(intent) || uncertain
}

function vendorFromFrom(from?: string | null): string | null {
  if (!from) return null
  const display = from.split("<")[0].replace(/["']/g, "").trim()
  if (display && !display.includes("@")) return display
  const email = extractSenderEmail(from ?? undefined)
  const domain = extractDomain(email)
  if (!domain) return null
  const core = domain.split(".").filter(Boolean)
  const name = core.length >= 2 ? core[core.length - 2] : core[0]
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : null
}

const DATE_PATTERNS: RegExp[] = [
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?\b/i,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\bin\s+(\d+)\s+days?\b/i,
]

function extractDueDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const m = text.match(pattern)
    if (!m) continue
    if (m[1] && /^\d+$/.test(m[1])) {
      const days = parseInt(m[1], 10)
      if (days > 0 && days < 366) {
        const d = new Date()
        d.setDate(d.getDate() + days)
        return d.toISOString().slice(0, 10)
      }
    }
    const parsed = new Date(m[0])
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return null
}

export function extractWithRules(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  bodyText?: string | null
  intent?: EmailIntent | null
}): ExtractedFields {
  const text = `${input.subject ?? ""} ${input.snippet ?? ""} ${input.bodyText ?? ""}`
  const { amount, billingCycle } = parseAmount(text)
  const currency = /€/.test(text) ? "EUR" : /£/.test(text) ? "GBP" : amount != null ? "USD" : null
  const vendor = vendorFromFrom(input.from)
  const dueDate = extractDueDate(text)

  let confidence = 0.35
  if (amount != null) confidence += 0.25
  if (vendor) confidence += 0.15
  if (dueDate) confidence += 0.15
  if (billingCycle) confidence += 0.1

  return {
    vendor,
    amount,
    currency,
    billingCycle,
    dueDate,
    intent: input.intent ?? null,
    confidence: Math.min(0.95, confidence),
    source: "rules",
  }
}

export async function extractWithLlm(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  bodyText?: string | null
  intent?: EmailIntent | null
  /** When false, never send snippet/body to the cloud — subject/from only. */
  allowContent?: boolean
}): Promise<ExtractedFields | null> {
  const allowContent = input.allowContent !== false
  const prompt =
    `Extract structured fields from this email as JSON only (no markdown):\n` +
    `{"vendor":string|null,"amount":number|null,"currency":"USD"|"EUR"|"GBP"|null,` +
    `"billingCycle":"monthly"|"yearly"|null,"dueDate":"YYYY-MM-DD"|null,"confidence":0-1}\n\n` +
    `From: ${input.from ?? ""}\nSubject: ${input.subject ?? ""}\n` +
    (allowContent && input.snippet ? `Snippet: ${input.snippet}\n` : "") +
    (allowContent && input.bodyText ? `Body: ${input.bodyText.slice(0, 1500)}\n` : "")

  try {
    const text = await callClaude(
      "You extract structured billing/action fields from emails. Reply with JSON only.",
      [{ role: "user", content: prompt }]
    )
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedFields>
    return {
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      billingCycle:
        parsed.billingCycle === "monthly" || parsed.billingCycle === "yearly"
          ? parsed.billingCycle
          : null,
      dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : null,
      intent: input.intent ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      source: "llm",
    }
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) {
      console.warn("[extract] LLM extract failed:", err)
    }
    return null
  }
}

export async function extractFields(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  bodyText?: string | null
  intent: EmailIntent
  uncertain: boolean
  allowLlm: boolean
  /** Content scope — required to send snippet/body to cloud LLM. */
  allowContent?: boolean
}): Promise<ExtractedFields> {
  const rules = extractWithRules(input)
  const needsLlm =
    input.allowLlm &&
    isHighSignal(input.intent, input.uncertain) &&
    (rules.confidence < 0.6 || input.uncertain)

  if (!needsLlm) return { ...rules, intent: input.intent }

  const llm = await extractWithLlm({
    ...input,
    allowContent: Boolean(input.allowContent),
    // Never send bodies/snippets unless content scope is on.
    snippet: input.allowContent ? input.snippet : null,
    bodyText: input.allowContent ? input.bodyText : null,
  })
  if (!llm) return { ...rules, intent: input.intent }

  return {
    vendor: llm.vendor ?? rules.vendor,
    amount: llm.amount ?? rules.amount,
    currency: llm.currency ?? rules.currency,
    billingCycle: llm.billingCycle ?? rules.billingCycle,
    dueDate: llm.dueDate ?? rules.dueDate,
    intent: input.intent,
    confidence: Math.max(rules.confidence, llm.confidence),
    source: "llm",
  }
}
