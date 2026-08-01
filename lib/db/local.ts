import Database from "better-sqlite3"
import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import path from "node:path"

const DB_PATH = process.env.LIFEOS_DB_PATH ?? path.join(process.cwd(), "data", "lifeos.sqlite")
const LOCAL_USER_ID = "local-user"

export type ProviderStatus = "active" | "error" | "syncing" | "pending"
export type ProviderType = "imap" | "gmail" | "outlook"

export interface LocalProvider {
  id: string
  user_id: string
  type: ProviderType
  email: string
  username: string | null
  display_name: string
  host: string | null
  port: number | null
  tls: boolean | null
  encrypted_password: string | null
  status: ProviderStatus
  last_sync_at: string | null
  error_message: string | null
  created_at: string
  history_page_token: string | null
  history_synced_count: number
  history_complete: boolean
  history_target: number
  gmail_history_id: string | null
  newest_internal_date: string | null
}

export interface GoogleAccount {
  provider_id: string
  google_account_id: string | null
  email: string
  scope: string
  encrypted_access_token: string
  encrypted_refresh_token: string | null
  expires_at: string | null
  updated_at: string
}

export interface GmailMessageInput {
  providerId: string
  gmailMessageId: string
  threadId?: string
  from?: string
  to?: string
  subject?: string
  date?: string
  snippet?: string
  labels?: string[]
  headers?: Record<string, string>
}

export interface DashboardStats {
  providerCount: number
  emailCount: number
  subscriptionCount: number
  accountCount: number
  lastSyncAt: string | null
  syncing: boolean
  lastError: string | null
}

export type SubscriptionStatus = "active" | "cancelled" | "unknown" | "ignored"
export type SubscriptionKind = "paid" | "mailing_list"
export type AccountStatus = "active" | "closed" | "unknown" | "ignore"

export interface LocalSubscription {
  id: string
  user_id: string
  provider_id: string | null
  company: string
  sender_email: string | null
  sender_domain: string | null
  category: string | null
  kind: SubscriptionKind | null
  confidence: number | null
  source: string | null
  status: SubscriptionStatus
  email_used: string | null
  first_seen: string | null
  last_seen: string | null
  source_email_id: string | null
  provider_email: string | null
  source_subject: string | null
  source_from: string | null
  source_snippet: string | null
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  due_date: string | null
}

export interface LocalAccount {
  id: string
  user_id: string
  provider_id: string | null
  company: string
  domain: string | null
  email: string | null
  status: AccountStatus
  confidence: number | null
  source: string | null
  first_seen: string | null
  last_seen: string | null
  source_email_id: string | null
  provider_email: string | null
  source_subject: string | null
  source_from: string | null
  source_snippet: string | null
}

export interface LocalEmail {
  id: string
  provider_id: string
  gmail_message_id: string | null
  thread_id: string | null
  message_id: string | null
  from_address: string | null
  to_address: string | null
  subject: string | null
  date: string | null
  snippet: string | null
  labels: string[]
  headers: Record<string, string>
  /** Filename list when stored (often empty for Gmail metadata sync). */
  attachments: string[]
  provider_email: string | null
  provider_name: string | null
}

export type SyncRunStatus = "running" | "success" | "error"

export interface LocalSyncRun {
  id: string
  provider_id: string
  status: SyncRunStatus
  started_at: string
  finished_at: string | null
  emails_seen: number
  emails_stored: number
  subscriptions_detected: number
  accounts_detected: number
  error: string | null
  provider_email: string | null
  provider_name: string | null
}

export interface DetectedSubscriptionRecord {
  providerId: string
  company: string
  senderEmail: string | null
  senderDomain: string | null
  category: string
  kind?: SubscriptionKind
  confidence: number
  source: string
  emailUsed: string | null
  evidenceEmailId: string | null
  seenAt: string
  amount?: number | null
  billing_cycle?: string | null
  due_date?: string | null
  currency?: string | null
}

export type ProviderPurpose = "personal" | "work" | "shopping" | "other"

export interface ProviderTag {
  purpose: ProviderPurpose
  label?: string
  source: "user" | "ai"
}

export interface DetectedAccountRecord {
  providerId: string
  company: string
  domain: string | null
  email: string | null
  confidence: number
  source: string
  evidenceEmailId: string | null
  seenAt: string
}

let db: Database.Database | undefined

export function getLocalUserId() {
  return LOCAL_USER_ID
}

export function getDb() {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma("journal_mode = WAL")
    db.pragma("foreign_keys = ON")
    migrate(db)
  }

  return db
}

export function getDbPath() {
  return DB_PATH
}

/* ------------------------------------------------------------------ */
/* Providers                                                          */
/* ------------------------------------------------------------------ */

export function listProviders(userId = LOCAL_USER_ID): LocalProvider[] {
  const providers = getDb()
    .prepare(
      `
      select *
      from providers
      where user_id = ?
      order by created_at desc
    `
    )
    .all(userId) as Array<Omit<LocalProvider, "tls"> & { tls: number | boolean | null }>

  return providers.map(normalizeProvider)
}

export function getProvider(providerId: string): LocalProvider | null {
  const provider = getDb().prepare("select * from providers where id = ?").get(providerId) as
    (Omit<LocalProvider, "tls"> & { tls: number | boolean | null }) | undefined

  return provider ? normalizeProvider(provider) : null
}

export function createProvider(input: {
  userId?: string
  type: ProviderType
  email: string
  displayName: string
  username?: string
  host?: string
  port?: number
  tls?: boolean
  encryptedPassword?: string
  status?: ProviderStatus
}) {
  const provider = {
    id: randomUUID(),
    user_id: input.userId ?? LOCAL_USER_ID,
    type: input.type,
    email: input.email,
    username: input.username ?? null,
    display_name: input.displayName,
    host: input.host ?? null,
    port: input.port ?? null,
    tls: input.tls == null ? null : Number(input.tls),
    encrypted_password: input.encryptedPassword ?? null,
    status: input.status ?? "pending",
    last_sync_at: null,
    error_message: null,
    created_at: new Date().toISOString(),
  }

  getDb()
    .prepare(
      `
      insert into providers (
        id, user_id, type, email, username, display_name, host, port, tls,
        encrypted_password, status, last_sync_at, error_message, created_at
      ) values (
        @id, @user_id, @type, @email, @username, @display_name, @host, @port, @tls,
        @encrypted_password, @status, @last_sync_at, @error_message, @created_at
      )
    `
    )
    .run(provider)

  return normalizeProvider(provider)
}

