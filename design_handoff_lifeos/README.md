# Handoff: LifeOS — Personal Operations Dashboard

> A local-first dashboard that reads your inbox to map your whole digital life —
> communication, commitments, money, subscriptions, and the online accounts tied
> to your email addresses — with an AI assistant that triages it all: **what to
> deal with first, what can wait, what to ignore.**

This package is for a developer using **Claude Code** to implement the design in a
**Next.js (App Router) + React + TypeScript + Tailwind CSS** codebase.

---

## About the design files

The files in `reference/` are **design references created in HTML/CSS/JSX** —
working prototypes that show the intended look, layout, and behavior. **They are
not production code to copy directly.** The prototype runs on in-browser Babel and
attaches components to `window`; that's a prototyping shim, not an architecture.

**Your task:** recreate these designs in the target stack using its idioms —
real ESM modules, `"use client"` components, server components for data fetching,
Tailwind utilities backed by the CSS-variable token layer, and your own data +
AI layer. The HTML is the spec; build it properly.

**Fidelity: HIGH.** Colors, typography, spacing, status semantics, and
interactions are final. Match them. Exact token values are in `TOKENS.md` and
`globals.css`; the data contract is in `types.ts`.

---

## Recommended project structure

```
src/
  app/
    globals.css              ← from this bundle (token layer)
    layout.tsx               ← fonts + <html data-theme…> + ThemeProvider
    (app)/
      layout.tsx             ← AppShell (sidebar + topbar), wraps all routes
      dashboard/page.tsx
      assistant/page.tsx
      connect/page.tsx
      inbox-sync/page.tsx
      subscriptions/page.tsx
      accounts/page.tsx
      accounts/[id]/page.tsx ← Account Detail
      settings/page.tsx
    page.tsx                 ← Home / entry screen (no shell)
    api/
      assistant/route.ts     ← AI chat endpoint (streams Claude)
      sync/[inboxId]/route.ts
  components/
    ui/                      ← Icon, Btn, Badge, StatusBadge, Tile, Conf, Seg, Switch, Card, Field
    shell/                   ← Sidebar, Topbar, Breadcrumbs
    dashboard/               ← StatCard, InsightStrip, InboxRow, ActionQueue, AcrossLife cards
    subscriptions/           ← SubCard, SubTable, FilterChips, SummaryBar
    accounts/                ← AcctCard, AcctTable, EvidenceTimeline
    connect/                 ← GoogleConnect, ImapConnect, SyncModal
    assistant/               ← Briefing, Chat, AccessControl
  lib/
    types.ts                 ← from this bundle
    api.ts                   ← data fetching (TanStack Query hooks)
    ai.ts                    ← lifeContext() builder + prompt
  store/
    theme.ts                 ← style / accent / density (Zustand)
```

---

## Screens / Views

There are **9 routes**. Below: purpose, layout, and the components each needs.
Reference file in parentheses.

### 1. Home / entry (`page.tsx`) — *(screens-core.jsx → HomeScreen)*
- **Purpose:** introduce LifeOS, route into the app. Not a marketing page.
- **Layout:** full-viewport, no app shell. Top bar (logo left; theme toggle +
  "Connect inbox" + "Open dashboard" right). Two-column hero: left = promise +
  lede + two CTAs + trust line; right = a live **dashboard preview card**.
- **Copy (exact):** promise "**Map your digital life from your inbox.**" ·
  lede about surfacing subscriptions/accounts privately · trust "Your data stays
  on your machine. Read-only access, no servers." · badge "Local-first".
- Preview card shows 4 mini-stats (Inboxes 3, Subscriptions 17, Accounts 64,
  Monthly $184) + 3 subscription rows.

### 2. Dashboard (`dashboard/page.tsx`) — *(screens-core.jsx → Dashboard)*
- **Purpose:** command center.
- **Header:** eyebrow "Dashboard", title "**Your life, organized.**", actions
  "Sync all" + "Connect inbox".
- **Insight strip** (full-width card): AI "Assistant briefing" — 4 columns, each
  tagged `DEAL NOW` / `CAN WAIT` / `IGNORE` with icon, title, body, CTA.
- **Stat row:** 5 cards — Accounts connected, Emails scanned, Subscriptions,
  Monthly spend, Last sync. Values in **mono**.
- **Two-column body:** left = Connected inboxes list + Detected subscriptions
  (top 5); right = Action queue + Recent sync activity (timeline).
- **"Across your digital life"** section: 3 cards — Awaiting your reply (people),
  Bills due soon, Commitments.
- **Empty state** (no inbox): centered "Connect your first inbox" + Connect
  Google / Manual IMAP buttons.

