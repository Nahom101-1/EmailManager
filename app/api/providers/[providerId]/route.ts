import { NextRequest, NextResponse } from "next/server"
import { deleteProvider, getProvider } from "@/lib/db/local"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params

  const provider = getProvider(providerId)
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }

  // Local-only disconnect: we remove the stored account and its data. No
  // destructive remote calls are made against Google.
  deleteProvider(providerId)
  return NextResponse.json({ ok: true })
}
