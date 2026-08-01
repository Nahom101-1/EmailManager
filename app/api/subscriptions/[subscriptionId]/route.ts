import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { updateSubscriptionCategory, updateSubscriptionStatus } from "@/lib/db/local"

const schema = z
  .object({
    status: z.enum(["active", "cancelled", "unknown", "ignored"]).optional(),
    category: z
      .enum(["saas", "streaming", "finance", "shopping", "newsletter", "utilities", "education", "other"])
      .optional(),
  })
  .refine((value) => value.status !== undefined || value.category !== undefined, {
    message: "Provide a status or category to update",
  })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  const { subscriptionId } = await params

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

  if (parsed.data.status) {
    updateSubscriptionStatus({ id: subscriptionId, status: parsed.data.status })
  }
  if (parsed.data.category) {
    updateSubscriptionCategory({ id: subscriptionId, category: parsed.data.category })
  }

  return NextResponse.json({ ok: true })
}
