# Google Cloud Setup

LifeOS connects Gmail accounts with Google OAuth and the Gmail API. The app is local-first, but Google still requires a Cloud project, OAuth consent screen, and OAuth client credentials.

## 1. Log In

```bash
gcloud auth login
```

This logs the Google Cloud CLI into your Google account. LifeOS does not require `gcloud auth application-default login` because the app uses its own OAuth client ID and client secret.

## 2. Create Or Select A Project

List existing projects:

```bash
gcloud projects list
```

Create a new project:

```bash
PROJECT_ID="lifeos-gmail-$(date +%s)"

gcloud projects create "$PROJECT_ID" \
  --name="LifeOS Gmail"
```

Set it as the active project:

```bash
gcloud config set project "$PROJECT_ID"
```

Check the active project:

```bash
gcloud config get-value project
```

## 3. Enable Gmail API

```bash
gcloud services enable gmail.googleapis.com \
  --project="$PROJECT_ID"
```

Verify:

```bash
gcloud services list --enabled \
  --project="$PROJECT_ID" \
  --filter="name:gmail.googleapis.com"
```

## 4. Configure OAuth Consent

Open the OAuth audience page:

```bash
open "https://console.cloud.google.com/auth/audience?project=$PROJECT_ID"
```

Use these settings for local development:

- App name: `LifeOS Local`
- Audience: `External`
- Publishing status: `Testing`
- Test users: add the Google account you will connect
- Scope: `https://www.googleapis.com/auth/gmail.readonly`

If Google shows “Access blocked,” the account is not listed as a test user. Add it and try again.

## 5. Create OAuth Client

Open the OAuth clients page:

```bash
open "https://console.cloud.google.com/auth/clients?project=$PROJECT_ID"
```

Create a client:

- Application type: `Web application`
- Name: `LifeOS Local`
- Authorized redirect URI:

```text
http://localhost:3001/api/google/callback
```

If Next.js starts on port `3000`, use this instead in both Google Cloud and `.env.local`:

```text
http://localhost:3000/api/google/callback
```

## 6. Configure LifeOS

Copy the generated client ID and secret into `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
```

Restart the dev server after editing `.env.local`.

## 7. Verify Connection

Start LifeOS:

```bash
npm run dev
```

Open:

```text
http://localhost:3001/connect
```

Click **Connect Google**. After approving the consent screen, the dashboard should show one connected Gmail account.

Check the local SQLite database:

```bash
sqlite3 data/lifeos.sqlite "select type,email,status,host from providers;"
sqlite3 data/lifeos.sqlite "select email, scope, expires_at from google_accounts;"
```

Expected:

- `providers.type` is `gmail`
- `providers.status` is `active`
- `google_accounts.scope` includes `https://www.googleapis.com/auth/gmail.readonly`

## Useful Project Commands

List projects:

```bash
gcloud projects list
```

Delete a project:

```bash
gcloud projects delete PROJECT_ID
```

Recover a recently deleted project:

```bash
gcloud projects undelete PROJECT_ID
```

Disable Gmail API:

```bash
gcloud services disable gmail.googleapis.com \
  --project="$PROJECT_ID"
```
