import { NextRequest, NextResponse } from "next/server"
import { getLocalUserId, listProviders } from "@/lib/db/local"
import { syncGmailProvider } from "@/lib/google/gmail"
import { syncImapProvider } from "@/lib/imap/sync"

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? ""
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const origin = new URL(request.url).origin
  const providers = listProviders(getLocalUserId())

  const results: Array<{ id: string; email: string; ok: boolean; error?: string }> = []

  for (const provider of providers) {
    try {
      if (provider.type === "gmail") {
        await syncGmailProvider({ providerId: provider.id, origin })
      } else if (provider.type === "imap") {
        await syncImapProvider({ providerId: provider.id })
      }
      results.push({ id: provider.id, email: provider.email, ok: true })
    } catch (err) {
      results.push({
        id: provider.id,
        email: provider.email,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  return NextResponse.json({ synced: results.length, results })
}
