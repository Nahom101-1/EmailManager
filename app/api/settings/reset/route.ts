import { NextResponse } from "next/server"
import { resetLocalData } from "@/lib/db/local"

export async function POST() {
  // Wipes all locally stored providers, emails, tokens and detected items.
  resetLocalData()
  return NextResponse.json({ ok: true })
}
