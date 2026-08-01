import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"

const SESSION_DAYS = 30
const MS_PER_DAY = 86_400_000

function createToken(secret: string): string {
  const expiry = Date.now() + SESSION_DAYS * MS_PER_DAY
  const payload = String(expiry)
  const sig = createHmac("sha256", secret).update(payload).digest("hex")
  return `${payload}.${sig}`
}

export async function POST(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD
  const appSecret = process.env.APP_SECRET

  if (!appPassword || !appSecret) {
    return NextResponse.json({ error: "Server not configured for auth" }, { status: 503 })
  }

  let body: { password?: string }
  try {
    body = (await request.json()) as { password?: string }
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (body.password !== appPassword) {
    await new Promise((r) => setTimeout(r, 400)) // slow brute-force
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }

  const token = createToken(appSecret)
  const response = NextResponse.json({ ok: true })
  response.cookies.set("lifeos_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  })
  return response
}
