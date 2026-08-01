import { NextResponse } from "next/server"
import { getLocalUserId, listAccounts } from "@/lib/db/local"

export async function GET() {
  const accounts = listAccounts(getLocalUserId())
  return NextResponse.json({ accounts })
}