### 3. Assistant (`assistant/page.tsx`) — *(screens-assistant.jsx)*
- **Purpose:** the AI surface — briefing + live chat.
- **Header:** title "Your briefing"; right = **Access control** ("Cloud AI ·
  N/5 sources" dropdown listing the 5 opt-in scopes with switches).
- **Two columns:** left = briefing card (greeting + AI summary + Regenerate) then
  three stacked lists "Deal with first" / "Can wait" / "Safe to ignore"; right =
  **sticky chat panel** (Live/Demo badge, message bubbles, "thinking" indicator,
  suggested-prompt chips when empty, input + send).
- Chat bubbles: AI left (surface-inset, markdown-rendered), user right (accent).

### 4. Connect (`connect/page.tsx`) — *(screens-connect.jsx → ConnectScreen)*
- **Purpose:** add inboxes. **Google is recommended; IMAP is secondary/technical.**
- **Google card** (accent-tinted border): heading "Connect Google", OAuth +
  Recommended badges, "read-only Gmail" note. States: `idle → redirecting
  (spinner + consent notice) → connected`.
- **Manual IMAP card:** preset chips (Domeneshop / Gmail IMAP fallback / Custom);
  selecting one shows a contextual notice (Domeneshop: "username may be mailbox
  username, not email"; Gmail: "**OAuth is preferred**"). Fields: email, password/
  app-password (show/hide), collapsible Advanced (IMAP username, server, port,
  encryption). Actions: **Test connection** (idle→testing→ok) then **Connect**
  (enabled only after a passing test).
- Below: Connected inboxes list; if any inbox is in error, an **error block**
  with cause + checklist + Retry / Update credentials.

### 5. Inbox Sync (`inbox-sync/page.tsx`) — *(screens-connect.jsx → SyncScreen)*
- 4 stat cards (messages scanned, new this week, subs detected, accounts
  detected) + two columns: Inboxes list (per-inbox Sync) and an **Activity log**
  grouped by day as timelines.

### 6. Subscriptions (`subscriptions/page.tsx`) — *(screens-data.jsx)*
- **Summary bar:** Active subscriptions, Monthly spend, Annualized, Trials
  ending soon.
- **Filter chips:** All / Active / Needs review / Unknown / Cancelled / Monthly /
  Yearly (each with count).
- **Cards ⇄ Table** toggle. Card: monogram tile, company, category, amount/cycle,
  status badge, trial notice, email/last-seen/source + **confidence meter**,
  confirm/ignore actions for unconfirmed. Table is sortable. Row overflow menu:
  mark active/cancelled, ignore, view source, edit amount/cycle, add note.
- **Empty state:** "No subscriptions found yet" + Sync now.

### 7. Accounts (`accounts/page.tsx`) — *(screens-data.jsx)*
- 4 stat cards (Total discovered, Active, Inactive, High risk). Filters: All /
  Active / Inactive / Unknown / High risk. Cards ⇄ Table.
- Card: tile, service, email, status + **risk pill**, **signal chips** (receipt,
  login, newsletter, security, password-reset, trial…), first/last seen. Click →
  Account Detail. Menu: mark active/inactive, ignore, group duplicates, review
  source, add note.

### 8. Account Detail (`accounts/[id]/page.tsx`) — *(screens-data.jsx → AccountDetail)*
- Breadcrumb back to Accounts. Header: tile, name, status + risk + email; actions
  **Keep / Review / Cancel** + overflow.
- Two columns: left = **Timeline of evidence** (signals over time) + User notes
  (textarea + save); right = Details (linked email, source inbox, first/last,
  risk score), Signals detected (chips), Related subscriptions.

### 9. Settings (`settings/page.tsx`) — *(screens-settings.jsx)*
- Sections: **Appearance** (theme, density) · **AI assistant** (cloud-AI toggle,
  voice, and the 5 access scopes) · **Local data** (DB location, export, backup,
  clear) · **Security** (encryption switch, rotate secret [soon], disconnect all)
  · **Google** (connected client, reconnect, revoke token) · **IMAP** (saved
  providers, test, remove) · **Developer** (version, env checks, redirect URI,
  Gmail API status).

---

## App shell (wraps routes 2–9)

- **Sidebar (234px; 210 compact):** brand (→ Home), nav (Dashboard, Assistant,
  Connect, Inbox Sync, Subscriptions [count], Accounts [count], Settings) with
  an active indicator (3px accent bar on the left), a "Local-first" notice, and a
  user chip. Active nav item gets a raised surface; icon tints to accent.
- **Topbar (54px):** breadcrumbs (LifeOS › …), search box (`⌘K`), assistant
  launcher, theme toggle. Sticky, subtle backdrop blur.

---

## Interactions & behavior

- **Routing:** sidebar + breadcrumbs → App Router navigation. Scroll resets to
  top on route change.
- **Sync state machine** (the signature interaction): a modal animating
  `idle → refreshing token → fetching messages (live message counter) → storing
  metadata → detecting subscriptions → complete`, then a result grid (messages
  scanned, new messages, subscriptions, accounts) and a toast. Per-inbox status
  flips to `syncing` (pulsing dot) during the run. Step timings in
  `app.jsx → SyncModal` (~600–900ms each). On the real backend, drive these
  states from your sync job (SSE/websocket or polling).
- **Filters / sorting / layout toggle:** instant client-side state.
- **Mark active/cancelled/ignore:** optimistic update + toast; "ignore" removes
  the row.
- **Toasts:** bottom-right, auto-dismiss ~3.2s.
- **Theme/style/accent/density:** `data-*` on `<html>`, persisted to
  localStorage (see TOKENS.md §3).
- **Animations:** card entrance is **transform-only** (`fade-in`, translateY) —
  intentionally NOT opacity, so it survives reduced-motion and static capture.
  Keep that pattern. Respect `prefers-reduced-motion`.

---

## State management

| State | Scope | Suggestion |
|---|---|---|
| Inboxes, subs, accounts, people, bills, … | server data | **TanStack Query** against your API; shapes = `types.ts` |
| Sync progress | per-inbox ephemeral | local state / SSE from sync job |
| theme · style · accent · density | global UI | **Zustand** + `next-themes`, persisted |
| Subscriptions/Accounts filter + layout | page-local | `useState` (or URL searchParams for shareable views) |
| AI scopes | user setting | server-persisted; **enforced server-side** when building context |
| Chat messages | assistant page | local state; stream from `/api/assistant` |

---

## AI integration (replaces `window.claude.complete`)

The prototype isolates all AI in `screens-assistant.jsx`:
- **`lifeContext()`** builds a grounding string from the user's data (inbox load,
  who's awaiting replies, bills due, commitments, subscriptions). **Port this
  server-side** so the model only ever sees data for **enabled scopes**
  (`AiScope.on`). This is the privacy contract — enforce it in the route handler,
  not the client.
- **System prompt** (`AI_SYSTEM`): direct, efficient, action-oriented; short
  bullets; ground every answer in context; end with one next step. Reuse it.
- **Two call sites:** the briefing summary (`Regenerate`) and the chat. Build a
  `POST /api/assistant` route that runs your model (Anthropic SDK, streaming) and
  returns text; render markdown in bubbles (the prototype includes a tiny
  `mdToHtml` — use `react-markdown` instead).
- **Keep a graceful fallback** (`fallbackAnswer`) for when AI is off/unavailable —
  the UI already degrades to a "Demo" badge.

> Privacy framing is **opt-in cloud AI**: default the cloud-AI toggle OFF, show
> exactly which sources are shared, and never include `content` scope (full
> message text) unless explicitly enabled.

---

## Backend surfaces implied (not in scope to design, but the UI expects)

- OAuth: Google consent → read-only Gmail (Gmail API). Store tokens locally.
- IMAP: test + connect (host/port/SSL, app passwords). Presets for Domeneshop /
  Gmail-fallback / Custom.
- Sync job: fetch metadata → SQLite → run subscription/account detection →
  emit progress + result.
- Detection produces `confidence` and initial `status` (`unknown`/`needs-review`)
  the user then confirms.
- `/api/assistant` for AI.

---

## Files in this bundle

| File | What it is |
|---|---|
| `README.md` | This spec (self-sufficient). |
| `types.ts` | TypeScript data contract — drop into `src/lib/`. |
| `globals.css` | Token layer (CSS variables, themes, styles, density). |
| `TOKENS.md` | Tailwind config + token tables + theming setup. |
| `reference/LifeOS.html` | Entry point — open in a browser to see the whole app. |
| `reference/styles.css` | Full stylesheet incl. component classes (port to components). |
| `reference/data.js` | Mock data — a sample instance of `types.ts`. |
| `reference/ui.jsx` | Primitives + the full icon set (path data). |
| `reference/screens-core.jsx` | Home + Dashboard. |
| `reference/screens-connect.jsx` | Connect + Inbox Sync. |
| `reference/screens-data.jsx` | Subscriptions + Accounts + Account Detail. |
| `reference/screens-assistant.jsx` | Assistant (briefing, chat, access control, AI plumbing). |
| `reference/screens-settings.jsx` | Settings. |
| `reference/app.jsx` | Shell, routing, sync state machine, toasts, theming. |

**To preview the design:** open `reference/LifeOS.html` in a browser. Use the
**Tweaks** panel (bottom-right) to toggle visual style, accent, dark mode, and
density — these map to the `data-*` theming described in `TOKENS.md`.

## Suggested build order
1. `globals.css` + `tailwind.config.ts` + fonts + theme provider → verify
   light/dark and a couple of accents switch.
2. `components/ui/*` primitives (Icon, Btn, Badge, Card, StatusBadge, Tile).
3. App shell (sidebar + topbar) + routing skeleton.
4. Dashboard with **mock** data typed by `types.ts`.
5. Subscriptions + Accounts (+ detail) — the data-dense surfaces.
6. Connect + the Sync state machine.
7. Assistant + `/api/assistant`.
8. Settings.
9. Swap mock data for real API hooks; wire OAuth/IMAP/sync.
