import { NextResponse } from "next/server"
import { getLocalUserId, listSubscriptions } from "@/lib/db/local"

export async function GET() {
  const subscriptions = listSubscriptions(getLocalUserId())
  return NextResponse.json({ subscriptions })
}
