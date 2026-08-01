import { describe, expect, it } from "vitest"
import { heuristicIntent } from "@/lib/ai/intent"

describe("heuristicIntent", () => {
  it("classifies security alerts", () => {
    const result = heuristicIntent({
      subject: "Security alert: new sign-in",
      snippet: "We noticed a new sign-in to your account.",
    })
    expect(result?.intent).toBe("security")
    expect(result?.uncertain).toBe(false)
  })

  it("classifies trial endings", () => {
    const result = heuristicIntent({
      subject: "Your free trial ends in 3 days",
      snippet: "Upgrade now to keep access.",
    })
    expect(result?.intent).toBe("trial")
  })

  it("classifies newsletters via List-Unsubscribe", () => {
    const result = heuristicIntent({
      subject: "Weekly digest",
      snippet: "This week in tech",
      headers: { "List-Unsubscribe": "<mailto:unsub@example.com>" },
    })
    expect(result?.intent).toBe("newsletter")
  })

  it("returns null when there are no strong signals", () => {
    expect(
      heuristicIntent({
        subject: "Hello",
        snippet: "Just checking in",
      })
    ).toBeNull()
  })
})
