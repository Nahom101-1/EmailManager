# LifeOS

LifeOS is a local-first personal operations app for connecting inboxes, indexing email metadata, and discovering subscriptions and online accounts tied to email.

The current app runs entirely on your machine. Gmail connects through Google OAuth and the Gmail API. Other inboxes can be tested through manual IMAP.

## Current Status

- Local SQLite database for app data.
- Google OAuth connection for Gmail and Google Workspace.
- Gmail API read-only token storage.
- Manual IMAP connection testing for custom providers.
- Domeneshop IMAP preset.
- Dashboard listing connected inboxes.
- Local-development login/signup stubs.

Not implemented yet:

- Gmail message sync.
- Subscription detection.
- Account discovery.
- Production auth.
- Token refresh jobs.

## Tech Stack

- Next.js `16.2.7`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- SQLite via `better-sqlite3`
- Google OAuth 2.0
- Gmail API
- IMAP via `imapflow`

## Requirements

- Node.js compatible with the project dependencies
- npm
- Google Cloud CLI, only for creating/configuring the Gmail OAuth project
- SQLite CLI, optional for inspecting local data

## Setup

Install dependencies:

```bash
npm install
```

Create local environment file:

```bash
cp .env.example .env.local
```

Set a local encryption secret:

```bash
openssl rand -base64 32
```

Paste the output into:

```bash
ENCRYPTION_SECRET=...
```

Start the app:

```bash
npm run dev
```

Open the URL printed by Next.js, usually:

```text
http://localhost:3001
```

## Environment Variables

```bash
ENCRYPTION_SECRET=replace-with-a-long-random-string
LIFEOS_DB_PATH=data/lifeos.sqlite
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

Notes:

- `.env.local` is ignored by Git.
- `data/` is ignored by Git.
- If Next.js runs on port `3000`, change `GOOGLE_REDIRECT_URI` to `http://localhost:3000/api/google/callback` and update the Google Cloud OAuth client to match.

## Google OAuth Setup

Detailed setup is documented in:

```text
docs/GOOGLE_CLOUD_SETUP.md
```

Short version:

```bash
gcloud auth login

PROJECT_ID="lifeos-gmail-$(date +%s)"

gcloud projects create "$PROJECT_ID" \
  --name="LifeOS Gmail"

gcloud config set project "$PROJECT_ID"

gcloud services enable gmail.googleapis.com \
  --project="$PROJECT_ID"
```

Then configure the OAuth consent screen and create a web OAuth client in Google Cloud.

Required redirect URI:

```text
http://localhost:3001/api/google/callback
```

Required scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

## Local Data

By default, LifeOS stores local data here:

```text
data/lifeos.sqlite
```

Override with:

```bash
LIFEOS_DB_PATH=/path/to/lifeos.sqlite npm run dev
```

Inspect connected providers:

```bash
sqlite3 data/lifeos.sqlite "select type,email,status,host from providers;"
```

Inspect Google token metadata:

```bash
sqlite3 data/lifeos.sqlite "select email, scope, expires_at from google_accounts;"
```

Do not commit the database. It can contain personal account metadata and encrypted OAuth tokens.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Project Structure

```text
app/
  api/google/         Google OAuth connect and callback routes
  api/providers/      Manual IMAP test/connect routes
  connect/            Inbox connection page
  dashboard/          Local inbox dashboard
components/
  providers/          Google OAuth and IMAP connection UI
lib/
  db/                 SQLite setup and queries
  google/             Google OAuth and Gmail API helpers
  imap/               IMAP connection helpers
  crypto/             Local token/password encryption helpers
types/
  provider.ts         Provider and IMAP types
docs/
  GOOGLE_CLOUD_SETUP.md
AI_LOG.md
```

## Verification

Before pushing:

```bash
npm run lint
npm run build
```

Recommended manual check:

1. Start `npm run dev`.
2. Open `/connect`.
3. Click **Connect Google**.
4. Complete Google OAuth.
5. Confirm `/dashboard` shows the Gmail account as active.

## GitHub Safety

Ignored by Git:

- `.env*`
- `data/`
- `.next/`
- `node_modules/`
- build outputs

Before pushing, check:

```bash
git status --short
git diff --stat
```

Make sure no `.env.local` or `data/lifeos.sqlite` files are staged.
