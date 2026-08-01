/**
 * Cross-inbox company grouping — keeps per-provider evidence rows,
 * surfaces a smart group layer for multi-email coordination.
 */

import {
  getCompanyDisplayName,
  getLocalUserId,
  listAccounts,
  listProviderTags,
  listProviders,
  listSubscriptions,
  type AccountStatus,
  type LocalAccount,
  type LocalSubscription,
  type ProviderPurpose,
  type ProviderTag,
  type SubscriptionStatus,
} from "@/lib/db/local"

export function normalizeCompanyKey(company: string, domain?: string | null): string {
  if (domain) {
    const parts = domain
      .toLowerCase()
      .replace(/^(mail|email|e|news|info|no-?reply|notifications?|updates?|account|billing)\./, "")
      .split(".")
      .filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2]
    if (parts.length === 1) return parts[0]
  }
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

export interface AccountGroupInstance {
  id: string
  providerId: string | null
  providerEmail: string | null
  email: string | null
  status: AccountStatus
  confidence: number | null
  domain: string | null
  firstSeen: string | null
  lastSeen: string | null
}

export interface SubscriptionGroupInstance {
  id: string
  providerId: string | null
  providerEmail: string | null
  emailUsed: string | null
  status: SubscriptionStatus
  confidence: number | null
  amount: number | null
  billingCycle: string | null
  dueDate: string | null
  category: string | null
  firstSeen: string | null
  lastSeen: string | null
}

export interface CompanyGroup<T> {
  key: string
  company: string
  domain: string | null
  inboxes: string[]
  instances: T[]
  tags: string[]
  purposeTags: ProviderPurpose[]
  status: string
  multiInbox: boolean
}

function pickCompanyName(names: string[], key: string): string {
  const override = getCompanyDisplayName(key)
  if (override) return override
  // Prefer the shortest non-empty name (often the cleaner vendor label).
  const sorted = [...names].filter(Boolean).sort((a, b) => a.length - b.length)
  return sorted[0] ?? key
}

function rollupAccountStatus(statuses: AccountStatus[]): AccountStatus {
  if (statuses.includes("active")) return "active"
  if (statuses.includes("unknown")) return "unknown"
  if (statuses.every((s) => s === "closed")) return "closed"
  if (statuses.every((s) => s === "ignore")) return "ignore"
  return "unknown"
}

function rollupSubStatus(statuses: SubscriptionStatus[]): SubscriptionStatus {
  if (statuses.includes("active")) return "active"
  if (statuses.includes("unknown")) return "unknown"
  if (statuses.every((s) => s === "cancelled")) return "cancelled"
  if (statuses.every((s) => s === "ignored")) return "ignored"
  return "unknown"
}

function purposeTagsForInboxes(
  inboxes: string[],
  providerByEmail: Map<string, string>,
  tags: Record<string, ProviderTag>
): ProviderPurpose[] {
  const purposes = new Set<ProviderPurpose>()
  for (const email of inboxes) {
    const providerId = providerByEmail.get(email.toLowerCase())
    if (!providerId) continue
    const tag = tags[providerId]
    if (tag) purposes.add(tag.purpose)
  }
  return Array.from(purposes)
}

export function listAccountGroups(userId = getLocalUserId()): CompanyGroup<AccountGroupInstance>[] {
  const accounts = listAccounts(userId)
  const providers = listProviders(userId)
  const tags = listProviderTags(providers.map((p) => p.id))
  const providerByEmail = new Map(providers.map((p) => [p.email.toLowerCase(), p.id]))

  const map = new Map<string, LocalAccount[]>()
  for (const a of accounts) {
    const key = normalizeCompanyKey(a.company, a.domain)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(a)
    map.set(key, list)
  }

  const groups: CompanyGroup<AccountGroupInstance>[] = []
  for (const [key, rows] of map) {
    const inboxes = Array.from(
      new Set(
        rows
          .map((r) => r.provider_email ?? r.email)
          .filter((e): e is string => Boolean(e))
      )
    )
    const multiInbox = inboxes.length > 1
    const purposeTags = purposeTagsForInboxes(inboxes, providerByEmail, tags)
    const tagsList = [
      ...(multiInbox ? ["multi-inbox"] : []),
      ...purposeTags.map((p) => p),
    ]
    groups.push({
      key,
      company: pickCompanyName(
        rows.map((r) => r.company),
        key
      ),
      domain: rows.find((r) => r.domain)?.domain ?? null,
      inboxes,
      instances: rows.map((r) => ({
        id: r.id,
        providerId: r.provider_id,
        providerEmail: r.provider_email,
        email: r.email,
        status: r.status,
        confidence: r.confidence,
        domain: r.domain,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
      })),
      tags: tagsList,
      purposeTags,
      status: rollupAccountStatus(rows.map((r) => r.status)),
      multiInbox,
    })
  }

  return groups.sort((a, b) => {
    if (a.multiInbox !== b.multiInbox) return a.multiInbox ? -1 : 1
    if (a.status === "unknown" && b.status !== "unknown") return -1
    if (b.status === "unknown" && a.status !== "unknown") return 1
    return a.company.localeCompare(b.company)
  })
}

