---
name: lifeos-project-state
description: Current implementation state of the LifeOS project — what's done, what gaps remain
metadata:
  type: project
---

LifeOS is a local-first personal operations app at /Users/nahomberhane/Projects/lifeos.

**Stack:** Next.js 16.2.7, React 19.2.4, TypeScript, Tailwind CSS v4, SQLite (better-sqlite3), Google OAuth 2.0, Gmail API, IMAP (imapflow).

**Build status:** Clean — all 26 routes compile with no TypeScript errors.

**What's fully implemented:**
- All 9 design spec routes (Home, Dashboard, Assistant, Connect, Inbox Sync, Subscriptions, Accounts, Account Detail, Settings)
- App shell (sidebar + topbar + breadcrumbs)
- Google OAuth + Gmail sync (50 messages per run, sequential fetching to avoid 429s)
- IMAP connection testing (Domeneshop + Gmail IMAP + Custom presets)
- IMAP email sync (lib/imap/sync.ts) — implemented in the multi-agent loop
- Subscription detection with amount/billing cycle parsing — implemented in loop
- Account detection
- Sync state machine (modal with step progress)
- AI assistant chat + briefing (Claude API with graceful fallback)
- Full settings page (appearance, AI, data, security, Google, IMAP, developer)
- Theme system (light/dark, CSS variable token layer)
- Cards ⇄ Table toggle on Subscriptions and Accounts pages

**Completed in multi-agent loop (2026-08-01):**
- Amount/billing cycle extraction in detectSubscription() via parseAmount()
- Expanded KNOWN_VENDORS (70+ services including Cursor, NordVPN, Xbox, LinkedIn, etc.)
- upsertDetectedSubscriptions now stores amount + billing_cycle
- Gmail sync passes amount + billing_cycle from signal to record
- IMAP sync implemented — lib/imap/sync.ts + sync route dispatches by provider type
- AI system prompt tightened (sorts by confidence, formats amounts)
- buildLifeContext lists active subscriptions with amounts
- buildBriefing shows amounts in dealFirst items

**Remaining gaps:**
- Amount parsing only catches regex patterns in subject/snippet — needs more patterns
- No subscription amount editing via UI (design spec mentions "edit amount/cycle")
- No data export from settings (design spec mentions export/backup)
- Subscription notes (design spec mentions "add note" in overflow menu)
- More aggressive sync (pagination to scan beyond most recent 50 Gmail messages)
- No background/scheduled sync

**Why:** Local-first inbox intelligence dashboard that maps subscriptions and accounts from email metadata, with an AI triage assistant.
**How to apply:** When suggesting next features, prioritize those in the design spec that aren't yet implemented.
