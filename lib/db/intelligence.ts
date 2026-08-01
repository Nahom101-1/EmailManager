/**
 * Persistence for email embeddings, intents, clusters, extracts, FTS, and overview rollups.
 */

import { getDb, getLocalUserId } from "@/lib/db/local"
import { bufferToVector, vectorToBuffer } from "@/lib/ai/embeddings"
import type { EmailIntent } from "@/lib/ai/intent"
import type { ExtractedFields } from "@/lib/ai/extract"
import type { EmailCluster } from "@/lib/ai/cluster"

export interface EmailForIntelligence {
  id: string
  provider_id: string
  from_address: string | null
  subject: string | null
  snippet: string | null
  body_text: string | null
  date: string | null
  labels: string
  headers: string
  gmail_message_id: string | null
}

export interface StoredIntelligence {
  email_id: string
  intent: EmailIntent
  intent_confidence: number
  uncertain: number
  cluster_id: string | null
  vendor: string | null
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  due_date: string | null
  extract_confidence: number | null
  extract_source: string | null
  reasons: string
  updated_at: string
}

/** Emails missing embeddings or intelligence rows, newest first. */
export function listEmailsNeedingIntelligence(
  providerId: string,
  limit = 300
): EmailForIntelligence[] {
  return getDb()
    .prepare(
      `
      select e.id, e.provider_id, e.from_address, e.subject, e.snippet, e.body_text,
             e.date, e.labels, e.headers, e.gmail_message_id
      from emails e
      left join email_embeddings emb on emb.email_id = e.id
      left join email_intelligence i on i.email_id = e.id
      where e.provider_id = ? and (emb.email_id is null or i.email_id is null)
      order by coalesce(e.date, e.created_at) desc
      limit ?
    `
    )
    .all(providerId, limit) as EmailForIntelligence[]
}

export function countEmailsNeedingIntelligence(providerId: string): number {
  return (
    getDb()
      .prepare(
        `
      select count(*) as count
      from emails e
      left join email_embeddings emb on emb.email_id = e.id
      left join email_intelligence i on i.email_id = e.id
      where e.provider_id = ? and (emb.email_id is null or i.email_id is null)
    `
      )
      .get(providerId) as { count: number }
  ).count
}

/** @deprecated use listEmailsNeedingIntelligence */
export function listEmailsNeedingEmbed(providerId: string, emailIds?: string[]): EmailForIntelligence[] {
  if (emailIds && emailIds.length > 0) {
    const placeholders = emailIds.map(() => "?").join(",")
    return getDb()
      .prepare(
        `
        select e.id, e.provider_id, e.from_address, e.subject, e.snippet, e.body_text,
               e.date, e.labels, e.headers, e.gmail_message_id
        from emails e
        left join email_embeddings emb on emb.email_id = e.id
        where e.provider_id = ? and e.id in (${placeholders}) and emb.email_id is null
      `
      )
      .all(providerId, ...emailIds) as EmailForIntelligence[]
  }
  return listEmailsNeedingIntelligence(providerId, 300)
}

export function listEmailsByIds(ids: string[]): EmailForIntelligence[] {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => "?").join(",")
  return getDb()
    .prepare(
      `
      select id, provider_id, from_address, subject, snippet, body_text,
             date, labels, headers, gmail_message_id
      from emails
      where id in (${placeholders})
    `
    )
    .all(...ids) as EmailForIntelligence[]
}

export function upsertEmailEmbedding(input: {
  emailId: string
  model: string
  dims: number
  vector: Float32Array
}) {
  getDb()
    .prepare(
      `
      insert into email_embeddings (email_id, model, dims, vector, updated_at)
      values (?, ?, ?, ?, ?)
      on conflict(email_id) do update set
        model = excluded.model,
        dims = excluded.dims,
        vector = excluded.vector,
        updated_at = excluded.updated_at
    `
    )
    .run(
      input.emailId,
      input.model,
      input.dims,
      vectorToBuffer(input.vector),
      new Date().toISOString()
    )
}