export function listSubscriptionGroups(
  userId = getLocalUserId()
): CompanyGroup<SubscriptionGroupInstance>[] {
  const subs = listSubscriptions(userId)
  const providers = listProviders(userId)
  const tags = listProviderTags(providers.map((p) => p.id))
  const providerByEmail = new Map(providers.map((p) => [p.email.toLowerCase(), p.id]))

  const map = new Map<string, LocalSubscription[]>()
  for (const s of subs) {
    const key = normalizeCompanyKey(s.company, s.sender_domain)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }

  const groups: CompanyGroup<SubscriptionGroupInstance>[] = []
  for (const [key, rows] of map) {
    const inboxes = Array.from(
      new Set(
        rows
          .map((r) => r.provider_email ?? r.email_used)
          .filter((e): e is string => Boolean(e))
      )
    )
    const multiInbox = inboxes.length > 1
    const purposeTags = purposeTagsForInboxes(inboxes, providerByEmail, tags)
    const tagsList = [
      ...(multiInbox ? ["multi-inbox"] : []),
      ...purposeTags.map((p) => p),
    ]
    groups.push({
      key,
      company: pickCompanyName(
        rows.map((r) => r.company),
        key
      ),
      domain: rows.find((r) => r.sender_domain)?.sender_domain ?? null,
      inboxes,
      instances: rows.map((r) => ({
        id: r.id,
        providerId: r.provider_id,
        providerEmail: r.provider_email,
        emailUsed: r.email_used,
        status: r.status,
        confidence: r.confidence,
        amount: r.amount,
        billingCycle: r.billing_cycle,
        dueDate: r.due_date,
        category: r.category,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
      })),
      tags: tagsList,
      purposeTags,
      status: rollupSubStatus(rows.map((r) => r.status)),
      multiInbox,
    })
  }

  return groups.sort((a, b) => {
    if (a.multiInbox !== b.multiInbox) return a.multiInbox ? -1 : 1
    if (a.status === "unknown" && b.status !== "unknown") return -1
    if (b.status === "unknown" && a.status !== "unknown") return 1
    return a.company.localeCompare(b.company)
  })
}

export function findAccountSiblings(
  accountId: string,
  userId = getLocalUserId()
): AccountGroupInstance[] {
  const groups = listAccountGroups(userId)
  const group = groups.find((g) => g.instances.some((i) => i.id === accountId))
  if (!group) return []
  return group.instances.filter((i) => i.id !== accountId)
}

export function findSubscriptionSiblings(
  subscriptionId: string,
  userId = getLocalUserId()
): SubscriptionGroupInstance[] {
  const groups = listSubscriptionGroups(userId)
  const group = groups.find((g) => g.instances.some((i) => i.id === subscriptionId))
  if (!group) return []
  return group.instances.filter((i) => i.id !== subscriptionId)
}

export function inboxSummary(userId = getLocalUserId()) {
  const providers = listProviders(userId)
  const tags = listProviderTags(providers.map((p) => p.id))
  const accounts = listAccounts(userId)
  const subs = listSubscriptions(userId)
  const sharedAccountGroups = listAccountGroups(userId).filter((g) => g.multiInbox)
  const sharedSubscriptionGroups = listSubscriptionGroups(userId).filter((g) => g.multiInbox)

  return {
    inboxes: providers.map((p) => ({
      provider: p,
      tag: tags[p.id] ?? null,
      accountCount: accounts.filter((a) => a.provider_id === p.id).length,
      subscriptionCount: subs.filter((s) => s.provider_id === p.id).length,
      activeSubscriptionCount: subs.filter(
        (s) => s.provider_id === p.id && s.status === "active"
      ).length,
    })),
    sharedAccountGroups,
    sharedSubscriptionGroups,
  }
}
