// Heuristic, metadata-only detection of subscriptions and online accounts.
// We never read message bodies — only headers, subject and the Gmail snippet.

export type SubscriptionCategory =
  | "saas"
  | "streaming"
  | "finance"
  | "shopping"
  | "newsletter"
  | "utilities"
  | "education"
  | "other"

export interface DetectionInput {
  from?: string
  to?: string
  subject?: string
  snippet?: string
  labels?: string[]
  headers?: Record<string, string>
}

export interface SubscriptionSignal {
  company: string
  senderEmail: string | null
  senderDomain: string | null
  category: SubscriptionCategory
  confidence: number
  reasons: string[]
  amount: number | null
  billingCycle: "monthly" | "yearly" | null
}

export interface AccountSignal {
  company: string
  domain: string | null
  email: string | null
  confidence: number
  reasons: string[]
}

const SUBSCRIPTION_KEYWORDS: Array<{ word: string; weight: number; reason: string }> = [
  { word: "subscription", weight: 0.45, reason: "Mentions a subscription" },
  { word: "receipt", weight: 0.4, reason: "Looks like a receipt" },
  { word: "invoice", weight: 0.4, reason: "Looks like an invoice" },
  { word: "payment", weight: 0.35, reason: "Mentions a payment" },
  { word: "payment failed", weight: 0.5, reason: "Failed payment notice" },
  { word: "your order", weight: 0.3, reason: "Order confirmation" },
  { word: "renewal", weight: 0.45, reason: "Mentions a renewal" },
  { word: "renews", weight: 0.4, reason: "Mentions an auto-renewal" },
  { word: "trial", weight: 0.3, reason: "Mentions a trial" },
  { word: "membership", weight: 0.4, reason: "Mentions a membership" },
  { word: "billing", weight: 0.4, reason: "Mentions billing" },
  { word: "your plan", weight: 0.35, reason: "Mentions a plan" },
  { word: "auto-renew", weight: 0.45, reason: "Auto-renewal notice" },
]

const ACCOUNT_KEYWORDS: Array<{ word: string; weight: number; reason: string }> = [
  { word: "welcome", weight: 0.35, reason: "Welcome message" },
  { word: "verify your email", weight: 0.55, reason: "Email verification" },
  { word: "verify your account", weight: 0.55, reason: "Account verification" },
  { word: "confirm your account", weight: 0.5, reason: "Account confirmation" },
  { word: "confirm your email", weight: 0.5, reason: "Email confirmation" },
  { word: "password reset", weight: 0.5, reason: "Password reset" },
  { word: "reset your password", weight: 0.5, reason: "Password reset" },
  { word: "security alert", weight: 0.45, reason: "Security alert" },
  { word: "new sign-in", weight: 0.5, reason: "New sign-in notice" },
  { word: "new login", weight: 0.45, reason: "New login notice" },
  { word: "two-factor", weight: 0.45, reason: "Two-factor authentication" },
  { word: "verification code", weight: 0.45, reason: "Verification code" },
  { word: "account created", weight: 0.5, reason: "Account created" },
  { word: "confirm your subscription", weight: 0.3, reason: "Subscription confirmation" },
]

