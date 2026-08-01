// =============================================================================
// LifeOS — Data Contract (TypeScript)
// =============================================================================
// These types are the API contract for the LifeOS frontend. Every value the UI
// renders comes from one of these shapes. Your backend (Gmail API / IMAP →
// SQLite) should populate them; the prototype's `data.js` is a sample instance.
//
// Drop this in `src/lib/types.ts` (or `src/types/lifeos.ts`).
// =============================================================================

// ---- shared unions --------------------------------------------------------
export type Provider = "google" | "imap" | "outlook";

export type InboxStatus = "active" | "syncing" | "error" | "pending";

export type SubStatus = "active" | "needs-review" | "unknown" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export type AccountStatus = "active" | "inactive" | "unknown";
/** 1 = low, 2 = medium, 3 = high */
export type RiskScore = 1 | 2 | 3;

export type Relationship = "work" | "personal";

/** Evidence / detection signals attached to accounts and timeline items. */
export type Signal =
  | "receipt"
  | "login"
  | "newsletter"
  | "security"
  | "password-reset"
  | "trial"
  | "signup"
  | "statement";

// ---- inboxes --------------------------------------------------------------
export interface InboxError {
  code: string;          // e.g. "IMAP_LOGIN_FAILED"
  msg: string;           // human-readable cause
}

export interface Inbox {
  id: string;
  email: string;
  provider: Provider;
  connType: string;      // display label, e.g. "Google OAuth · Gmail API" / "IMAP · Domeneshop"
  status: InboxStatus;
  lastSync: string;      // relative, e.g. "2 min ago" / "Failed 3 hr ago"
  lastSyncTs: string;    // absolute, "YYYY-MM-DD HH:mm"
  messages: number;      // total messages in mailbox
  scanned: number;       // messages scanned so far
  readonly?: boolean;    // true for OAuth read-only scopes
  // IMAP-only:
  server?: string;
  port?: number;
  username?: string;
  error?: InboxError;    // present when status === "error"
}

// ---- subscriptions --------------------------------------------------------
export interface Subscription {
  id: string;
  company: string;
  mono: string;          // 1–2 char monogram for the tile
  color: string;         // brand hex, used at low alpha for the tile
  amount: number;
  currency: string;      // "$" (symbol)
  cycle: BillingCycle;
  email: string;         // which connected address this was billed to
  lastSeen: string;      // relative, e.g. "3 days ago"
  source: "receipt" | "invoice" | "trial";
  category: string;      // "Streaming", "Developer", …
  confidence: number;    // 0–100 detection confidence
  status: SubStatus;
  trial?: boolean;
  trialEnds?: string;    // relative, e.g. "in 2 days"
}

// ---- accounts -------------------------------------------------------------
export interface Account {
  id: string;
  service: string;
  mono: string;
  color: string;
  email: string;         // login email used
  first: string;         // first seen, "Mar 2017"
  last: string;          // last seen, "Yesterday"
  inbox: string;         // source inbox display name
  risk: RiskScore;
  status: AccountStatus;
  signals: Signal[];
}

/** Timeline row on the Account Detail page. */
export interface EvidenceItem {
  time: string;          // "Jun 11, 2026"
  title: string;
  desc: string;
  kind: Signal;
  inbox: string;
}

// ---- sync activity --------------------------------------------------------
export type ActivityKind = "ok" | "err" | "info";

export interface ActivityItem {
  id: string;
  time: string;          // "09:41"
  date: string;          // "Today" | "Yesterday" | "Jun 10"
  inbox: string;         // email address
  title: string;
  desc: string;
  kind: ActivityKind;
  accent?: boolean;      // highlight the timeline dot
}

/** The 6-step sync state machine the SyncModal animates through. */
export type SyncStep = "idle" | "token" | "fetch" | "store" | "detect" | "done" | "failed";

export interface SyncResult {
  newMsgs: number;
  newSubs: number;
  newAccts: number;
}