export function upsertEmailEmbeddingsBatch(
  items: Array<{ emailId: string; model: string; dims: number; vector: Float32Array }>
) {
  if (items.length === 0) return
  const stmt = getDb().prepare(
    `
    insert into email_embeddings (email_id, model, dims, vector, updated_at)
    values (?, ?, ?, ?, ?)
    on conflict(email_id) do update set
      model = excluded.model,
      dims = excluded.dims,
      vector = excluded.vector,
      updated_at = excluded.updated_at
  `
  )
  const now = new Date().toISOString()
  const tx = getDb().transaction((rows: typeof items) => {
    for (const item of rows) {
      stmt.run(item.emailId, item.model, item.dims, vectorToBuffer(item.vector), now)
    }
  })
  tx(items)
}

export function getEmailEmbedding(emailId: string): {
  model: string
  dims: number
  vector: Float32Array
} | null {
  const row = getDb()
    .prepare("select model, dims, vector from email_embeddings where email_id = ?")
    .get(emailId) as { model: string; dims: number; vector: Buffer } | undefined
  if (!row) return null
  return { model: row.model, dims: row.dims, vector: bufferToVector(row.vector) }
}

export function listAllEmbeddings(userId = getLocalUserId()): Array<{
  email_id: string
  model: string
  dims: number
  vector: Float32Array
  from_address: string | null
  subject: string | null
  snippet: string | null
  date: string | null
  intent: EmailIntent | null
}> {
  const rows = getDb()
    .prepare(
      `
      select emb.email_id, emb.model, emb.dims, emb.vector,
             e.from_address, e.subject, e.snippet, e.date,
             i.intent
      from email_embeddings emb
      join emails e on e.id = emb.email_id
      join providers p on p.id = e.provider_id
      left join email_intelligence i on i.email_id = e.id
      where p.user_id = ?
    `
    )
    .all(userId) as Array<{
    email_id: string
    model: string
    dims: number
    vector: Buffer
    from_address: string | null
    subject: string | null
    snippet: string | null
    date: string | null
    intent: EmailIntent | null
  }>

  return rows.map((r) => ({
    email_id: r.email_id,
    model: r.model,
    dims: r.dims,
    vector: bufferToVector(r.vector),
    from_address: r.from_address,
    subject: r.subject,
    snippet: r.snippet,
    date: r.date,
    intent: r.intent,
  }))
}

export function upsertEmailIntelligence(input: {
  emailId: string
  intent: EmailIntent
  intentConfidence: number
  uncertain: boolean
  clusterId?: string | null
  extract?: ExtractedFields | null
  reasons: string[]
}) {
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `
      insert into email_intelligence (
        email_id, intent, intent_confidence, uncertain, cluster_id,
        vendor, amount, currency, billing_cycle, due_date,
        extract_confidence, extract_source, reasons, updated_at
      ) values (
        @emailId, @intent, @intentConfidence, @uncertain, @clusterId,
        @vendor, @amount, @currency, @billingCycle, @dueDate,
        @extractConfidence, @extractSource, @reasons, @updatedAt
      )
      on conflict(email_id) do update set
        intent = excluded.intent,
        intent_confidence = excluded.intent_confidence,
        uncertain = excluded.uncertain,
        cluster_id = coalesce(excluded.cluster_id, email_intelligence.cluster_id),
        vendor = coalesce(excluded.vendor, email_intelligence.vendor),
        amount = coalesce(excluded.amount, email_intelligence.amount),
        currency = coalesce(excluded.currency, email_intelligence.currency),
        billing_cycle = coalesce(excluded.billing_cycle, email_intelligence.billing_cycle),
        due_date = coalesce(excluded.due_date, email_intelligence.due_date),
        extract_confidence = coalesce(excluded.extract_confidence, email_intelligence.extract_confidence),
        extract_source = coalesce(excluded.extract_source, email_intelligence.extract_source),
        reasons = excluded.reasons,
        updated_at = excluded.updated_at
    `
    )
    .run({
      emailId: input.emailId,
      intent: input.intent,
      intentConfidence: input.intentConfidence,
      uncertain: input.uncertain ? 1 : 0,
      clusterId: input.clusterId ?? null,
      vendor: input.extract?.vendor ?? null,
      amount: input.extract?.amount ?? null,
      currency: input.extract?.currency ?? null,
      billingCycle: input.extract?.billingCycle ?? null,
      dueDate: input.extract?.dueDate ?? null,
      extractConfidence: input.extract?.confidence ?? null,
      extractSource: input.extract?.source ?? null,
      reasons: JSON.stringify(input.reasons),
      updatedAt: now,
    })
}

