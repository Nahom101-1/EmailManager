/**
 * Lightweight near-duplicate / newsletter noise helpers.
 * Used to skip redundant embeds for repeated campaigns from the same sender.
 */

import { createHash } from "node:crypto"
import { extractDomain, extractSenderEmail } from "@/lib/detection"

export function normalizeSubject(subject: string | null | undefined): string {
  return (subject ?? "")
    .toLowerCase()
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, "")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b\.?/gi, "")
    .replace(/\b20\d{2}\b/g, "")
    .replace(/[^a-z0-9@._+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Stable fingerprint for near-dup detection (sender domain + normalized subject). */
export function contentFingerprint(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
}): string {
  const email = extractSenderEmail(input.from ?? undefined)
  const domain = extractDomain(email) ?? "unknown"
  const subject = normalizeSubject(input.subject)
  const snippetHead = (input.snippet ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80)
  const raw = `${domain}|${subject}|${snippetHead}`
  return createHash("sha1").update(raw).digest("hex").slice(0, 16)
}

/** True when mail is a good candidate to collapse as newsletter/promo noise. */
export function isNoiseCandidate(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  labels?: string[]
  headers?: Record<string, string>
}): boolean {
  const labels = (input.labels ?? []).map((l) => l.toLowerCase())
  if (input.headers?.["List-Unsubscribe"] || input.headers?.["List-ID"] || input.headers?.["List-Id"]) {
    return true
  }
  if (labels.some((l) => l.includes("category_promotions") || l.includes("category_updates"))) {
    return true
  }
  const hay = `${input.subject ?? ""} ${input.snippet ?? ""}`.toLowerCase()
  return /unsubscribe|newsletter|weekly digest|daily digest|mailing list|% off|promo code|sale ends/.test(
    hay
  )
}