// ---- broader digital life -------------------------------------------------
export interface Person {
  id: string;
  name: string;
  rel: Relationship;
  role: string;          // "Your manager", "Brother", "Client · Acme"
  email: string;
  last: string;          // last contact, relative
  owed: boolean;         // true if the user owes a reply
  snippet: string;       // latest message preview
  unread: number;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  due: string;           // relative, "in 3 days" | "paid"
  dueHard: string;       // absolute, "Jun 15"
  status: "due" | "upcoming" | "paid";
  category: string;
  auto: boolean;         // autopay enabled
}

export interface Commitment {
  id: string;
  title: string;
  due: string;           // "Fri, Jun 13" | "Overdue · 3 weeks" | "No date"
  from: string;          // who/what it originated from
  kind: Relationship;
  done: boolean;
  overdue?: boolean;
}

export interface Logistic {
  id: string;
  title: string;
  desc: string;
  kind: "delivery" | "travel";
  when: string;
}

// ---- AI / assistant -------------------------------------------------------
export type InsightPriority = "now" | "wait" | "ignore";
/** Maps to status color tokens: warn | sync | idle | active. */
export type InsightTone = "warn" | "sync" | "idle" | "active";

export interface Insight {
  id: string;
  priority: InsightPriority;
  icon: string;          // icon key (see ICONS map)
  title: string;
  body: string;
  action: string | null; // CTA label; null = dismiss-only
  to: string | null;     // route to navigate to on action
  tone: InsightTone;
}

export interface BriefingItem {
  t: string;             // the task/line
  meta: string;          // context, e.g. "Work · waiting 2 days"
}

export interface Briefing {
  greeting: string;
  summary: string;       // 2–3 sentence morning summary (AI-generated)
  dealFirst: BriefingItem[];
  canWait: BriefingItem[];
  ignore: BriefingItem[];
}

export interface LifeStats {
  newSinceLast: number;
  needsReply: number;
  workShare: number;     // % of inbox
  personalShare: number;
  autoFiled: number;     // % auto-filed
  inboxLoad: "Light" | "Normal" | "Heavy";
}

/** Opt-in cloud-AI access scopes. Enforce these server-side when building
 *  the model context — only include data for scopes that are `on`. */
export interface AiScope {
  id: "work" | "personal" | "money" | "calendar" | "content";
  label: string;
  desc: string;
  on: boolean;
}

// ---- connect / providers --------------------------------------------------
export interface ImapPreset {
  id: "dome" | "gmail" | "custom";
  name: string;
  server: string;
  port: number;
  ssl: boolean;
  note: string;          // shown as an inline notice when selected
}

// ---- top-level dashboard summary -----------------------------------------
export interface Summary {
  accounts: number;        // connected inboxes
  scanned: number;         // total emails scanned
  subsFound: number;
  monthly: number;         // estimated monthly spend
  annual: number;
  lastSync: string;
  trialsSoon: number;
  accountsFound: number;   // online accounts discovered
  needsReview: number;
}

// ---- the full payload (what `window.DATA` holds in the prototype) ---------
export interface LifeOSData {
  inboxes: Inbox[];
  summary: Summary;
  subs: Subscription[];
  accounts: Account[];
  activity: ActivityItem[];
  queue: QueueItem[];
  evidence: EvidenceItem[];
  providers: ImapPreset[];
  // broader life:
  people: Person[];
  bills: Bill[];
  commitments: Commitment[];
  logistics: Logistic[];
  // AI:
  insights: Insight[];
  briefing: Briefing;
  lifeStats: LifeStats;
  aiScopes: AiScope[];
  suggestedPrompts: string[];
}

/** Action-queue card on the dashboard. */
export interface QueueItem {
  id: string;
  kind: "review" | "trial" | "error" | "duplicate";
  title: string;
  desc: string;
  count?: number;
  to: string;            // route id
}
