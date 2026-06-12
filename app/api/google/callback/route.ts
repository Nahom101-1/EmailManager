import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  exchangeGoogleCode,
  getGmailProfile,
  getGoogleOAuthConfig,
  storeGoogleTokens,
} from "@/lib/google/oauth"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")
  const oauthError = requestUrl.searchParams.get("error")

  if (oauthError) {
    return redirectToConnect(origin, oauthError)
  }

  if (!code || !state) {
    return redirectToConnect(origin, "Google OAuth callback was missing code or state")
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get("lifeos_google_oauth_state")?.value
  cookieStore.delete("lifeos_google_oauth_state")

  if (!expectedState || expectedState !== state) {
    return redirectToConnect(origin, "Google OAuth state check failed")
  }

  try {
    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin)
    const token = await exchangeGoogleCode({ code, clientId, clientSecret, redirectUri })
    const profile = await getGmailProfile(token.access_token)

    storeGoogleTokens({
      email: profile.emailAddress,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      scope: token.scope,
    })

    return NextResponse.redirect(`${origin}/dashboard`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth callback failed"
    return redirectToConnect(origin, message)
  }
}

function redirectToConnect(origin: string, message: string) {
  const url = new URL("/connect", origin)
  url.searchParams.set("error", message)
  return NextResponse.redirect(url)
}
