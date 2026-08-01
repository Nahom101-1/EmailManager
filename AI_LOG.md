# AI Development Log

This log records the major changes made by Codex while bringing LifeOS into a local-first, GitHub-ready state.

## 2026-06-12

### Project Direction

LifeOS is a local-first personal operations app for connecting inboxes, indexing email metadata, and eventually identifying subscriptions and accounts tied to email. The current implementation focuses on inbox connection and local persistence.

### Framework Notes

- The app uses Next.js `16.2.7` with React `19.2.4`.
- The project has an `AGENTS.md` instruction warning that this Next.js version has breaking changes.
- Before touching routing/proxy behavior, the bundled Next docs in `node_modules/next/dist/docs/` were checked.
- The deprecated `middleware.ts` convention was replaced with the Next 16 `proxy.ts` convention, then later removed entirely when hosted auth was dropped.
- For SQLite reads in a Server Component, `connection()` from `next/server` is used so `/dashboard` is request-time rendered instead of statically prerendering stale database contents.

### Removed Supabase

Supabase was removed from the project to support fully local development:

- Removed `@supabase/ssr` and `@supabase/supabase-js`.
- Deleted Supabase-specific client/server helpers.
- Deleted the Supabase project config and migrations.
- Removed Supabase environment variables from `.env.local`.
- Replaced hosted auth with local-development stubs.

Reason: the hosted Supabase project hostname did not resolve locally, and the project direction shifted to SQLite-only local development.

### Added Local SQLite Persistence

Added `better-sqlite3` and a local database layer at:

```text
lib/db/local.ts
```

The app initializes this database automatically:

```text
data/lifeos.sqlite
```

Tables currently created:

- `providers`
- `emails`
- `subscriptions`
- `accounts`
- `google_accounts`

`data/` is ignored by Git so personal inbox data and OAuth tokens are not committed.

### Google OAuth + Gmail API

Implemented direct Google OAuth and Gmail API account connection:

- `app/api/google/connect/route.ts`
- `app/api/google/callback/route.ts`
- `lib/google/oauth.ts`
- `components/providers/GoogleConnectCard.tsx`

OAuth behavior:

1. User clicks **Connect Google**.
2. App redirects to Google OAuth consent.
3. Google redirects back to `/api/google/callback`.
4. App exchanges the auth code for tokens.
5. App calls Gmail profile API to identify the mailbox.
6. App stores encrypted tokens locally in SQLite.
7. Dashboard shows the Gmail account as active.

Current Google scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

### Manual IMAP

Manual IMAP remains available for providers that do not have OAuth support in this app yet.

Implemented providers/settings:

- Gmail IMAP preset: `imap.gmail.com:993` with SSL/TLS
- Domeneshop preset: `imap.domeneshop.no:993` with SSL/TLS
- Custom IMAP settings

Important bug fixed:

- Empty IMAP username now falls back to the email address.
- Previously, an empty string was sent to `imapflow`, causing Gmail login to fail with an unhelpful `Command failed` message.

Domeneshop notes:

- `mail.domeneshop.no:993` timed out locally.
- `imap.domeneshop.no:993` connected successfully.
- Domeneshop commonly requires mailbox username such as `berhane1`, not the email address.

### UI Changes

- Replaced the default Next.js scaffold home page with a LifeOS-specific entry page.
- Added a dashboard showing connected inbox providers.
- Added a connect page with:
  - Google OAuth card as the recommended path
  - Manual IMAP form below it
- Kept the existing LifeOS visual direction: compact, light, glassy, minimal dashboard.

### Environment Variables

Committed `.env.example`:

```bash
ENCRYPTION_SECRET=replace-with-a-long-random-string
LIFEOS_DB_PATH=data/lifeos.sqlite
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

`.env.local` remains ignored.

### Verification

The following checks were run after implementation:

```bash
npm run lint
npm run build
```

Both passed after the Google OAuth and SQLite work.

Browser checks verified:

- `/connect` renders the Google OAuth card.
- `/connect` still renders manual IMAP.
- Google OAuth configuration errors redirect back to `/connect?error=...`.
- Successful Google OAuth connection stores the Gmail account and shows it on `/dashboard`.

### Current Working State

Confirmed by user screenshot:

- Gmail OAuth connection works.
- Dashboard shows `1` connected account.
- Connected Gmail account is active.
- Status is `active`.

### Next Suggested Work

1. Build a subscriptions review page.
2. Add richer subscription detection and amount parsing.
3. Add account discovery heuristics.
4. Add a disconnect/revoke flow for Google accounts.
5. Add configurable sync limits and background sync.

## 2026-06-12 Gmail Sync Update

Added the first working Gmail sync path:

- Refreshes Google access tokens with the stored refresh token when needed.
- Lists recent Gmail messages with Gmail API `users.messages.list`.
- Fetches message metadata sequentially with `users.messages.get` and `format=metadata`.
- Stores Gmail message IDs, thread IDs, labels, selected headers, subject, sender, recipient, date, and snippets in SQLite.
- Adds a per-account **Sync** button on the dashboard.
- Updates dashboard counts for emails scanned and subscription candidates.
- Adds basic subscription candidate detection from sender, subject, and snippet keywords.

Important implementation note:

- The first attempt fetched 25 Gmail message details concurrently and Google returned `429 Too many concurrent requests for user`.
- Sync now fetches message metadata sequentially and defaults to 10 recent messages per sync.
- Running sync repeatedly updates the same rows instead of duplicating email or subscription records.

Verified locally:

```bash
npm run lint
npm run build
```

Manual sync verification:

- Sync route returned `{"listed":10,"stored":10,"subscriptionCandidates":1}`.
- SQLite showed 10 email metadata rows.
- SQLite showed 1 subscription candidate.
- Running sync a second time kept counts at 10 emails and 1 subscription candidate.

## 2026-06-12 Subscriptions Review Update

Added the first product layer on top of detected subscription candidates:

- Added `/subscriptions`.
- Added summary cards for candidates, needs review, and marked active.
- Added subscription cards showing company, status, email used, last seen date, source subject, and source snippet when available.
- Added status controls for `active`, `cancelled`, `ignored`, and `unknown`.
- Added `PATCH /api/subscriptions/[subscriptionId]` to update local review status.
- Added a Subscriptions nav item.
- Added SQLite migration logic so subscription status supports the new `ignored` state.

Verified locally:

```bash
npm run lint
npm run build
```

Manual verification:

- `/subscriptions` rendered the existing detected candidate.
- Status update API changed a candidate to `active`.
- Candidate was restored to `unknown` after testing.
