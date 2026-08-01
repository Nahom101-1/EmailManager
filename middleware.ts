import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

const PUBLIC_PATHS = new Set(["/login", "/signup"])
const PUBLIC_PREFIXES = ["/_next/", "/api/auth/", "/icon", "/manifest.json", "/favicon"]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

function verifySession(token: string, secret: string): boolean {
  const dot = token.lastIndexOf(".")
  if (dot < 1) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expiry = parseInt(payload, 10)
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false
  const expected = createHmac("sha256", secret).update(payload).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const secret = process.env.APP_SECRET
  if (!secret) {
    // APP_SECRET not set — allow through in local dev
    return NextResponse.next()
  }

  const token = request.cookies.get("lifeos_session")?.value ?? ""
  if (verifySession(token, secret)) return NextResponse.next()

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
