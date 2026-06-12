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
}

export interface GoogleTokenInput {
  providerId: string
  googleAccountId?: string
  email: string
  scope: string
  encryptedAccessToken: string
  encryptedRefreshToken?: string
  expiresAt?: string
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

export function listProviders(userId = LOCAL_USER_ID): LocalProvider[] {
  const providers = getDb()
    .prepare(`
      select *
      from providers
      where user_id = ?
      order by created_at desc
    `)
    .all(userId) as Array<Omit<LocalProvider, "tls"> & { tls: number | boolean | null }>

  return providers.map(normalizeProvider)
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
    .prepare(`
      insert into providers (
        id, user_id, type, email, username, display_name, host, port, tls,
        encrypted_password, status, last_sync_at, error_message, created_at
      ) values (
        @id, @user_id, @type, @email, @username, @display_name, @host, @port, @tls,
        @encrypted_password, @status, @last_sync_at, @error_message, @created_at
      )
    `)
    .run(provider)

  return normalizeProvider(provider)
}

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
    .prepare(`
      select p.*
      from providers p
      join google_accounts g on g.provider_id = p.id
      where p.user_id = ? and g.email = ?
      limit 1
    `)
    .get(userId, input.email) as (Omit<LocalProvider, "tls"> & { tls: number | boolean | null }) | undefined

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
      .prepare(`
        update providers
        set display_name = ?, status = 'active', error_message = null
        where id = ?
      `)
      .run(input.displayName ?? input.email, provider.id)
  }

  getDb()
    .prepare(`
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
    `)
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
      message_id text,
      from_address text,
      to_address text,
      subject text,
      date text,
      body_text text,
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
      amount real,
      currency text,
      billing_cycle text check (billing_cycle in ('monthly', 'yearly', 'weekly', 'quarterly', 'unknown')),
      status text not null default 'active' check (status in ('active', 'cancelled', 'unknown')),
      email_used text,
      first_seen text,
      last_seen text,
      source_email_id text references emails(id) on delete set null
    );

    create table if not exists accounts (
      id text primary key,
      user_id text not null,
      company text not null,
      email_used text,
      first_seen text,
      last_seen text,
      risk_score integer default 0 check (risk_score between 0 and 100),
      status text not null default 'active' check (status in ('active', 'inactive', 'unknown')),
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
  `)

  const columns = database.prepare("pragma table_info(providers)").all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === "username")) {
    database.exec("alter table providers add column username text")
  }
}

function normalizeProvider(provider: Omit<LocalProvider, "tls"> & { tls: number | boolean | null }): LocalProvider {
  return {
    ...provider,
    tls: provider.tls == null ? null : Boolean(provider.tls),
  }
}
