import { contentFingerprint } from "@/lib/ai/near-dup"
import type { LocalEmail } from "@/lib/db/local"
import type { StoredIntelligence } from "@/lib/db/intelligence"

export type ThreadMessage = LocalEmail & {
  collapsedDupCount?: number
  isFocus?: boolean
}

/** Collapse consecutive near-duplicates (forwarded/campaign dups) in a thread. */
export function collapseThreadDups(messages: LocalEmail[], focusId: string): ThreadMessage[] {
  const out: ThreadMessage[] = []
  for (const msg of messages) {
    const fp = contentFingerprint({
      from: msg.from_address,
      subject: msg.subject,
      snippet: msg.snippet,
    })
    const prev = out[out.length - 1]
    const prevFp = prev
      ? contentFingerprint({
          from: prev.from_address,
          subject: prev.subject,
          snippet: prev.snippet,
        })
      : null
    if (prev && prevFp === fp && msg.id !== focusId && prev.id !== focusId) {
      prev.collapsedDupCount = (prev.collapsedDupCount ?? 1) + 1
      continue
    }
    out.push({ ...msg, isFocus: msg.id === focusId, collapsedDupCount: 1 })
  }
  return out
}

export function participantsOf(messages: LocalEmail[]): string[] {
  const set = new Set<string>()
  for (const m of messages) {
    if (m.from_address) set.add(m.from_address)
    if (m.to_address) {
      for (const part of m.to_address.split(/[,;]/)) {
        const t = part.trim()
        if (t) set.add(t)
      }
    }
  }
  return Array.from(set)
}

export function authSignals(headers: Record<string, string>): {
  label: string
  level: "ok" | "warn" | "unknown"
}[] {
  const out: { label: string; level: "ok" | "warn" | "unknown" }[] = []
  const auth = headers["Authentication-Results"] ?? headers["authentication-results"]
  if (auth) {
    const lower = auth.toLowerCase()
    const spf = /spf=(pass|fail|softfail|neutral|none)/.exec(lower)
    const dkim = /dkim=(pass|fail|neutral|none)/.exec(lower)
    const dmarc = /dmarc=(pass|fail|bestguesspass|none)/.exec(lower)
    if (spf) {
      out.push({
        label: `SPF ${spf[1]}`,
        level: spf[1] === "pass" ? "ok" : spf[1] === "fail" || spf[1] === "softfail" ? "warn" : "unknown",
      })
    }
    if (dkim) {
      out.push({
        label: `DKIM ${dkim[1]}`,
        level: dkim[1] === "pass" ? "ok" : dkim[1] === "fail" ? "warn" : "unknown",
      })
    }
    if (dmarc) {
      out.push({
        label: `DMARC ${dmarc[1]}`,
        level: dmarc[1] === "pass" || dmarc[1] === "bestguesspass" ? "ok" : dmarc[1] === "fail" ? "warn" : "unknown",
      })
    }
  }
  const replyTo = headers["Reply-To"] ?? headers["Reply-to"]
  const from = headers["From"] ?? headers["from"]
  if (replyTo && from && replyTo.toLowerCase() !== from.toLowerCase()) {
    out.push({ label: "Reply-To ≠ From", level: "warn" })
  }
  if (out.length === 0) {
    out.push({ label: "Auth headers not stored", level: "unknown" })
  }
  return out
}

export function shortThreadSummary(input: {
  messageCount: number
  intel: StoredIntelligence | null
  reasons: string[]
}): string {
  if (input.intel?.intent) {
    const conf = Math.round((input.intel.intent_confidence ?? 0) * 100)
    const uncertain = input.intel.uncertain ? " (uncertain)" : ""
    return `Thread looks like ${input.intel.intent.replace(/_/g, " ")}${uncertain} · ${conf}% · ${input.messageCount} message${input.messageCount === 1 ? "" : "s"} in view.`
  }
  if (input.reasons.length > 0) {
    return `${input.messageCount} message${input.messageCount === 1 ? "" : "s"}. Signals: ${input.reasons.slice(0, 2).join("; ")}.`
  }
  return `${input.messageCount} message${input.messageCount === 1 ? "" : "s"} in this thread. No strong intent yet.`
}
