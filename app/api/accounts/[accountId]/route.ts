import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAccountById, updateAccountStatus } from "@/lib/db/local"
import { recordLearningLabel } from "@/lib/ai/learning"
import { findAccountSiblings } from "@/lib/identity/groups"

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

  const before = getAccountById(accountId)

  updateAccountStatus({ id: accountId, status: parsed.data.status })

  if (before && (parsed.data.status === "active" || parsed.data.status === "ignore")) {
    const siblings = findAccountSiblings(accountId)
    recordLearningLabel({
      kind: parsed.data.status === "active" ? "confirm" : "ignore",
      entity: "account",
      company: before.company,
      domain: before.domain,
      siblingDomains: siblings.map((s) => s.domain).filter((d): d is string => Boolean(d)),
      siblingCompanies: siblings.length ? [before.company] : [],
    })
  }

  return NextResponse.json({ ok: true })
}
