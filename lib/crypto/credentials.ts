import CryptoJS from "crypto-js"

const SECRET = process.env.ENCRYPTION_SECRET
if (!SECRET && process.env.NODE_ENV === "production") {
  throw new Error("ENCRYPTION_SECRET env var is required")
}

const key = SECRET || "dev-secret-change-in-production"

export function encryptPassword(plaintext: string): string {
  return CryptoJS.AES.encrypt(plaintext, key).toString()
}

export function decryptPassword(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key)
  return bytes.toString(CryptoJS.enc.Utf8)
}
