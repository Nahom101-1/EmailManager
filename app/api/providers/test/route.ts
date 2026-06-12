import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { testImapConnection } from "@/lib/imap/client"

const schema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  tls: z.boolean(),
  email: z.string().email(),
  username: z.string().optional(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email, username, ...config } = parsed.data
  const result = await testImapConnection({
    ...config,
    email: email.trim(),
    username: username?.trim() || undefined,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({
    folders: result.folders,
    emailCount: result.emailCount,
  })
}