export function updateProviderSyncStatus(input: {
  providerId: string
  status: ProviderStatus
  lastSyncAt?: string | null
  errorMessage?: string | null
}) {
  getDb()
    .prepare(
      `
      update providers
      set status = @status,
          last_sync_at = coalesce(@lastSyncAt, last_sync_at),
          error_message = @errorMessage
      where id = @providerId
    `
    )
    .run({
      providerId: input.providerId,
      status: input.status,
      lastSyncAt: input.lastSyncAt ?? null,
      errorMessage: input.errorMessage ?? null,
    })
}

export function updateProviderHistoryCursor(input: {
  providerId: string
  historyPageToken: string | null
  historySyncedCount: number
  historyComplete: boolean
  historyTarget?: number
  gmailHistoryId?: string | null
  newestInternalDate?: string | null
}) {
  getDb()
    .prepare(
      `
      update providers
      set history_page_token = @historyPageToken,
          history_synced_count = @historySyncedCount,
          history_complete = @historyComplete,
          history_target = coalesce(@historyTarget, history_target),
          gmail_history_id = coalesce(@gmailHistoryId, gmail_history_id),
          newest_internal_date = case
            when @newestInternalDate is null then newest_internal_date
            when newest_internal_date is null then @newestInternalDate
            when @newestInternalDate > newest_internal_date then @newestInternalDate
            else newest_internal_date
          end
      where id = @providerId
    `
    )
    .run({
      providerId: input.providerId,
      historyPageToken: input.historyPageToken,
      historySyncedCount: input.historySyncedCount,
      historyComplete: input.historyComplete ? 1 : 0,
      historyTarget: input.historyTarget ?? null,
      gmailHistoryId: input.gmailHistoryId ?? null,
      newestInternalDate: input.newestInternalDate ?? null,
    })
}

/** Persist only the resume page token (crash-safe before heavy work). */
export function updateProviderPageToken(providerId: string, pageToken: string | null) {
  getDb()
    .prepare("update providers set history_page_token = ? where id = ?")
    .run(pageToken, providerId)
}

/** Unique emails stored for a provider — used for crawl progress toward target. */
export function countProviderEmails(providerId: string): number {
  const row = getDb()
    .prepare("select count(*) as count from emails where provider_id = ?")
    .get(providerId) as { count: number }
  return row.count
}

const STUCK_SYNC_MESSAGE =
  "Previous sync was interrupted — tap Retry to continue. Progress is saved."

/** Mark sync_runs stuck in "running" longer than maxAgeMs as errored. */
export function reclaimStaleSyncRuns(maxAgeMs = 15 * 60 * 1000): number {
  const database = getDb()
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString()
  const now = new Date().toISOString()

  const staleRuns = database
    .prepare(
      `
      update sync_runs
      set status = 'error',
          finished_at = ?,
          error = coalesce(error, ?)
      where status = 'running' and started_at < ?
    `
    )
    .run(now, STUCK_SYNC_MESSAGE, cutoff)

  // Providers left in "syncing" with no live run — clear so Retry works.
  const stuckProviders = database
    .prepare(
      `
      update providers
      set status = 'error',
          error_message = ?
      where status = 'syncing'
        and id not in (select provider_id from sync_runs where status = 'running')
    `
    )
    .run(STUCK_SYNC_MESSAGE)

  return staleRuns.changes + stuckProviders.changes
}

export function deleteProvider(providerId: string) {
  const database = getDb()
  const remove = database.transaction((id: string) => {
    database.prepare("delete from subscriptions where provider_id = ?").run(id)
    database.prepare("delete from accounts where provider_id = ?").run(id)
    database.prepare("delete from sync_runs where provider_id = ?").run(id)
    // emails + google_accounts cascade via foreign keys.
    database.prepare("delete from providers where id = ?").run(id)
  })
  remove(providerId)
}

/* ------------------------------------------------------------------ */
/* Google accounts                                                    */
/* ------------------------------------------------------------------ */

