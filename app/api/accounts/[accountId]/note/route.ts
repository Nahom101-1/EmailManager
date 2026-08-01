import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { setAccountNote } from "@/lib/db/local"

const schema = z.object({
  note: z.string().max(5000),
})

export async function PUT(
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

  setAccountNote(accountId, parsed.data.note)
  return NextResponse.json({ ok: true })
}
