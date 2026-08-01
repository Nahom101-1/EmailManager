import { describe, expect, it } from "vitest"
import { hashEmbed } from "@/lib/ai/embeddings"
import {
  classifySubscriptionKind,
  embeddingSubscriptionKind,
  heuristicSubscriptionKind,
} from "@/lib/ai/subscription-kind"

describe("heuristicSubscriptionKind", () => {
  it("marks charged receipts as paid even with unsubscribe headers", () => {
    const result = heuristicSubscriptionKind({
      subject: "Your receipt",
      snippet: "You were charged $12.99 for your monthly plan",
      headers: { "List-Unsubscribe": "<mailto:x@y.com>" },
      amount: 12.99,
    })
    expect(result?.kind).toBe("paid")
  })

  it("marks digest + List-Unsubscribe as mailing_list", () => {
    const result = heuristicSubscriptionKind({
      subject: "Weekly digest",
      snippet: "Top stories this week. Unsubscribe below.",
      headers: { "List-Unsubscribe": "<https://example.com/unsub>" },
    })
    expect(result?.kind).toBe("mailing_list")
  })
})

describe("embeddingSubscriptionKind", () => {
  it("separates paid vs list prototypes in hash space", () => {
    const paid = embeddingSubscriptionKind(
      hashEmbed("Netflix subscription receipt charged $15.49 monthly billing renews")
    )
    const list = embeddingSubscriptionKind(
      hashEmbed("Weekly newsletter digest mailing list unsubscribe view in browser")
    )
    expect(paid.kind).toBe("paid")
    expect(list.kind).toBe("mailing_list")
  })
})

describe("classifySubscriptionKind", () => {
  it("uses intent receipt as paid", () => {
    const result = classifySubscriptionKind({
      subject: "Thanks",
      snippet: "Your order",
      intent: "receipt",
      amount: 9.99,
    })
    expect(result.kind).toBe("paid")
  })

  it("uses intent newsletter as mailing_list", () => {
    const result = classifySubscriptionKind({
      subject: "This week",
      snippet: "Stories for you",
      intent: "newsletter",
    })
    expect(result.kind).toBe("mailing_list")
  })
})
