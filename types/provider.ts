export type ProviderType = "imap" | "gmail" | "outlook"

export interface EmailProvider {
  id: string
  userId: string
  type: ProviderType
  email: string
  displayName: string
  // IMAP-specific
  host?: string
  port?: number
  tls?: boolean
  // stored encrypted
  encryptedPassword?: string
  // status
  status: "active" | "error" | "syncing" | "pending"
  lastSyncAt?: Date
  errorMessage?: string
  createdAt: Date
}

export interface RawEmail {
  uid: number
  messageId: string
  from: string
  to: string
  subject: string
  date: Date
  bodyText?: string
  bodyHtml?: string
  attachments: string[]
  folder: string
  providerId: string
}

export interface ImapConfig {
  host: string
  port: number
  tls: boolean
  email: string
  username?: string  // overrides email as IMAP login (e.g. Domeneshop uses mailbox username)
  password: string
}

export interface ConnectionTestResult {
  success: boolean
  error?: string
  folders?: string[]
  emailCount?: number
}
