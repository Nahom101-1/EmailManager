import { describe, expect, it } from "vitest"
import { decryptPassword, encryptPassword } from "@/lib/crypto/credentials"

describe("encryptPassword / decryptPassword", () => {
  it("round-trips a password", () => {
    const cipher = encryptPassword("s3cret-pass!")
    expect(cipher).not.toBe("s3cret-pass!")
    expect(decryptPassword(cipher)).toBe("s3cret-pass!")
  })

  it("produces different ciphertext for the same plaintext", () => {
    const a = encryptPassword("same")
    const b = encryptPassword("same")
    expect(a).not.toBe(b)
    expect(decryptPassword(a)).toBe("same")
    expect(decryptPassword(b)).toBe("same")
  })
})