export function updateEmailClusterIds(assignments: Array<{ emailId: string; clusterId: string }>) {
  if (assignments.length === 0) return
  const stmt = getDb().prepare(
    "update email_intelligence set cluster_id = ?, updated_at = ? where email_id = ?"
  )
  const now = new Date().toISOString()
  const tx = getDb().transaction((items: typeof assignments) => {
    for (const item of items) {
      stmt.run(item.clusterId, now, item.emailId)
    }
  })
  tx(assignments)
}

export function replaceClusters(
  clusters: Array<EmailCluster & { sender?: string; centroid?: Float32Array | null }>
) {
  const db = getDb()
  const clear = db.prepare("delete from email_clusters")
  const insert = db.prepare(
    `
    insert into email_clusters (id, intent, label, size, representative_id, member_ids, sender, centroid, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  )
  const now = new Date().toISOString()
  db.transaction(() => {
    clear.run()
    for (const c of clusters) {
      insert.run(
        c.id,
        c.intent,
        c.label,
        c.size,
        c.representativeId,
        JSON.stringify(c.memberIds),
        c.sender ?? null,
        c.centroid ? vectorToBuffer(c.centroid) : null,
        now
      )
    }
  })()
}

export function loadMutableClusters(): Array<{
  id: string
  intent: EmailIntent
  sender: string
  centroid: Float32Array
  memberIds: string[]
  representativeId: string
  label: string
}> {
  const rows = getDb()
    .prepare(
      `
      select id, intent, label, size, representative_id, member_ids, sender, centroid
      from email_clusters
    `
    )
    .all() as Array<{
    id: string
    intent: EmailIntent
    label: string
    size: number
    representative_id: string
    member_ids: string
    sender: string | null
    centroid: Buffer | null
  }>

  return rows
    .filter((r) => r.centroid)
    .map((r) => ({
      id: r.id,
      intent: r.intent,
      sender: r.sender ?? "unknown",
      centroid: bufferToVector(r.centroid!),
      memberIds: safeJson(r.member_ids, [] as string[]),
      representativeId: r.representative_id,
      label: r.label,
    }))
}

export function listClusters(limit = 40): EmailCluster[] {
  const rows = getDb()
    .prepare(
      `
      select id, intent, label, size, representative_id, member_ids
      from email_clusters
      order by size desc, updated_at desc
      limit ?
    `
    )
    .all(limit) as Array<{
    id: string
    intent: EmailIntent
    label: string
    size: number
    representative_id: string
    member_ids: string
  }>

  return rows.map((r) => ({
    id: r.id,
    intent: r.intent,
    label: r.label,
    size: r.size,
    representativeId: r.representative_id,
    memberIds: safeJson(r.member_ids, [] as string[]),
  }))
}

export function getCluster(clusterId: string): EmailCluster | null {
  const row = getDb()
    .prepare(
      `
      select id, intent, label, size, representative_id, member_ids
      from email_clusters where id = ?
    `
    )
    .get(clusterId) as
    | {
        id: string
        intent: EmailIntent
        label: string
        size: number
        representative_id: string
        member_ids: string
      }
    | undefined

  if (!row) return null
  return {
    id: row.id,
    intent: row.intent,
    label: row.label,
    size: row.size,
    representativeId: row.representative_id,
    memberIds: safeJson(row.member_ids, [] as string[]),
  }
}

export function listIntelligenceByIntent(
  intent: EmailIntent,
  limit = 20,
  userId = getLocalUserId()
): Array<StoredIntelligence & { subject: string | null; from_address: string | null; date: string | null }> {
  return getDb()
    .prepare(
      `
      select i.*, e.subject, e.from_address, e.date
      from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ? and i.intent = ?
      order by coalesce(e.date, e.created_at) desc
      limit ?
    `
    )
    .all(userId, intent, limit) as Array<
    StoredIntelligence & { subject: string | null; from_address: string | null; date: string | null }
  >
}

export function getIntelligence(emailId: string): StoredIntelligence | null {
  return (
    (getDb()
      .prepare("select * from email_intelligence where email_id = ?")
      .get(emailId) as StoredIntelligence | undefined) ?? null
  )
}

export function updateEmailBodyText(emailId: string, bodyText: string) {
  getDb().prepare("update emails set body_text = ? where id = ?").run(bodyText, emailId)
}

export function upsertEmailFts(input: {
  emailId: string
  subject?: string | null
  snippet?: string | null
  fromAddress?: string | null
  bodyText?: string | null
}) {
  const db = getDb()
  db.prepare("delete from emails_fts where email_id = ?").run(input.emailId)
  db.prepare(
    `
    insert into emails_fts (email_id, subject, snippet, from_address, body_text)
    values (?, ?, ?, ?, ?)
  `
  ).run(
    input.emailId,
    input.subject ?? "",
    input.snippet ?? "",
    input.fromAddress ?? "",
    input.bodyText ?? ""
  )
}

export function ftsSearchEmails(
  query: string,
  limit = 20,
  userId = getLocalUserId()
): Array<{
  email_id: string
  subject: string | null
  snippet: string | null
  from_address: string | null
  date: string | null
  rank: number
}> {
  const cleaned = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, "")}"`)
    .join(" OR ")

  if (!cleaned) return []

  try {
    return getDb()
      .prepare(
        `
        select e.id as email_id, e.subject, e.snippet, e.from_address, e.date,
               bm25(emails_fts) as rank
        from emails_fts
        join emails e on e.id = emails_fts.email_id
        join providers p on p.id = e.provider_id
        where p.user_id = ? and emails_fts match ?
        order by rank
        limit ?
      `
      )
      .all(userId, cleaned, limit) as Array<{
      email_id: string
      subject: string | null
      snippet: string | null
      from_address: string | null
      date: string | null
      rank: number
    }>
  } catch {
    return []
  }
}

