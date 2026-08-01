import { describe, expect, it } from "vitest"
import { buildHistoryResults, groupByRelevance } from "@/lib/ui/history-audits"
import type { LocalAccount, LocalSubscription } from "@/lib/db/local"

const acct = (over: Partial<LocalAccount>): LocalAccount =>
  ({
    id: "a1",
    user_id: "u",
    provider_id: null,
    company: "Netflix",
    domain: "netflix.com",
    email: null,
    status: "unknown",
    confidence: 0.8,
    source: "welcome",
    first_seen: "2023-01-01",
    last_seen: "2023-06-01",
    source_email_id: null,
    provider_email: "me@x.com",
    source_subject: null,
    source_from: null,
    source_snippet: null,
    ...over,
  }) as LocalAccount

const sub = (over: Partial<LocalSubscription>): LocalSubscription =>
  ({
    id: "s1",
    user_id: "u",
    provider_id: null,
    company: "Spotify",
    sender_email: null,
    sender_domain: "spotify.com",
    category: "streaming",
    kind: "paid",
    confidence: 0.4,
    source: null,
    status: "unknown",
    email_used: null,
    amount: null,
    currency: null,
    billing_cycle: null,
    due_date: null,
    first_seen: null,
    last_seen: null,
    source_email_id: null,
    provider_email: null,
    source_subject: null,
    source_from: null,
    source_snippet: null,
    ...over,
  }) as LocalSubscription

describe("buildHistoryResults", () => {
  it("groups unresolved into open/uncertain", () => {
    const results = buildHistoryResults({
      accounts: [acct({})],
      subs: [sub({})],
      security: [],
      needsReply: [],
      auditId: "unresolved",
    })
    expect(results.length).toBeGreaterThanOrEqual(2)
    const grouped = groupByRelevance(results)
    expect(
      grouped.open_and_relevant.length + grouped.uncertain.length
    ).toBeGreaterThanOrEqual(2)
  })

  it("marks old accounts as expired/uncertain", () => {
    const results = buildHistoryResults({
      accounts: [acct({ last_seen: "2022-01-01", status: "closed" })],
      subs: [],
      security: [],
      needsReply: [],
      auditId: "old-accounts",
    })
    expect(results[0]?.status).toBe("expired")
  })
})
