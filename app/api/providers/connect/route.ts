import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { testImapConnection } from "@/lib/imap/client"
import { encryptPassword } from "@/lib/crypto/credentials"
import { createProvider, getLocalUserId } from "@/lib/db/local"

const schema = z.object({
  email: z.string().email(),
  username: z.string().optional(),
  password: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(993),
  tls: z.boolean().default(true),
  displayName: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { email: rawEmail, username: rawUsername, password, host, port, tls, displayName } = parsed.data
  const email = rawEmail.trim()
  const username = rawUsername?.trim() || undefined

  const test = await testImapConnection({ host, port, tls, email, username, password })
  if (!test.success) {
    return NextResponse.json({ error: `Could not connect: ${test.error}` }, { status: 422 })
  }

  const provider = createProvider({
    userId: getLocalUserId(),
    type: "imap",
    email,
    displayName: displayName ?? email,
    username,
    host,
    port,
    tls,
    encryptedPassword: encryptPassword(password),
    status: "pending",
  })

  return NextResponse.json({ provider, folders: test.folders }, { status: 201 })
}
