import { describe, expect, it } from "vitest"
import { contentFingerprint, isNoiseCandidate, normalizeSubject } from "@/lib/ai/near-dup"
import { pageImapUids } from "@/lib/imap/client"
import { isInterruptedSyncError } from "@/lib/sync/status"

describe("near-dup", () => {
  it("normalizes subjects for fingerprinting", () => {
    expect(normalizeSubject("Re: Weekly Digest — March 2024")).toBe("weekly digest")
  })

  it("matches fingerprints across Re: variants", () => {
    const a = contentFingerprint({
      from: "News <news@example.com>",
      subject: "Weekly Digest",
      snippet: "Hello subscribers",
    })
    const b = contentFingerprint({
      from: "News <news@example.com>",
      subject: "Re: Weekly Digest",
      snippet: "Hello subscribers",
    })
    expect(a).toBe(b)
  })

  it("detects newsletter noise candidates", () => {
    expect(
      isNoiseCandidate({
        subject: "March newsletter",
        headers: { "List-Unsubscribe": "<mailto:x@y.com>" },
      })
    ).toBe(true)
    expect(
      isNoiseCandidate({
        subject: "Dinner tomorrow?",
        snippet: "Want to grab food?",
      })
    ).toBe(false)
  })
})

describe("pageImapUids", () => {
  it("pages newest-first toward a 2k target", () => {
    const uids = Array.from({ length: 5000 }, (_, i) => i + 1)
    const first = pageImapUids({ uids, offset: 0, pageSize: 400, historyTarget: 2000 })
    expect(first.page[0]).toBe(5000)
    expect(first.page).toHaveLength(400)
    expect(first.complete).toBe(false)

    const last = pageImapUids({
      uids,
      offset: 1600,
      pageSize: 400,
      historyTarget: 2000,
    })
    expect(last.page).toHaveLength(400)
    expect(last.complete).toBe(true)
    expect(last.considered).toBe(2000)
  })
})

describe("isInterruptedSyncError", () => {
  it("recognizes reclaim messages", () => {
    expect(isInterruptedSyncError("Previous sync was interrupted — tap Retry")).toBe(true)
    expect(isInterruptedSyncError("Google access was rejected (401)")).toBe(false)
  })
})