// Known vendors → nicer display name + category.
const KNOWN_VENDORS: Record<string, { name: string; category: SubscriptionCategory }> = {
  netflix: { name: "Netflix", category: "streaming" },
  spotify: { name: "Spotify", category: "streaming" },
  hulu: { name: "Hulu", category: "streaming" },
  disneyplus: { name: "Disney+", category: "streaming" },
  hbomax: { name: "Max", category: "streaming" },
  max: { name: "Max", category: "streaming" },
  youtube: { name: "YouTube", category: "streaming" },
  paramountplus: { name: "Paramount+", category: "streaming" },
  peacocktv: { name: "Peacock", category: "streaming" },
  twitch: { name: "Twitch", category: "streaming" },
  appletv: { name: "Apple TV+", category: "streaming" },
  github: { name: "GitHub", category: "saas" },
  figma: { name: "Figma", category: "saas" },
  notion: { name: "Notion", category: "saas" },
  slack: { name: "Slack", category: "saas" },
  zoom: { name: "Zoom", category: "saas" },
  adobe: { name: "Adobe", category: "saas" },
  dropbox: { name: "Dropbox", category: "saas" },
  atlassian: { name: "Atlassian", category: "saas" },
  openai: { name: "OpenAI", category: "saas" },
  anthropic: { name: "Anthropic", category: "saas" },
  vercel: { name: "Vercel", category: "saas" },
  linear: { name: "Linear", category: "saas" },
  asana: { name: "Asana", category: "saas" },
  cursor: { name: "Cursor", category: "saas" },
  loom: { name: "Loom", category: "saas" },
  canva: { name: "Canva", category: "saas" },
  miro: { name: "Miro", category: "saas" },
  airtable: { name: "Airtable", category: "saas" },
  monday: { name: "Monday.com", category: "saas" },
  todoist: { name: "Todoist", category: "saas" },
  grammarly: { name: "Grammarly", category: "saas" },
  lastpass: { name: "LastPass", category: "saas" },
  dashlane: { name: "Dashlane", category: "saas" },
  nordvpn: { name: "NordVPN", category: "saas" },
  expressvpn: { name: "ExpressVPN", category: "saas" },
  apple: { name: "Apple", category: "saas" },
  icloud: { name: "iCloud", category: "saas" },
  microsoft: { name: "Microsoft", category: "saas" },
  xbox: { name: "Xbox", category: "streaming" },
  heroku: { name: "Heroku", category: "saas" },
  digitalocean: { name: "DigitalOcean", category: "saas" },
  cloudflare: { name: "Cloudflare", category: "saas" },
  sentry: { name: "Sentry", category: "saas" },
  datadog: { name: "Datadog", category: "saas" },
  paypal: { name: "PayPal", category: "finance" },
  stripe: { name: "Stripe", category: "finance" },
  venmo: { name: "Venmo", category: "finance" },
  chase: { name: "Chase", category: "finance" },
  amex: { name: "American Express", category: "finance" },
  wise: { name: "Wise", category: "finance" },
  robinhood: { name: "Robinhood", category: "finance" },
  coinbase: { name: "Coinbase", category: "finance" },
  amazon: { name: "Amazon", category: "shopping" },
  ebay: { name: "eBay", category: "shopping" },
  etsy: { name: "Etsy", category: "shopping" },
  walmart: { name: "Walmart", category: "shopping" },
  target: { name: "Target", category: "shopping" },
  shopify: { name: "Shopify", category: "shopping" },
  instacart: { name: "Instacart", category: "shopping" },
  substack: { name: "Substack", category: "newsletter" },
  mailchimp: { name: "Mailchimp", category: "newsletter" },
  beehiiv: { name: "beehiiv", category: "newsletter" },
  medium: { name: "Medium", category: "newsletter" },
  nytimes: { name: "New York Times", category: "newsletter" },
  wsj: { name: "Wall Street Journal", category: "newsletter" },
  comcast: { name: "Comcast", category: "utilities" },
  xfinity: { name: "Xfinity", category: "utilities" },
  verizon: { name: "Verizon", category: "utilities" },
  att: { name: "AT&T", category: "utilities" },
  tmobile: { name: "T-Mobile", category: "utilities" },
  coursera: { name: "Coursera", category: "education" },
  udemy: { name: "Udemy", category: "education" },
  duolingo: { name: "Duolingo", category: "education" },
  masterclass: { name: "MasterClass", category: "education" },
  chegg: { name: "Chegg", category: "education" },
  skillshare: { name: "Skillshare", category: "education" },
  linkedin: { name: "LinkedIn", category: "saas" },
}

const CATEGORY_HINTS: Array<{ words: string[]; category: SubscriptionCategory }> = [
  { words: ["stream", "watch", "episode", "movie"], category: "streaming" },
  { words: ["bank", "card", "statement", "transaction"], category: "finance" },
  { words: ["order", "shipped", "delivery", "cart"], category: "shopping" },
  { words: ["newsletter", "digest", "weekly", "issue"], category: "newsletter" },
  { words: ["course", "lesson", "class", "enroll"], category: "education" },
  { words: ["bill", "usage", "meter", "utility"], category: "utilities" },
]

function clampConfidence(value: number) {
  return Math.max(0, Math.min(0.99, Math.round(value * 100) / 100))
}

export function parseAmount(text: string): { amount: number | null; billingCycle: "monthly" | "yearly" | null } {
  const patterns: Array<[RegExp, "monthly" | "yearly" | null]> = [
    [/\$\s*(\d+(?:\.\d{1,2})?)\s*\/\s*(?:mo(?:nth)?|monthly)/i, "monthly"],
    [/\$\s*(\d+(?:\.\d{1,2})?)\s+per\s+(?:mo(?:nth)?)/i, "monthly"],
    [/\$\s*(\d+(?:\.\d{1,2})?)\s*\/\s*(?:yr|year|annual(?:ly)?)/i, "yearly"],
    [/\$\s*(\d+(?:\.\d{1,2})?)\s+per\s+(?:yr|year)/i, "yearly"],
    [/charged\s+\$\s*(\d+(?:\.\d{1,2})?)\s+(monthly|annually|yearly)/i, null],
    [/\$\s*(\d+(?:\.\d{1,2})?)\s+(monthly|annually|yearly)/i, null],
    [/subscription[^$]{0,40}\$\s*(\d+(?:\.\d{1,2})?)/i, "monthly"],
    [/total[^$]{0,20}\$\s*(\d+(?:\.\d{1,2})?)/i, "monthly"],
  ]

  for (const [pattern, defaultCycle] of patterns) {
    const m = text.match(pattern)
    if (!m) continue
    const amount = parseFloat(m[1])
    if (isNaN(amount) || amount <= 0 || amount > 10000) continue
    let billingCycle: "monthly" | "yearly" | null = defaultCycle
    if (m[2]) {
      billingCycle = /year|annual|yr/.test(m[2].toLowerCase()) ? "yearly" : "monthly"
    }
    return { amount, billingCycle }
  }
  return { amount: null, billingCycle: null }
}

