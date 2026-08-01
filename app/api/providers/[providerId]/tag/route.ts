import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getProvider, getProviderTag, setProviderTag } from "@/lib/db/local"

const schema = z.object({
  purpose: z.enum(["personal", "work", "shopping", "other"]),
  label: z.string().max(40).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params
  const provider = getProvider(providerId)
  if (!provider) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ tag: getProviderTag(providerId) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  const { providerId } = await params
  const provider = getProvider(providerId)
  if (!provider) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

  const tag = {
    purpose: parsed.data.purpose,
    label: parsed.data.label,
    source: "user" as const,
  }
  setProviderTag(providerId, tag)
  return NextResponse.json({ ok: true, tag })
}
