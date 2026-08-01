import { NextResponse } from "next/server"
import { getLocalUserId, listProviders } from "@/lib/db/local"

export async function GET() {
  const providers = listProviders(getLocalUserId()).map((provider) => ({
    id: provider.id,
    type: provider.type,
    email: provider.email,
    displayName: provider.display_name,
    status: provider.status,
    lastSyncAt: provider.last_sync_at,
    error: provider.error_message,
  }))

  return NextResponse.json({ providers })
}
