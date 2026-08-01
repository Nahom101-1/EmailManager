import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAiSettings, setAiSettings, type AiSettings } from "@/lib/db/local"

const schema = z.object({
  cloudAiEnabled: z.boolean().optional(),
  scopes: z
    .object({
      inboxes: z.boolean(),
      subscriptions: z.boolean(),
      accounts: z.boolean(),
      metadata: z.boolean(),
      content: z.boolean(),
    })
    .partial()
    .optional(),
})

export async function GET() {
  return NextResponse.json(getAiSettings())
}

export async function PATCH(request: NextRequest) {
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

  const current = getAiSettings()
  const next: AiSettings = {
    cloudAiEnabled: parsed.data.cloudAiEnabled ?? current.cloudAiEnabled,
    scopes: { ...current.scopes, ...(parsed.data.scopes ?? {}) },
  }
  setAiSettings(next)
  return NextResponse.json(next)
}
