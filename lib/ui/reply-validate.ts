/**
 * Reply composer validation — draft-only surface.
 * Never sends; surfaces recipient / identity warnings before a human can act.
 */

export type ReplyWarning = {
  level: "error" | "warn" | "info"
  code: string
  message: string
}

function parseAddressList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((p) => {
      const m = p.match(/<([^>]+)>/)
      return (m ? m[1] : p).trim().toLowerCase()
    })
    .filter((a) => a.includes("@"))
}

function domainOf(email: string): string {
  return email.split("@")[1] ?? ""
}

/** Cheap lookalike check: digit/letter swaps vs known mailbox domains. */
function looksLikeDomain(candidate: string, known: string): boolean {
  if (!candidate || !known || candidate === known) return false
  if (candidate.length < 4 || known.length < 4) return false
  // Same length with 1–2 char edits, or common homoglyph patterns.
  if (Math.abs(candidate.length - known.length) > 2) return false
  let diffs = 0
  const a = candidate
  const b = known
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) diffs++
    if (diffs > 2) return false
  }
  return diffs >= 1
}

export function validateReplyDraft(input: {
  from: string
  to: string
  cc?: string
  replyToHeader?: string | null
  fromHeader?: string | null
  connectedMailboxes: string[]
}): ReplyWarning[] {
  const warnings: ReplyWarning[] = []
  const from = input.from.trim().toLowerCase()
  const toList = parseAddressList(input.to)
  const ccList = parseAddressList(input.cc ?? "")
  const mailboxes = input.connectedMailboxes.map((m) => m.toLowerCase())
  const mailboxDomains = mailboxes.map(domainOf)

  if (!from) {
    warnings.push({
      level: "error",
      code: "from_missing",
      message: "Replying from is required — pick a connected mailbox.",
    })
  } else if (!mailboxes.includes(from)) {
    warnings.push({
      level: "error",
      code: "from_unknown",
      message: "Replying from an address that is not a connected mailbox.",
    })
  }

  if (toList.length === 0) {
    warnings.push({
      level: "error",
      code: "to_missing",
      message: "Add at least one To recipient.",
    })
  }

  const replyTo = input.replyToHeader
    ? parseAddressList(input.replyToHeader)[0]
    : null
  const headerFrom = input.fromHeader ? parseAddressList(input.fromHeader)[0] : null
  if (replyTo && headerFrom && replyTo !== headerFrom) {
    warnings.push({
      level: "warn",
      code: "reply_to_mismatch",
      message: `Reply-To (${replyTo}) differs from From (${headerFrom}). Confirm before drafting.`,
    })
  }

  for (const addr of [...toList, ...ccList]) {
    const d = domainOf(addr)
    if (mailboxDomains.some((md) => looksLikeDomain(d, md))) {
      warnings.push({
        level: "warn",
        code: "lookalike_domain",
        message: `${addr} looks similar to one of your mailboxes — possible lookalike domain.`,
      })
    }
  }

  if (toList.includes(from) || ccList.includes(from)) {
    warnings.push({
      level: "info",
      code: "self_recipient",
      message: "You are including your own mailbox as a recipient.",
    })
  }

  warnings.push({
    level: "info",
    code: "draft_only",
    message: "LifeOS prepares a draft only. Sending is always an explicit human action outside this app.",
  })

  return warnings
}

export function suggestReplyTargets(email: {
  from_address: string | null
  to_address: string | null
  headers: Record<string, string>
  provider_email: string | null
}): { from: string; to: string; cc: string } {
  const replyTo = email.headers["Reply-To"] ?? email.headers["Reply-to"]
  const to = replyTo
    ? parseAddressList(replyTo)[0] ?? email.from_address ?? ""
    : (email.from_address ?? "")
  return {
    from: email.provider_email ?? "",
    to,
    cc: "",
  }
}
