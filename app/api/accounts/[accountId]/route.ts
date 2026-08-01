import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { updateAccountStatus } from "@/lib/db/local"

const schema = z.object({
  status: z.enum(["active", "closed", "unknown", "ignore"]),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  updateAccountStatus({ id: accountId, status: parsed.data.status })
  return NextResponse.json({ ok: true })
}
