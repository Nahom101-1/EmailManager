import { NextRequest, NextResponse } from "next/server"
import { getEmailById } from "@/lib/db/local"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const { emailId } = await params
  const email = getEmailById(emailId)

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 })
  }

  return NextResponse.json({ email })
}
