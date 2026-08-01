import { describe, expect, it } from "vitest"
import { suggestReplyTargets, validateReplyDraft } from "@/lib/ui/reply-validate"

describe("validateReplyDraft", () => {
  it("requires from and to", () => {
    const warnings = validateReplyDraft({
      from: "",
      to: "",
      connectedMailboxes: ["me@example.com"],
    })
    expect(warnings.some((w) => w.code === "from_missing")).toBe(true)
    expect(warnings.some((w) => w.code === "to_missing")).toBe(true)
    expect(warnings.some((w) => w.code === "draft_only")).toBe(true)
  })

  it("flags Reply-To mismatch", () => {
    const warnings = validateReplyDraft({
      from: "me@example.com",
      to: "other@corp.com",
      connectedMailboxes: ["me@example.com"],
      fromHeader: "Vendor <billing@vendor.com>",
      replyToHeader: "Phish <evil@lookalike.com>",
    })
    expect(warnings.some((w) => w.code === "reply_to_mismatch")).toBe(true)
  })

  it("rejects unknown from mailbox", () => {
    const warnings = validateReplyDraft({
      from: "stranger@example.com",
      to: "a@b.com",
      connectedMailboxes: ["me@example.com"],
    })
    expect(warnings.some((w) => w.code === "from_unknown" && w.level === "error")).toBe(true)
  })
})

describe("suggestReplyTargets", () => {
  it("prefers Reply-To when present", () => {
    const t = suggestReplyTargets({
      from_address: "From Name <from@vendor.com>",
      to_address: "me@example.com",
      headers: { "Reply-To": "support@vendor.com" },
      provider_email: "me@example.com",
    })
    expect(t.from).toBe("me@example.com")
    expect(t.to).toBe("support@vendor.com")
  })
})
