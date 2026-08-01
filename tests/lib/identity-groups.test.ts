import { describe, expect, it } from "vitest"
import { normalizeCompanyKey } from "@/lib/identity/groups"

describe("normalizeCompanyKey", () => {
  it("prefers domain core over company string", () => {
    expect(normalizeCompanyKey("IMAX Membership", "imax.com")).toBe("imax")
    expect(normalizeCompanyKey("Xfinity IMAX", "billing.xfinity.com")).toBe("xfinity")
  })

  it("strips mail subdomains before taking the core", () => {
    expect(normalizeCompanyKey("Netflix", "mail.netflix.com")).toBe("netflix")
  })

  it("falls back to normalized company when domain missing", () => {
    expect(normalizeCompanyKey("Disney+", null)).toBe("disney")
    expect(normalizeCompanyKey("HBO Max", undefined)).toBe("hbomax")
  })
})
