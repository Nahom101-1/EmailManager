import { decryptPassword, encryptPassword } from "@/lib/crypto/credentials"
import {
  getLocalUserId,
  type GoogleAccount,
  updateGoogleAccessToken,
  upsertGoogleProvider,
} from "@/lib/db/local"

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"

export const GOOGLE_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

export function getGoogleOAuthConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/google/callback`

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required")
  }

  return { clientId, clientSecret, redirectUri }
}

export function buildGoogleAuthUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeGoogleCode(input: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`)
  }

  return (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope: string
    token_type: string
  }
}

export async function refreshGoogleAccessToken(input: {
  refreshToken: string
  clientId: string
  clientSecret: string
}) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
    }),
  })

  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${await res.text()}`)
  }

  return (await res.json()) as {
    access_token: string
    expires_in?: number
    scope?: string
    token_type: string
  }
}

export async function getValidGoogleAccessToken(input: { account: GoogleAccount; origin: string }) {
  const expiresAt = input.account.expires_at ? new Date(input.account.expires_at).getTime() : 0
  const refreshWindowMs = 2 * 60 * 1000

  if (expiresAt && expiresAt - Date.now() > refreshWindowMs) {
    return decryptPassword(input.account.encrypted_access_token)
  }

  if (!input.account.encrypted_refresh_token) {
    throw new Error(
      "Google refresh token is missing. Reconnect the account to grant offline access."
    )
  }

  const { clientId, clientSecret } = getGoogleOAuthConfig(input.origin)
  const refreshed = await refreshGoogleAccessToken({
    refreshToken: decryptPassword(input.account.encrypted_refresh_token),
    clientId,
    clientSecret,
  })
  const refreshedExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : undefined

  updateGoogleAccessToken({
    providerId: input.account.provider_id,
    encryptedAccessToken: encryptPassword(refreshed.access_token),
    expiresAt: refreshedExpiresAt,
  })

  return refreshed.access_token
}

export async function getGmailProfile(accessToken: string) {
  const res = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error(`Gmail profile request failed: ${await res.text()}`)
  }

  return (await res.json()) as {
    emailAddress: string
    messagesTotal?: number
    threadsTotal?: number
    historyId?: string
  }
}

export function storeGoogleTokens(input: {
  email: string
  googleAccountId?: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope: string
}) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : undefined

  return upsertGoogleProvider({
    userId: getLocalUserId(),
    email: input.email,
    displayName: input.email,
    googleAccountId: input.googleAccountId,
    scope: input.scope,
    encryptedAccessToken: encryptPassword(input.accessToken),
    encryptedRefreshToken: input.refreshToken ? encryptPassword(input.refreshToken) : undefined,
    expiresAt,
  })
}
