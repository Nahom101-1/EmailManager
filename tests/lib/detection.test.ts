import { describe, expect, it } from "vitest"
import {
  detectAccount,
  detectSubscription,
  extractDomain,
  extractSenderEmail,
  parseAmount,
} from "@/lib/detection"

describe("parseAmount", () => {
  it("parses monthly subscription amounts", () => {
    expect(parseAmount("Your plan is $12.99/mo")).toEqual({
      amount: 12.99,
      billingCycle: "monthly",
    })
  })

  it("parses yearly amounts", () => {
    expect(parseAmount("Billed $120 / year")).toEqual({
      amount: 120,
      billingCycle: "yearly",
    })
  })

  it("returns null when no amount is present", () => {
    expect(parseAmount("Thanks for signing up")).toEqual({
      amount: null,
      billingCycle: null,
    })
  })

  it("parses was charged and total due patterns", () => {
    expect(parseAmount("You were charged $15.49 for your plan")).toEqual({
      amount: 15.49,
      billingCycle: null,
    })
    expect(parseAmount("Total due: €42.00")).toEqual({
      amount: 42,
      billingCycle: "monthly",
    })
  })

  it("parses renews-on amounts", () => {
    expect(parseAmount("Your membership renews on Apr 1 for $9.99")).toEqual({
      amount: 9.99,
      billingCycle: "monthly",
    })
  })
})

describe("extractSenderEmail / extractDomain", () => {
  it("extracts email from angle-bracket From headers", () => {
    expect(extractSenderEmail("Spotify <no-reply@spotify.com>")).toBe("no-reply@spotify.com")
  })

  it("strips common mail subdomains from domains", () => {
    expect(extractDomain("updates@mail.notion.so")).toBe("notion.so")
  })
})

describe("detectSubscription", () => {
  it("detects a known vendor receipt", () => {
    const result = detectSubscription({
      from: "Netflix <billing@mail.netflix.com>",
      subject: "Your Netflix subscription receipt",
      snippet: "You were charged $15.49 for your monthly plan.",
      headers: { "List-Unsubscribe": "<mailto:unsub@netflix.com>" },
    })
    expect(result).not.toBeNull()
    expect(result?.company).toMatch(/Netflix/i)
    expect(result?.confidence).toBeGreaterThan(0.5)
  })

  it("ignores unrelated mail", () => {
    expect(
      detectSubscription({
        from: "Friend <friend@example.com>",
        subject: "Dinner tomorrow?",
        snippet: "Want to grab food?",
      })
    ).toBeNull()
  })
})

describe("detectAccount", () => {
  it("detects verification / welcome account mail", () => {
    const result = detectAccount({
      from: "GitHub <noreply@github.com>",
      subject: "Verify your email address",
      snippet: "Confirm your account to finish signup.",
    })
    expect(result).not.toBeNull()
    expect(result?.confidence).toBeGreaterThan(0.4)
  })
})
