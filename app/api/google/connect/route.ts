import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { buildGoogleAuthUrl, getGoogleOAuthConfig } from "@/lib/google/oauth"

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin

  try {
    const { clientId, redirectUri } = getGoogleOAuthConfig(origin)
    const state = randomBytes(24).toString("hex")
    const cookieStore = await cookies()

    cookieStore.set("lifeos_google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    })

    return NextResponse.redirect(buildGoogleAuthUrl({ clientId, redirectUri, state }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google OAuth is not configured"
    const url = new URL("/connect", origin)
    url.searchParams.set("error", message)
    return NextResponse.redirect(url)
  }
}
