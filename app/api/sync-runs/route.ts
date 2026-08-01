import { NextResponse } from "next/server"
import { getLocalUserId, listSyncRuns } from "@/lib/db/local"

export async function GET() {
  const syncRuns = listSyncRuns(getLocalUserId())
  return NextResponse.json({ syncRuns })
}
