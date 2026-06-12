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

1. Add a sync button per Gmail account.
2. Refresh Google access tokens using stored refresh tokens.
3. Call Gmail API `users.messages.list`.
4. Fetch message metadata/snippets with `users.messages.get`.
5. Store email metadata in SQLite.
6. Update dashboard `Emails scanned`.
7. Add subscription detection heuristics.
8. Update dashboard `Subscriptions found`.
