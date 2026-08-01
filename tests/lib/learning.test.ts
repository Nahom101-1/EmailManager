import { describe, expect, it } from "vitest"
import { getLearningStore, learningConfidenceBias, recordLearningLabel } from "@/lib/ai/learning"

describe("active learning labels", () => {
  it("biases confidence after confirm / ignore labels", () => {
    recordLearningLabel({
      kind: "confirm",
      entity: "subscription",
      company: "Acme Sync",
      domain: "acme-sync.test",
    })
    recordLearningLabel({
      kind: "ignore",
      entity: "subscription",
      company: "Spam Digest",
      domain: "spam-digest.test",
    })

    expect(
      learningConfidenceBias({ company: "Acme Sync", domain: "acme-sync.test" })
    ).toBeGreaterThan(0)
    expect(
      learningConfidenceBias({ company: "Spam Digest", domain: "spam-digest.test" })
    ).toBeLessThan(0)

    const store = getLearningStore()
    expect(store.labels.length).toBeGreaterThanOrEqual(2)
  })
})