export function upsertGoogleProvider(input: {
  userId?: string
  email: string
  displayName?: string
  googleAccountId?: string
  scope: string
  encryptedAccessToken: string
  encryptedRefreshToken?: string
  expiresAt?: string
}) {
  const userId = input.userId ?? LOCAL_USER_ID
  const existing = getDb()
    .prepare(
      `
      select p.*
      from providers p
      join google_accounts g on g.provider_id = p.id
      where p.user_id = ? and g.email = ?
      limit 1
    `
    )
    .get(userId, input.email) as
    (Omit<LocalProvider, "tls"> & { tls: number | boolean | null }) | undefined

  const now = new Date().toISOString()
  const provider = existing
    ? normalizeProvider(existing)
    : createProvider({
        userId,
        type: "gmail",
        email: input.email,
        displayName: input.displayName ?? input.email,
        host: "gmail.googleapis.com",
        status: "active",
      })

  if (existing) {
    getDb()
      .prepare(
        `
        update providers
        set display_name = ?, status = 'active', error_message = null
        where id = ?
      `
      )
      .run(input.displayName ?? input.email, provider.id)
  }

  getDb()
    .prepare(
      `
      insert into google_accounts (
        provider_id, google_account_id, email, scope, encrypted_access_token,
        encrypted_refresh_token, expires_at, updated_at
      ) values (
        @providerId, @googleAccountId, @email, @scope, @encryptedAccessToken,
        @encryptedRefreshToken, @expiresAt, @updatedAt
      )
      on conflict(provider_id) do update set
        google_account_id = excluded.google_account_id,
        email = excluded.email,
        scope = excluded.scope,
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, google_accounts.encrypted_refresh_token),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
    )
    .run({
      providerId: provider.id,
      googleAccountId: input.googleAccountId ?? null,
      email: input.email,
      scope: input.scope,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedAt: now,
    })

  return provider
}

export function getGoogleAccount(providerId: string): GoogleAccount | null {
  const account = getDb()
    .prepare("select * from google_accounts where provider_id = ?")
    .get(providerId) as GoogleAccount | undefined

  return account ?? null
}

export function updateGoogleAccessToken(input: {
  providerId: string
  encryptedAccessToken: string
  expiresAt?: string
}) {
  getDb()
    .prepare(
      `
      update google_accounts
      set encrypted_access_token = ?, expires_at = ?, updated_at = ?
      where provider_id = ?
    `
    )
    .run(
      input.encryptedAccessToken,
      input.expiresAt ?? null,
      new Date().toISOString(),
      input.providerId
    )
}

/* ------------------------------------------------------------------ */
/* Emails                                                             */
/* ------------------------------------------------------------------ */

export function upsertGmailMessages(messages: GmailMessageInput[]): {
  inserted: number
  updated: number
  total: number
} {
  if (messages.length === 0) return { inserted: 0, updated: 0, total: 0 }

  const existsStmt = getDb().prepare(
    "select id from emails where provider_id = ? and gmail_message_id = ? limit 1"
  )
  const statement = getDb().prepare(`
    insert into emails (
      id, provider_id, uid, gmail_message_id, thread_id, message_id,
      from_address, to_address, subject, date, body_text, snippet,
      labels, headers, attachments, folder, created_at
    ) values (
      @id, @providerId, @uid, @gmailMessageId, @threadId, @messageId,
      @from, @to, @subject, @date, null, @snippet,
      @labels, @headers, '[]', 'GMAIL', @createdAt
    )
    on conflict(provider_id, gmail_message_id) do update set
      thread_id = excluded.thread_id,
      message_id = excluded.message_id,
      from_address = excluded.from_address,
      to_address = excluded.to_address,
      subject = excluded.subject,
      date = excluded.date,
      snippet = excluded.snippet,
      labels = excluded.labels,
      headers = excluded.headers
  `)

  let inserted = 0
  let updated = 0
  const write = getDb().transaction((items: GmailMessageInput[]) => {
    for (const item of items) {
      const existing = existsStmt.get(item.providerId, item.gmailMessageId) as
        { id: string } | undefined
      statement.run({
        id: randomUUID(),
        providerId: item.providerId,
        uid: numericIdFromString(item.gmailMessageId),
        gmailMessageId: item.gmailMessageId,
        threadId: item.threadId ?? null,
        messageId: item.headers?.["Message-ID"] ?? item.gmailMessageId,
        from: item.from ?? null,
        to: item.to ?? null,
        subject: item.subject ?? null,
        date: item.date ?? null,
        snippet: item.snippet ?? null,
        labels: JSON.stringify(item.labels ?? []),
        headers: JSON.stringify(item.headers ?? {}),
        createdAt: new Date().toISOString(),
      })
      if (existing) updated += 1
      else inserted += 1
    }
  })

  write(messages)
  return { inserted, updated, total: messages.length }
}

export function getEmailIdMap(providerId: string, gmailMessageIds: string[]): Map<string, string> {
  const map = new Map<string, string>()
  if (gmailMessageIds.length === 0) return map

  const placeholders = gmailMessageIds.map(() => "?").join(",")
  const rows = getDb()
    .prepare(
      `
      select id, gmail_message_id
      from emails
      where provider_id = ? and gmail_message_id in (${placeholders})
    `
    )
    .all(providerId, ...gmailMessageIds) as Array<{ id: string; gmail_message_id: string }>

  for (const row of rows) {
    map.set(row.gmail_message_id, row.id)
  }
  return map
}

type EmailRowRaw = Omit<LocalEmail, "labels" | "headers" | "attachments"> & {
  labels: string
  headers: string
  attachments: string
}

function mapEmailRow(row: EmailRowRaw): LocalEmail {
  return {
    ...row,
    labels: safeJsonParse<string[]>(row.labels, []),
    headers: safeJsonParse<Record<string, string>>(row.headers, {}),
    attachments: safeJsonParse<string[]>(row.attachments, []),
  }
}

export function getEmailById(emailId: string): LocalEmail | null {
  const row = getDb()
    .prepare(
      `
      select e.*, p.email as provider_email, p.display_name as provider_name
      from emails e
      left join providers p on p.id = e.provider_id
      where e.id = ?
    `
    )
    .get(emailId) as EmailRowRaw | undefined

  if (!row) return null
  return mapEmailRow(row)
}

/** Chronological thread messages for conversation view (same provider + thread_id). */
export function listEmailsInThread(
  providerId: string,
  threadId: string | null | undefined,
  limit = 40
): LocalEmail[] {
  if (!threadId) return []
  const rows = getDb()
    .prepare(
      `
      select e.*, p.email as provider_email, p.display_name as provider_name
      from emails e
      left join providers p on p.id = e.provider_id
      where e.provider_id = ? and e.thread_id = ?
      order by coalesce(e.date, e.created_at) asc
      limit ?
    `
    )
    .all(providerId, threadId, limit) as EmailRowRaw[]
  return rows.map(mapEmailRow)
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                      */
/* ------------------------------------------------------------------ */

export function listSubscriptions(userId = LOCAL_USER_ID): LocalSubscription[] {
  return getDb()
    .prepare(
      `
      select
        s.*,
        p.email as provider_email,
        e.subject as source_subject,
        e.from_address as source_from,
        e.snippet as source_snippet
      from subscriptions s
      left join providers p on p.id = s.provider_id
      left join emails e on e.id = s.source_email_id
      where s.user_id = ?
      order by
        case s.status
          when 'unknown' then 0
          when 'active' then 1
          when 'cancelled' then 2
          when 'ignored' then 3
          else 4
        end,
        s.confidence desc,
        coalesce(s.last_seen, s.first_seen) desc
    `
    )
    .all(userId) as LocalSubscription[]
}

export function getSubscriptionById(
  subscriptionId: string,
  userId = LOCAL_USER_ID
): LocalSubscription | null {
  const row = getDb()
    .prepare(
      `
      select
        s.*,
        p.email as provider_email,
        e.subject as source_subject,
        e.from_address as source_from,
        e.snippet as source_snippet
      from subscriptions s
      left join providers p on p.id = s.provider_id
      left join emails e on e.id = s.source_email_id
      where s.id = ? and s.user_id = ?
    `
    )
    .get(subscriptionId, userId) as LocalSubscription | undefined
  return row ?? null
}

export function updateSubscriptionStatus(input: {
  id: string
  userId?: string
  status: SubscriptionStatus
}) {
  getDb()
    .prepare("update subscriptions set status = ? where id = ? and user_id = ?")
    .run(input.status, input.id, input.userId ?? LOCAL_USER_ID)
}

export function updateSubscriptionCategory(input: {
  id: string
  userId?: string
  category: string
}) {
  getDb()
    .prepare("update subscriptions set category = ? where id = ? and user_id = ?")
    .run(input.category, input.id, input.userId ?? LOCAL_USER_ID)
}

export function upsertDetectedSubscriptions(input: {
  userId?: string
  records: DetectedSubscriptionRecord[]
}) {
  const userId = input.userId ?? LOCAL_USER_ID
  if (input.records.length === 0) return 0

  const statement = getDb().prepare(`
    insert into subscriptions (
      id, user_id, provider_id, company, sender_email, sender_domain,
      category, kind, confidence, source, status, email_used,
      first_seen, last_seen, source_email_id, amount, billing_cycle, due_date, currency
    ) values (
      @id, @userId, @providerId, @company, @senderEmail, @senderDomain,
      @category, @kind, @confidence, @source, 'unknown', @emailUsed,
      @seenAt, @seenAt, @evidenceEmailId, @amount, @billingCycle, @dueDate, @currency
    )
    on conflict(user_id, provider_id, company) do update set
      last_seen = max(coalesce(subscriptions.last_seen, excluded.last_seen), excluded.last_seen),
      first_seen = min(coalesce(subscriptions.first_seen, excluded.first_seen), excluded.first_seen),
      confidence = max(coalesce(subscriptions.confidence, 0), excluded.confidence),
      category = case when excluded.confidence >= coalesce(subscriptions.confidence, 0)
                      then excluded.category else subscriptions.category end,
      kind = case
        when excluded.kind = 'paid' then 'paid'
        when subscriptions.kind = 'paid' then 'paid'
        else coalesce(excluded.kind, subscriptions.kind, 'paid')
      end,
      source = case when excluded.confidence >= coalesce(subscriptions.confidence, 0)
                    then excluded.source else subscriptions.source end,
      source_email_id = case when excluded.confidence >= coalesce(subscriptions.confidence, 0)
                             then excluded.source_email_id else subscriptions.source_email_id end,
      sender_email = coalesce(subscriptions.sender_email, excluded.sender_email),
      sender_domain = coalesce(subscriptions.sender_domain, excluded.sender_domain),
      email_used = coalesce(subscriptions.email_used, excluded.email_used),
      amount = coalesce(excluded.amount, subscriptions.amount),
      billing_cycle = coalesce(excluded.billing_cycle, subscriptions.billing_cycle),
      due_date = coalesce(excluded.due_date, subscriptions.due_date),
      currency = coalesce(excluded.currency, subscriptions.currency)
  `)

  const seen = new Set<string>()
  const write = getDb().transaction((records: DetectedSubscriptionRecord[]) => {
    for (const record of records) {
      statement.run({
        id: randomUUID(),
        userId,
        providerId: record.providerId,
        company: record.company,
        senderEmail: record.senderEmail,
        senderDomain: record.senderDomain,
        category: record.category,
        kind: record.kind ?? "paid",
        confidence: record.confidence,
        source: record.source,
        emailUsed: record.emailUsed,
        seenAt: record.seenAt,
        evidenceEmailId: record.evidenceEmailId,
        amount: record.amount ?? null,
        billingCycle: record.billing_cycle ?? null,
        dueDate: record.due_date ?? null,
        currency: record.currency ?? null,
      })
      seen.add(record.company)
    }
  })

  write(input.records)
  return seen.size
}

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

export function listAccounts(userId = LOCAL_USER_ID): LocalAccount[] {
  return getDb()
    .prepare(
      `
      select
        a.*,
        p.email as provider_email,
        e.subject as source_subject,
        e.from_address as source_from,
        e.snippet as source_snippet
      from accounts a
      left join providers p on p.id = a.provider_id
      left join emails e on e.id = a.source_email_id
      where a.user_id = ?
      order by
        case a.status
          when 'unknown' then 0
          when 'active' then 1
          when 'closed' then 2
          when 'ignore' then 3
          else 4
        end,
        a.confidence desc,
        coalesce(a.last_seen, a.first_seen) desc
    `
    )
    .all(userId) as LocalAccount[]
}

export function getAccountById(accountId: string, userId = LOCAL_USER_ID): LocalAccount | null {
  const row = getDb()
    .prepare(
      `
      select
        a.*,
        p.email as provider_email,
        e.subject as source_subject,
        e.from_address as source_from,
        e.snippet as source_snippet
      from accounts a
      left join providers p on p.id = a.provider_id
      left join emails e on e.id = a.source_email_id
      where a.id = ? and a.user_id = ?
    `
    )
    .get(accountId, userId) as LocalAccount | undefined

  return row ?? null
}

export function updateAccountStatus(input: { id: string; userId?: string; status: AccountStatus }) {
  getDb()
    .prepare("update accounts set status = ? where id = ? and user_id = ?")
    .run(input.status, input.id, input.userId ?? LOCAL_USER_ID)
}

export function upsertDetectedAccounts(input: {
  userId?: string
  records: DetectedAccountRecord[]
}) {
  const userId = input.userId ?? LOCAL_USER_ID
  if (input.records.length === 0) return 0

  const statement = getDb().prepare(`
    insert into accounts (
      id, user_id, provider_id, company, domain, email,
      status, confidence, source, first_seen, last_seen, source_email_id
    ) values (
      @id, @userId, @providerId, @company, @domain, @email,
      'unknown', @confidence, @source, @seenAt, @seenAt, @evidenceEmailId
    )
    on conflict(user_id, provider_id, company) do update set
      last_seen = max(coalesce(accounts.last_seen, excluded.last_seen), excluded.last_seen),
      first_seen = min(coalesce(accounts.first_seen, excluded.first_seen), excluded.first_seen),
      confidence = max(coalesce(accounts.confidence, 0), excluded.confidence),
      source = case when excluded.confidence >= coalesce(accounts.confidence, 0)
                    then excluded.source else accounts.source end,
      source_email_id = case when excluded.confidence >= coalesce(accounts.confidence, 0)
                             then excluded.source_email_id else accounts.source_email_id end,
      domain = coalesce(accounts.domain, excluded.domain),
      email = coalesce(accounts.email, excluded.email)
  `)

  const seen = new Set<string>()
  const write = getDb().transaction((records: DetectedAccountRecord[]) => {
    for (const record of records) {
      statement.run({
        id: randomUUID(),
        userId,
        providerId: record.providerId,
        company: record.company,
        domain: record.domain,
        email: record.email,
        confidence: record.confidence,
        source: record.source,
        seenAt: record.seenAt,
        evidenceEmailId: record.evidenceEmailId,
      })
      seen.add(record.company)
    }
  })

  write(input.records)
  return seen.size
}

/* ------------------------------------------------------------------ */
/* Sync runs                                                          */
/* ------------------------------------------------------------------ */

export function hasRunningSyncRun(providerId: string): boolean {
  reclaimStaleSyncRuns()
  const row = getDb()
    .prepare("select count(*) as count from sync_runs where provider_id = ? and status = 'running'")
    .get(providerId) as { count: number }
  return row.count > 0
}

export function createSyncRun(providerId: string): string {
  const id = randomUUID()
  getDb()
    .prepare(
      `
      insert into sync_runs (id, provider_id, status, started_at)
      values (?, ?, 'running', ?)
    `
    )
    .run(id, providerId, new Date().toISOString())
  return id
}

export function finishSyncRun(input: {
  id: string
  status: SyncRunStatus
  emailsSeen?: number
  emailsStored?: number
  subscriptionsDetected?: number
  accountsDetected?: number
  error?: string | null
}) {
  getDb()
    .prepare(
      `
      update sync_runs set
        status = @status,
        finished_at = @finishedAt,
        emails_seen = @emailsSeen,
        emails_stored = @emailsStored,
        subscriptions_detected = @subscriptionsDetected,
        accounts_detected = @accountsDetected,
        error = @error
      where id = @id
    `
    )
    .run({
      id: input.id,
      status: input.status,
      finishedAt: new Date().toISOString(),
      emailsSeen: input.emailsSeen ?? 0,
      emailsStored: input.emailsStored ?? 0,
      subscriptionsDetected: input.subscriptionsDetected ?? 0,
      accountsDetected: input.accountsDetected ?? 0,
      error: input.error ?? null,
    })
}

export function listSyncRuns(userId = LOCAL_USER_ID, limit = 50): LocalSyncRun[] {
  return getDb()
    .prepare(
      `
      select r.*, p.email as provider_email, p.display_name as provider_name
      from sync_runs r
      join providers p on p.id = r.provider_id
      where p.user_id = ?
      order by r.started_at desc
      limit ?
    `
    )
    .all(userId, limit) as LocalSyncRun[]
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

export function getSetting(key: string): string | null {
  const row = getDb().prepare("select value from settings where key = ?").get(key) as
    { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare(
      `
      insert into settings (key, value, updated_at) values (?, ?, ?)
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    `
    )
    .run(key, value, new Date().toISOString())
}

/* ------------------------------------------------------------------ */
/* AI settings (cloud-AI toggle + opt-in scopes)                      */
/* ------------------------------------------------------------------ */

export type AiScopeId = "inboxes" | "subscriptions" | "accounts" | "metadata" | "content"

export interface AiSettings {
  cloudAiEnabled: boolean
  scopes: Record<AiScopeId, boolean>
}

const AI_SETTINGS_KEY = "ai_settings"

export const DEFAULT_AI_SETTINGS: AiSettings = {
  // Opt-in: cloud AI defaults OFF (privacy contract). Content scope defaults OFF.
  cloudAiEnabled: false,
  scopes: {
    inboxes: true,
    subscriptions: true,
    accounts: true,
    metadata: true,
    content: false,
  },
}

export function getAiSettings(): AiSettings {
  const raw = getSetting(AI_SETTINGS_KEY)
  if (!raw) return DEFAULT_AI_SETTINGS
  const parsed = safeJsonParse<Partial<AiSettings>>(raw, {})
  return {
    cloudAiEnabled: parsed.cloudAiEnabled ?? DEFAULT_AI_SETTINGS.cloudAiEnabled,
    scopes: { ...DEFAULT_AI_SETTINGS.scopes, ...(parsed.scopes ?? {}) },
  }
}

export function setAiSettings(settings: AiSettings) {
  setSetting(AI_SETTINGS_KEY, JSON.stringify(settings))
}

export function getAccountNote(accountId: string): string {
  return getSetting(`account_note:${accountId}`) ?? ""
}

export function setAccountNote(accountId: string, note: string) {
  setSetting(`account_note:${accountId}`, note)
}

export function getProviderTag(providerId: string): ProviderTag | null {
  const raw = getSetting(`provider_tag:${providerId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ProviderTag
    if (!parsed?.purpose || !parsed?.source) return null
    return parsed
  } catch {
    return null
  }
}

export function setProviderTag(providerId: string, tag: ProviderTag) {
  setSetting(`provider_tag:${providerId}`, JSON.stringify(tag))
}

export function listProviderTags(providerIds: string[]): Record<string, ProviderTag> {
  const out: Record<string, ProviderTag> = {}
  for (const id of providerIds) {
    const tag = getProviderTag(id)
    if (tag) out[id] = tag
  }
  return out
}

export function getCompanyDisplayName(groupKey: string): string | null {
  return getSetting(`company_display:${groupKey}`)
}

export function setCompanyDisplayName(groupKey: string, displayName: string) {
  setSetting(`company_display:${groupKey}`, displayName)
}

/* ------------------------------------------------------------------ */
/* Dashboard + reset                                                  */
/* ------------------------------------------------------------------ */

export function countEmailsSince(sinceIso: string, userId = LOCAL_USER_ID): number {
  return (
    getDb()
      .prepare(
        `
      select count(*) as count
      from emails e
      join providers p on p.id = e.provider_id
      where p.user_id = ? and coalesce(e.date, e.created_at) >= ?
    `
      )
      .get(userId, sinceIso) as { count: number }
  ).count
}

export function countEmailsByProvider(userId = LOCAL_USER_ID): Record<string, number> {
  const rows = getDb()
    .prepare(
      `
      select e.provider_id as provider_id, count(*) as count
      from emails e
      join providers p on p.id = e.provider_id
      where p.user_id = ?
      group by e.provider_id
    `
    )
    .all(userId) as Array<{ provider_id: string; count: number }>

  const map: Record<string, number> = {}
  for (const row of rows) map[row.provider_id] = row.count
  return map
}

export interface RecentEmail {
  from_address: string | null
  subject: string | null
  date: string | null
  snippet: string | null
  provider_email: string | null
}

export function listRecentEmails(limit = 25, userId = LOCAL_USER_ID): RecentEmail[] {
  return getDb()
    .prepare(
      `
      select e.from_address, e.subject, e.date, e.snippet, p.email as provider_email
      from emails e
      join providers p on p.id = e.provider_id
      where p.user_id = ?
      order by coalesce(e.date, e.created_at) desc
      limit ?
    `
    )
    .all(userId, limit) as RecentEmail[]
}

export function getDashboardStats(userId = LOCAL_USER_ID): DashboardStats {
  const providerCount = (
    getDb().prepare("select count(*) as count from providers where user_id = ?").get(userId) as {
      count: number
    }
  ).count

  const emailCount = (
    getDb()
      .prepare(
        `
      select count(*) as count
      from emails e
      join providers p on p.id = e.provider_id
      where p.user_id = ?
    `
      )
      .get(userId) as { count: number }
  ).count

  const subscriptionCount = (
    getDb()
      .prepare("select count(*) as count from subscriptions where user_id = ?")
      .get(userId) as { count: number }
  ).count

  const accountCount = (
    getDb().prepare("select count(*) as count from accounts where user_id = ?").get(userId) as {
      count: number
    }
  ).count

  const lastSync = getDb()
    .prepare("select max(last_sync_at) as last from providers where user_id = ?")
    .get(userId) as { last: string | null }

  const syncing =
    (
      getDb()
        .prepare("select count(*) as count from providers where user_id = ? and status = 'syncing'")
        .get(userId) as { count: number }
    ).count > 0

  const lastErrorRow = getDb()
    .prepare(
      `
      select error_message
      from providers
      where user_id = ? and status = 'error' and error_message is not null
      order by created_at desc
      limit 1
    `
    )
    .get(userId) as { error_message: string | null } | undefined

  return {
    providerCount,
    emailCount,
    subscriptionCount,
    accountCount,
    lastSyncAt: lastSync.last,
    syncing,
    lastError: lastErrorRow?.error_message ?? null,
  }
}

export function resetLocalData() {
  const database = getDb()
  const wipe = database.transaction(() => {
    database.prepare("delete from sync_runs").run()
    database.prepare("delete from overview_daily").run()
    database.prepare("delete from overview_stats").run()
    database.prepare("delete from email_clusters").run()
    database.prepare("delete from email_intelligence").run()
    database.prepare("delete from email_embeddings").run()
    try {
      database.prepare("delete from emails_fts").run()
    } catch {
      /* FTS table may not exist yet on very old DBs */
    }
    database.prepare("delete from subscriptions").run()
    database.prepare("delete from accounts").run()
    database.prepare("delete from emails").run()
    database.prepare("delete from google_accounts").run()
    database.prepare("delete from providers").run()
  })
  wipe()
}

/* ------------------------------------------------------------------ */
/* Migrations                                                         */
/* ------------------------------------------------------------------ */

function migrate(database: Database.Database) {
  database.exec(`
    create table if not exists providers (
      id text primary key,
      user_id text not null,
      type text not null check (type in ('imap', 'gmail', 'outlook')),
      email text not null,
      username text,
      display_name text not null,
      host text,
      port integer,
      tls integer,
      encrypted_password text,
      status text not null default 'pending' check (status in ('active', 'error', 'syncing', 'pending')),
      last_sync_at text,
      error_message text,
      created_at text not null default current_timestamp
    );

    create table if not exists emails (
      id text primary key,
      provider_id text not null references providers(id) on delete cascade,
      uid integer not null,
      gmail_message_id text,
      thread_id text,
      message_id text,
      from_address text,
      to_address text,
      subject text,
      date text,
      body_text text,
      snippet text,
      labels text not null default '[]',
      headers text not null default '{}',
      attachments text not null default '[]',
      folder text,
      created_at text not null default current_timestamp,
      unique (provider_id, uid)
    );

    create table if not exists subscriptions (
      id text primary key,
      user_id text not null,
      provider_id text references providers(id) on delete set null,
      company text not null,
      sender_email text,
      sender_domain text,
      category text,
      confidence real,
      source text,
      amount real,
      currency text,
      billing_cycle text,
      due_date text,
      kind text not null default 'paid' check (kind in ('paid', 'mailing_list')),
      status text not null default 'unknown' check (status in ('active', 'cancelled', 'unknown', 'ignored')),
      email_used text,
      first_seen text,
      last_seen text,
      source_email_id text references emails(id) on delete set null
    );

    create table if not exists accounts (
      id text primary key,
      user_id text not null,
      provider_id text references providers(id) on delete set null,
      company text not null,
      domain text,
      email text,
      status text not null default 'unknown' check (status in ('active', 'closed', 'unknown', 'ignore')),
      confidence real,
      source text,
      first_seen text,
      last_seen text,
      source_email_id text references emails(id) on delete set null
    );

    create table if not exists google_accounts (
      provider_id text primary key references providers(id) on delete cascade,
      google_account_id text,
      email text not null,
      scope text not null,
      encrypted_access_token text not null,
      encrypted_refresh_token text,
      expires_at text,
      updated_at text not null default current_timestamp
    );

    create table if not exists sync_runs (
      id text primary key,
      provider_id text not null references providers(id) on delete cascade,
      status text not null default 'running' check (status in ('running', 'success', 'error')),
      started_at text not null default current_timestamp,
      finished_at text,
      emails_seen integer not null default 0,
      emails_stored integer not null default 0,
      subscriptions_detected integer not null default 0,
      accounts_detected integer not null default 0,
      error text
    );

    create table if not exists settings (
      key text primary key,
      value text,
      updated_at text not null default current_timestamp
    );

    create table if not exists email_embeddings (
      email_id text primary key references emails(id) on delete cascade,
      model text not null,
      dims integer not null,
      vector blob not null,
      updated_at text not null default current_timestamp
    );

    create table if not exists email_intelligence (
      email_id text primary key references emails(id) on delete cascade,
      intent text not null,
      intent_confidence real not null default 0,
      uncertain integer not null default 0,
      cluster_id text,
      vendor text,
      amount real,
      currency text,
      billing_cycle text,
      due_date text,
      extract_confidence real,
      extract_source text,
      reasons text not null default '[]',
      updated_at text not null default current_timestamp
    );

    create table if not exists email_clusters (
      id text primary key,
      intent text not null,
      label text not null,
      size integer not null default 1,
      representative_id text,
      member_ids text not null default '[]',
      sender text,
      centroid blob,
      updated_at text not null default current_timestamp
    );
  `)

  ensureColumns(database, "providers", [
    ["username", "text"],
    ["history_page_token", "text"],
    ["history_synced_count", "integer not null default 0"],
    ["history_complete", "integer not null default 0"],
    ["history_target", "integer not null default 2000"],
    ["gmail_history_id", "text"],
    ["newest_internal_date", "text"],
  ])

  ensureColumns(database, "emails", [
    ["gmail_message_id", "text"],
    ["thread_id", "text"],
    ["snippet", "text"],
    ["labels", "text not null default '[]'"],
    ["headers", "text not null default '{}'"],
  ])

  migrateSubscriptionsTable(database)
  migrateAccountsTable(database)
  migrateEmailIntelligence(database)
  migrateOverviewTables(database)

  ensureColumns(database, "subscriptions", [
    ["due_date", "text"],
    ["kind", "text not null default 'paid'"],
  ])
  // Backfill: newsletter category rows were mailing lists, not paid plans.
  database.exec(`
    update subscriptions
    set kind = 'mailing_list'
    where coalesce(kind, 'paid') = 'paid'
      and lower(coalesce(category, '')) = 'newsletter'
      and amount is null
  `)

  database.exec(`
    create unique index if not exists subscriptions_unique_company
      on subscriptions(user_id, provider_id, company);

    create unique index if not exists accounts_unique_company
      on accounts(user_id, provider_id, company);

    create index if not exists email_intelligence_intent_idx
      on email_intelligence(intent);

    create index if not exists email_intelligence_cluster_idx
      on email_intelligence(cluster_id);

    create index if not exists emails_provider_date_idx
      on emails(provider_id, date);

    create index if not exists emails_provider_created_idx
      on emails(provider_id, created_at);

    create index if not exists providers_user_idx
      on providers(user_id);

    create index if not exists subscriptions_user_idx
      on subscriptions(user_id);

    create index if not exists accounts_user_idx
      on accounts(user_id);

    create index if not exists sync_runs_provider_started_idx
      on sync_runs(provider_id, started_at);
  `)

  database.exec(`
    drop index if exists emails_unique_gmail_message;
    create unique index if not exists emails_unique_gmail_message
      on emails(provider_id, gmail_message_id);
  `)
}

function migrateEmailIntelligence(database: Database.Database) {
  database.exec(`
    create table if not exists email_embeddings (
      email_id text primary key references emails(id) on delete cascade,
      model text not null,
      dims integer not null,
      vector blob not null,
      updated_at text not null default current_timestamp
    );

    create table if not exists email_intelligence (
      email_id text primary key references emails(id) on delete cascade,
      intent text not null,
      intent_confidence real not null default 0,
      uncertain integer not null default 0,
      cluster_id text,
      vendor text,
      amount real,
      currency text,
      billing_cycle text,
      due_date text,
      extract_confidence real,
      extract_source text,
      reasons text not null default '[]',
      updated_at text not null default current_timestamp
    );

    create table if not exists email_clusters (
      id text primary key,
      intent text not null,
      label text not null,
      size integer not null default 1,
      representative_id text,
      member_ids text not null default '[]',
      sender text,
      centroid blob,
      updated_at text not null default current_timestamp
    );
  `)

  ensureColumns(database, "email_clusters", [
    ["sender", "text"],
    ["centroid", "blob"],
  ])

  ensureColumns(database, "email_intelligence", [["content_fp", "text"]])

  database.exec(`
    create index if not exists email_intelligence_content_fp_idx
      on email_intelligence(content_fp);
  `)

  // FTS5 index for hybrid keyword search. content='' means we maintain it manually.
  const fts = database
    .prepare("select name from sqlite_master where type = 'table' and name = 'emails_fts'")
    .get() as { name: string } | undefined

  if (!fts) {
    database.exec(`
      create virtual table emails_fts using fts5(
        email_id UNINDEXED,
        subject,
        snippet,
        from_address,
        body_text,
        tokenize = 'porter unicode61'
      );
    `)
  }
}

function migrateOverviewTables(database: Database.Database) {
  database.exec(`
    create table if not exists overview_stats (
      user_id text primary key,
      email_count integer not null default 0,
      embedded_count integer not null default 0,
      classified_count integer not null default 0,
      intent_counts_json text not null default '{}',
      money_event_count integer not null default 0,
      action_count integer not null default 0,
      cluster_count integer not null default 0,
      updated_at text not null default current_timestamp
    );

    create table if not exists overview_daily (
      user_id text not null,
      day text not null,
      intent_counts_json text not null default '{}',
      money_sum real not null default 0,
      money_event_count integer not null default 0,
      action_count integer not null default 0,
      email_count integer not null default 0,
      updated_at text not null default current_timestamp,
      primary key (user_id, day)
    );
  `)
}

function ensureColumns(
  database: Database.Database,
  table: string,
  columns: Array<[string, string]>
) {
  const existing = database.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>
  for (const [name, definition] of columns) {
    if (!existing.some((column) => column.name === name)) {
      database.exec(`alter table ${table} add column ${name} ${definition}`)
    }
  }
}

// Older local databases had subscription rows without detection metadata and
// with a narrower status CHECK constraint. Rebuild to the current shape.
function migrateSubscriptionsTable(database: Database.Database) {
  const columns = database.prepare("pragma table_info(subscriptions)").all() as Array<{
    name: string
  }>
  const names = new Set(columns.map((column) => column.name))
  const schema = database
    .prepare("select sql from sqlite_master where type = 'table' and name = 'subscriptions'")
    .get() as { sql: string } | undefined

  const needsRebuild =
    !names.has("sender_email") ||
    !names.has("sender_domain") ||
    !names.has("category") ||
    !names.has("confidence") ||
    !names.has("source") ||
    !names.has("source_email_id") ||
    !schema?.sql.includes("'ignored'")

  if (!needsRebuild) return

  const valueExpr = (column: string, fallback = "null") => (names.has(column) ? column : fallback)
  const statusExpr = names.has("status")
    ? "case status when 'active' then 'active' when 'cancelled' then 'cancelled' when 'ignored' then 'ignored' else 'unknown' end"
    : "'unknown'"

  const rebuild = database.transaction(() => {
    database.exec(`
      drop index if exists subscriptions_unique_company;

      create table subscriptions_next (
        id text primary key,
        user_id text not null,
        provider_id text references providers(id) on delete set null,
        company text not null,
        sender_email text,
        sender_domain text,
        category text,
        confidence real,
        source text,
        amount real,
        currency text,
        billing_cycle text,
        status text not null default 'unknown' check (status in ('active', 'cancelled', 'unknown', 'ignored')),
        email_used text,
        first_seen text,
        last_seen text,
        source_email_id text references emails(id) on delete set null
      );

      insert or ignore into subscriptions_next (
        id, user_id, provider_id, company, sender_email, sender_domain,
        category, confidence, source, amount, currency, billing_cycle, status,
        email_used, first_seen, last_seen, source_email_id
      )
      select
        id,
        user_id,
        ${valueExpr("provider_id")},
        company,
        ${valueExpr("sender_email")},
        ${valueExpr("sender_domain")},
        ${valueExpr("category")},
        ${valueExpr("confidence")},
        ${valueExpr("source")},
        ${valueExpr("amount")},
        ${valueExpr("currency")},
        ${valueExpr("billing_cycle")},
        ${statusExpr},
        ${valueExpr("email_used")},
        ${valueExpr("first_seen")},
        ${valueExpr("last_seen")},
        ${valueExpr("source_email_id")}
      from subscriptions;

      drop table subscriptions;
      alter table subscriptions_next rename to subscriptions;

      create unique index if not exists subscriptions_unique_company
        on subscriptions(user_id, provider_id, company);
    `)
  })

  rebuild()
}

// The original accounts table used a different shape (email_used, risk_score,
// status in active/inactive/unknown). Rebuild it into the current schema while
// preserving any existing rows.
function migrateAccountsTable(database: Database.Database) {
  const columns = database.prepare("pragma table_info(accounts)").all() as Array<{ name: string }>
  const names = new Set(columns.map((column) => column.name))
  const schema = database
    .prepare("select sql from sqlite_master where type = 'table' and name = 'accounts'")
    .get() as { sql: string } | undefined

  const needsRebuild =
    !names.has("provider_id") ||
    !names.has("domain") ||
    !names.has("email") ||
    !names.has("confidence") ||
    !names.has("source") ||
    !names.has("source_email_id") ||
    !schema?.sql.includes("'closed'")

  if (!needsRebuild) return

  const valueExpr = (column: string, fallback = "null") => (names.has(column) ? column : fallback)
  const emailExpr = names.has("email") ? "email" : valueExpr("email_used")
  const statusExpr = names.has("status")
    ? "case status when 'inactive' then 'closed' when 'closed' then 'closed' when 'ignore' then 'ignore' when 'active' then 'active' else 'unknown' end"
    : "'unknown'"

  const rebuild = database.transaction(() => {
    database.exec(`
      drop index if exists accounts_unique_company;

      create table accounts_next (
        id text primary key,
        user_id text not null,
        provider_id text references providers(id) on delete set null,
        company text not null,
        domain text,
        email text,
        status text not null default 'unknown' check (status in ('active', 'closed', 'unknown', 'ignore')),
        confidence real,
        source text,
        first_seen text,
        last_seen text,
        source_email_id text references emails(id) on delete set null
      );

      insert or ignore into accounts_next (
        id, user_id, provider_id, company, domain, email,
        status, confidence, source, first_seen, last_seen, source_email_id
      )
      select
        id,
        user_id,
        ${valueExpr("provider_id")},
        company,
        ${valueExpr("domain")},
        ${emailExpr},
        ${statusExpr},
        ${valueExpr("confidence")},
        ${valueExpr("source")},
        ${valueExpr("first_seen")},
        ${valueExpr("last_seen")},
        ${valueExpr("source_email_id")}
      from accounts;

      drop table accounts;
      alter table accounts_next rename to accounts;

      create unique index if not exists accounts_unique_company
        on accounts(user_id, provider_id, company);
    `)
  })

  rebuild()
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeProvider(
  provider: Omit<
    LocalProvider,
    | "tls"
    | "history_complete"
    | "history_synced_count"
    | "history_target"
    | "history_page_token"
    | "gmail_history_id"
    | "newest_internal_date"
  > & {
    tls: number | boolean | null
    history_page_token?: string | null
    history_synced_count?: number | null
    history_complete?: number | boolean | null
    history_target?: number | null
    gmail_history_id?: string | null
    newest_internal_date?: string | null
  }
): LocalProvider {
  return {
    ...provider,
    tls: provider.tls == null ? null : Boolean(provider.tls),
    history_page_token: provider.history_page_token ?? null,
    history_synced_count: provider.history_synced_count ?? 0,
    history_complete: Boolean(provider.history_complete),
    history_target: provider.history_target ?? 2000,
    gmail_history_id: provider.gmail_history_id ?? null,
    newest_internal_date: provider.newest_internal_date ?? null,
  }
}

function numericIdFromString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
