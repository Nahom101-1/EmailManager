import { NextRequest, NextResponse } from "next/server"
import { getProvider } from "@/lib/db/local"
import { syncGmailProvider } from "@/lib/google/gmail"
import { syncImapProvider } from "@/lib/imap/sync"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params
  const origin = new URL(request.url).origin

  const provider = getProvider(providerId)
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  try {
    if (provider.type === "gmail") {
      const result = await syncGmailProvider({ providerId, origin })
      return NextResponse.json(result)
    }

    if (provider.type === "imap") {
      const result = await syncImapProvider({ providerId })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: `Sync not supported for provider type: ${provider.type}` },
      { status: 422 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