export function getDailyDigestRows(
  sinceIso: string,
  userId = getLocalUserId(),
  limit = 80
) {
  return getDb()
    .prepare(
      `
      select i.intent, i.uncertain, i.vendor, i.amount, i.currency, i.billing_cycle,
             i.due_date, i.cluster_id, i.intent_confidence,
             e.id as email_id, e.subject, e.from_address, e.date, e.snippet
      from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ? and coalesce(e.date, e.created_at) >= ?
      order by
        case i.intent
          when 'security' then 0
          when 'action_required' then 1
          when 'needs_reply' then 2
          when 'renewal' then 3
          when 'trial' then 4
          when 'receipt' then 5
          else 6
        end,
        i.intent_confidence desc
      limit ?
    `
    )
    .all(userId, sinceIso, limit) as Array<{
    intent: EmailIntent
    uncertain: number
    vendor: string | null
    amount: number | null
    currency: string | null
    billing_cycle: string | null
    due_date: string | null
    cluster_id: string | null
    intent_confidence: number
    email_id: string
    subject: string | null
    from_address: string | null
    date: string | null
    snippet: string | null
  }>
}

export function searchSubscriptionsAccounts(
  query: string,
  userId = getLocalUserId(),
  limit = 12
): Array<{ kind: "subscription" | "account"; id: string; title: string; meta: string }> {
  const like = `%${query.replace(/[%_]/g, "")}%`
  const subs = getDb()
    .prepare(
      `
      select id, company, category, status from subscriptions
      where user_id = ? and (company like ? or sender_domain like ? or category like ?)
      order by confidence desc limit ?
    `
    )
    .all(userId, like, like, like, limit) as Array<{
    id: string
    company: string
    category: string | null
    status: string
  }>

  const accts = getDb()
    .prepare(
      `
      select id, company, domain, status from accounts
      where user_id = ? and (company like ? or domain like ? or email like ?)
      order by confidence desc limit ?
    `
    )
    .all(userId, like, like, like, limit) as Array<{
    id: string
    company: string
    domain: string | null
    status: string
  }>

  return [
    ...subs.map((s) => ({
      kind: "subscription" as const,
      id: s.id,
      title: s.company,
      meta: `${s.category ?? "subscription"} · ${s.status}`,
    })),
    ...accts.map((a) => ({
      kind: "account" as const,
      id: a.id,
      title: a.company,
      meta: `${a.domain ?? "account"} · ${a.status}`,
    })),
  ].slice(0, limit)
}

export interface OverviewStats {
  user_id: string
  email_count: number
  embedded_count: number
  classified_count: number
  intent_counts: Record<string, number>
  money_event_count: number
  action_count: number
  cluster_count: number
  updated_at: string
}