export function extractSenderEmail(from?: string): string | null {
  if (!from) return null
  const angle = from.match(/<([^>]+)>/)?.[1]
  if (angle) return angle.trim().toLowerCase()
  const bare = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  return bare ? bare.trim().toLowerCase() : null
}

export function extractDomain(email: string | null): string | null {
  if (!email) return null
  const domain = email.split("@")[1]
  if (!domain) return null
  return domain
    .replace(/^(mail|email|e|news|info|no-?reply|notifications?|updates?|account)\./, "")
    .toLowerCase()
}

function vendorKeyFromDomain(domain: string | null): string | null {
  if (!domain) return null
  // drop the TLD and any remaining subdomains: "billing.spotify.com" → "spotify"
  const parts = domain.split(".").filter(Boolean)
  if (parts.length === 0) return null
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  return core.replace(/[^a-z0-9]/g, "")
}

function displayNameFromSender(from: string | undefined, domain: string | null): string {
  const vendorKey = vendorKeyFromDomain(domain)
  if (vendorKey && KNOWN_VENDORS[vendorKey]) return KNOWN_VENDORS[vendorKey].name

  const displayPart = from?.split("<")[0].replace(/["']/g, "").trim()
  if (displayPart && !displayPart.includes("@")) return displayPart

  if (vendorKey) return vendorKey.charAt(0).toUpperCase() + vendorKey.slice(1)
  return "Unknown sender"
}

function categoryFor(domain: string | null, haystack: string): SubscriptionCategory {
  const vendorKey = vendorKeyFromDomain(domain)
  if (vendorKey && KNOWN_VENDORS[vendorKey]) return KNOWN_VENDORS[vendorKey].category

  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => haystack.includes(word))) return hint.category
  }
  return "other"
}

function hasUnsubscribeHeader(headers?: Record<string, string>): boolean {
  if (!headers) return false
  return Boolean(headers["List-Unsubscribe"] || headers["List-ID"] || headers["List-Id"])
}

export function detectSubscription(input: DetectionInput): SubscriptionSignal | null {
  const haystack = `${input.from ?? ""} ${input.subject ?? ""} ${input.snippet ?? ""}`.toLowerCase()
  const senderEmail = extractSenderEmail(input.from)
  const senderDomain = extractDomain(senderEmail)
  const vendorKey = vendorKeyFromDomain(senderDomain)

  let confidence = 0
  const reasons: string[] = []

  for (const keyword of SUBSCRIPTION_KEYWORDS) {
    if (haystack.includes(keyword.word)) {
      confidence += keyword.weight
      reasons.push(keyword.reason)
    }
  }

  if (hasUnsubscribeHeader(input.headers)) {
    confidence += 0.3
    reasons.push("Has a List-Unsubscribe header")
  }

  if (vendorKey && KNOWN_VENDORS[vendorKey]) {
    confidence += 0.3
    reasons.push(`Recognized vendor: ${KNOWN_VENDORS[vendorKey].name}`)
  }

  if (reasons.length === 0 || confidence < 0.3) return null

  const amountText = `${input.subject ?? ""} ${input.snippet ?? ""}`
  const { amount, billingCycle } = parseAmount(amountText)

  return {
    company: displayNameFromSender(input.from, senderDomain),
    senderEmail,
    senderDomain,
    category: categoryFor(senderDomain, haystack),
    confidence: clampConfidence(confidence),
    reasons: dedupe(reasons),
    amount,
    billingCycle,
  }
}

export function detectAccount(input: DetectionInput): AccountSignal | null {
  const haystack = `${input.from ?? ""} ${input.subject ?? ""} ${input.snippet ?? ""}`.toLowerCase()
  const senderEmail = extractSenderEmail(input.from)
  const senderDomain = extractDomain(senderEmail)

  let confidence = 0
  const reasons: string[] = []

  for (const keyword of ACCOUNT_KEYWORDS) {
    if (haystack.includes(keyword.word)) {
      confidence += keyword.weight
      reasons.push(keyword.reason)
    }
  }

  if (reasons.length === 0 || confidence < 0.35) return null

  return {
    company: displayNameFromSender(input.from, senderDomain),
    domain: senderDomain,
    email: input.to ?? null,
    confidence: clampConfidence(confidence),
    reasons: dedupe(reasons),
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values))
}
