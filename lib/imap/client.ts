import { ImapFlow } from "imapflow"
import type { ImapConfig, ConnectionTestResult, RawEmail } from "@/types/provider"

/** Align with Gmail crawl target / page size. */
export const IMAP_HISTORY_TARGET = 2000
export const IMAP_MESSAGES_PER_SYNC = 400

export function createImapClient(config: ImapConfig): ImapFlow {
  const email = config.email.trim()
  const username = config.username?.trim() || email

  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls,
    auth: {
      user: username,
      pass: config.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    logger: false,
  })
}

export async function testImapConnection(config: ImapConfig): Promise<ConnectionTestResult> {
  const client = createImapClient(config)
  try {
    await client.connect()
    const folders: string[] = []
    const listed = await client.list()
    for (const mailbox of listed) {
      folders.push(mailbox.path)
    }
    const lock = await client.getMailboxLock("INBOX")
    const emailCount = client.mailbox !== false ? client.mailbox.exists : 0
    lock.release()
    await client.logout()
    return { success: true, folders, emailCount }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    const error = formatImapError(raw, config)
    return { success: false, error }
  } finally {
    client.close()
  }
}

function formatImapError(raw: string, config: ImapConfig) {
  const message = raw.trim()

  if (
    config.host === "imap.gmail.com" &&
    /command failed|auth|login|credentials|password/i.test(message)
  ) {
    return "Gmail login failed. Use your full Gmail address and a Google app password, not your normal Google account password. Also confirm IMAP is enabled in Gmail settings."
  }

  if (/required time|timed out|timeout/i.test(message)) {
    return `Could not reach ${config.host}:${config.port} before the timeout. Check the IMAP server, port, SSL/TLS setting, and local firewall.`
  }

  if (/command failed|auth|login|credentials|password/i.test(message)) {
    return `Login failed. Check the IMAP username and password. Some providers, including Domeneshop, use a mailbox username instead of the email address.`
  }

  return (
    message || `Could not reach ${config.host}:${config.port} — check host, port, and credentials`
  )
}

/** Newest-first page of UIDs for capped crawl (pure helper for tests). */
export function pageImapUids(input: {
  uids: number[]
  offset: number
  pageSize: number
  historyTarget: number
}): { page: number[]; nextOffset: number; complete: boolean; considered: number } {
  const newestFirst = [...input.uids].sort((a, b) => b - a)
  const considered = newestFirst.slice(0, input.historyTarget)
  const offset = Math.max(0, input.offset)
  const page = considered.slice(offset, offset + input.pageSize)
  const nextOffset = offset + page.length
  const complete = nextOffset >= considered.length || page.length === 0
  return { page, nextOffset, complete, considered: considered.length }
}

export async function fetchEmails(
  config: ImapConfig,
  providerId: string,
  options?: {
    folder?: string
    since?: Date
    /** Resume offset into newest-first UID list. */
    offset?: number
    maxMessages?: number
    historyTarget?: number
  }
): Promise<{
  emails: RawEmail[]
  nextOffset: number
  complete: boolean
  considered: number
}> {
  const folder = options?.folder ?? "INBOX"
  const maxMessages = options?.maxMessages ?? IMAP_MESSAGES_PER_SYNC
  const historyTarget = options?.historyTarget ?? IMAP_HISTORY_TARGET
  const offset = options?.offset ?? 0

  const client = createImapClient(config)
  const emails: RawEmail[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock(folder)

    try {
      const sinceDate = options?.since ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const searchResults = await client.search({ since: sinceDate })

      if (!searchResults || searchResults.length === 0) {
        return { emails, nextOffset: 0, complete: true, considered: 0 }
      }

      const { page: uids, nextOffset, complete, considered } = pageImapUids({
        uids: searchResults,
        offset,
        pageSize: maxMessages,
        historyTarget,
      })

      if (uids.length === 0) {
        return { emails, nextOffset, complete: true, considered }
      }

      const batchSize = 50
      for (let i = 0; i < uids.length; i += batchSize) {
        const batch = uids.slice(i, i + batchSize)

        for await (const msg of client.fetch(batch, {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: false,
        })) {
          const from = msg.envelope?.from?.[0]
          const fromStr = from ? `${from.name ?? ""} <${from.address ?? ""}>`.trim() : ""

          const to = msg.envelope?.to?.[0]
          const toStr = to?.address ?? ""

          emails.push({
            uid: msg.uid,
            messageId: msg.envelope?.messageId ?? `${msg.uid}@${config.host}`,
            from: fromStr,
            to: toStr,
            subject: msg.envelope?.subject ?? "(no subject)",
            date: msg.envelope?.date ?? new Date(),
            attachments: extractAttachmentNames(msg.bodyStructure),
            folder,
            providerId,
          })
        }
      }

      return { emails, nextOffset, complete, considered }
    } finally {
      lock.release()
    }
  } catch (err) {
    throw new Error(`IMAP fetch failed: ${err instanceof Error ? err.message : "Unknown error"}`)
  } finally {
    try {
      await client.logout()
    } catch {
      /* already closed */
    }
    client.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAttachmentNames(structure: any): string[] {
  if (!structure) return []
  const names: string[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(node: any) {
    if (!node) return
    if (node.disposition === "attachment" && node.dispositionParameters?.filename) {
      names.push(node.dispositionParameters.filename)
    }
    if (node.childNodes) node.childNodes.forEach(walk)
  }

  walk(structure)
  return names
}