export interface OverviewDailyRow {
  day: string
  intent_counts: Record<string, number>
  money_sum: number
  money_event_count: number
  action_count: number
  email_count: number
}

const ACTION_INTENTS = new Set([
  "security",
  "action_required",
  "needs_reply",
  "renewal",
  "trial",
])

export function refreshOverviewRollups(userId = getLocalUserId()): OverviewStats {
  const db = getDb()
  const emailCount = (
    db
      .prepare(
        `
      select count(*) as count from emails e
      join providers p on p.id = e.provider_id where p.user_id = ?
    `
      )
      .get(userId) as { count: number }
  ).count

  const embeddedCount = (
    db
      .prepare(
        `
      select count(*) as count from email_embeddings emb
      join emails e on e.id = emb.email_id
      join providers p on p.id = e.provider_id where p.user_id = ?
    `
      )
      .get(userId) as { count: number }
  ).count

  const classifiedCount = (
    db
      .prepare(
        `
      select count(*) as count from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id where p.user_id = ?
    `
      )
      .get(userId) as { count: number }
  ).count

  const intentRows = db
    .prepare(
      `
      select i.intent, count(*) as count
      from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ?
      group by i.intent
    `
    )
    .all(userId) as Array<{ intent: string; count: number }>

  const intentCounts: Record<string, number> = {}
  for (const row of intentRows) intentCounts[row.intent] = row.count

  const moneyEventCount = (
    db
      .prepare(
        `
      select count(*) as count from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ? and i.amount is not null
    `
      )
      .get(userId) as { count: number }
  ).count

  const actionCount = (
    db
      .prepare(
        `
      select count(*) as count from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ?
        and (i.uncertain = 1 or i.intent in ('security','action_required','needs_reply','renewal','trial'))
    `
      )
      .get(userId) as { count: number }
  ).count

  const clusterCount = (
    db.prepare("select count(*) as count from email_clusters").get() as { count: number }
  ).count

  const now = new Date().toISOString()
  db.prepare(
    `
    insert into overview_stats (
      user_id, email_count, embedded_count, classified_count, intent_counts_json,
      money_event_count, action_count, cluster_count, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id) do update set
      email_count = excluded.email_count,
      embedded_count = excluded.embedded_count,
      classified_count = excluded.classified_count,
      intent_counts_json = excluded.intent_counts_json,
      money_event_count = excluded.money_event_count,
      action_count = excluded.action_count,
      cluster_count = excluded.cluster_count,
      updated_at = excluded.updated_at
  `
  ).run(
    userId,
    emailCount,
    embeddedCount,
    classifiedCount,
    JSON.stringify(intentCounts),
    moneyEventCount,
    actionCount,
    clusterCount,
    now
  )

  const dailyRows = db
    .prepare(
      `
      select substr(coalesce(e.date, e.created_at), 1, 10) as day,
             i.intent, i.amount, i.uncertain
      from email_intelligence i
      join emails e on e.id = i.email_id
      join providers p on p.id = e.provider_id
      where p.user_id = ?
        and coalesce(e.date, e.created_at) >= date('now', '-30 day')
    `
    )
    .all(userId) as Array<{
    day: string
    intent: string
    amount: number | null
    uncertain: number
  }>

  const byDay = new Map<
    string,
    {
      intent_counts: Record<string, number>
      money_sum: number
      money_event_count: number
      action_count: number
      email_count: number
    }
  >()

  for (const row of dailyRows) {
    if (!row.day) continue
    let bucket = byDay.get(row.day)
    if (!bucket) {
      bucket = {
        intent_counts: {},
        money_sum: 0,
        money_event_count: 0,
        action_count: 0,
        email_count: 0,
      }
      byDay.set(row.day, bucket)
    }
    bucket.email_count += 1
    bucket.intent_counts[row.intent] = (bucket.intent_counts[row.intent] ?? 0) + 1
    if (row.amount != null) {
      bucket.money_sum += row.amount
      bucket.money_event_count += 1
    }
    if (row.uncertain || ACTION_INTENTS.has(row.intent)) bucket.action_count += 1
  }

  const upsertDay = db.prepare(
    `
    insert into overview_daily (
      user_id, day, intent_counts_json, money_sum, money_event_count, action_count, email_count, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(user_id, day) do update set
      intent_counts_json = excluded.intent_counts_json,
      money_sum = excluded.money_sum,
      money_event_count = excluded.money_event_count,
      action_count = excluded.action_count,
      email_count = excluded.email_count,
      updated_at = excluded.updated_at
  `
  )

  db.transaction(() => {
    for (const [day, bucket] of byDay) {
      upsertDay.run(
        userId,
        day,
        JSON.stringify(bucket.intent_counts),
        bucket.money_sum,
        bucket.money_event_count,
        bucket.action_count,
        bucket.email_count,
        now
      )
    }
  })()

  return {
    user_id: userId,
    email_count: emailCount,
    embedded_count: embeddedCount,
    classified_count: classifiedCount,
    intent_counts: intentCounts,
    money_event_count: moneyEventCount,
    action_count: actionCount,
    cluster_count: clusterCount,
    updated_at: now,
  }
}

export function getOverviewStats(userId = getLocalUserId()): OverviewStats | null {
  const row = getDb()
    .prepare("select * from overview_stats where user_id = ?")
    .get(userId) as
    | {
        user_id: string
        email_count: number
        embedded_count: number
        classified_count: number
        intent_counts_json: string
        money_event_count: number
        action_count: number
        cluster_count: number
        updated_at: string
      }
    | undefined

  if (!row) return null
  return {
    user_id: row.user_id,
    email_count: row.email_count,
    embedded_count: row.embedded_count,
    classified_count: row.classified_count,
    intent_counts: safeJson(row.intent_counts_json, {} as Record<string, number>),
    money_event_count: row.money_event_count,
    action_count: row.action_count,
    cluster_count: row.cluster_count,
    updated_at: row.updated_at,
  }
}

export function listOverviewDaily(userId = getLocalUserId(), limit = 14): OverviewDailyRow[] {
  const rows = getDb()
    .prepare(
      `
      select day, intent_counts_json, money_sum, money_event_count, action_count, email_count
      from overview_daily
      where user_id = ?
      order by day desc
      limit ?
    `
    )
    .all(userId, limit) as Array<{
    day: string
    intent_counts_json: string
    money_sum: number
    money_event_count: number
    action_count: number
    email_count: number
  }>

  return rows.map((r) => ({
    day: r.day,
    intent_counts: safeJson(r.intent_counts_json, {} as Record<string, number>),
    money_sum: r.money_sum,
    money_event_count: r.money_event_count,
    action_count: r.action_count,
    email_count: r.email_count,
  }))
}

export function getClusterRebuildDebt(): number {
  const raw = getDb().prepare("select value from settings where key = ?").get("cluster_rebuild_debt") as
    | { value: string }
    | undefined
  return raw ? Number(raw.value) || 0 : 0
}

export function setClusterRebuildDebt(n: number) {
  getDb()
    .prepare(
      `
      insert into settings (key, value, updated_at) values (?, ?, ?)
      on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at
    `
    )
    .run("cluster_rebuild_debt", String(n), new Date().toISOString())
}

export interface UpcomingBill {
  emailId: string
  vendor: string | null
  amount: number | null
  currency: string | null
  billing_cycle: string | null
  due_date: string
  intent: string
}

export function getUpcomingBills(days = 30): UpcomingBill[] {
  const cutoff = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return getDb()
    .prepare(
      `SELECT email_id as emailId, vendor, amount, currency, billing_cycle, due_date, intent
       FROM email_intelligence
       WHERE intent IN ('renewal','receipt') AND due_date IS NOT NULL
         AND due_date >= ? AND due_date <= ?
       ORDER BY due_date ASC
       LIMIT 8`
    )
    .all(today, cutoff) as UpcomingBill[]
}

export interface EndingTrial {
  emailId: string
  vendor: string | null
  due_date: string
}

export function getEndingTrials(days = 14): EndingTrial[] {
  const cutoff = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return getDb()
    .prepare(
      `SELECT email_id as emailId, vendor, due_date
       FROM email_intelligence
       WHERE intent = 'trial' AND due_date IS NOT NULL
         AND due_date >= ? AND due_date <= ?
       ORDER BY due_date ASC
       LIMIT 6`
    )
    .all(today, cutoff) as EndingTrial[]
}

function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
