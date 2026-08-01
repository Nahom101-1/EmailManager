import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hybridSearch } from "@/lib/ai/search"

const schema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().min(1).max(30).optional(),
})

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Query q is required" }, { status: 400 })
  }

  try {
    const result = await hybridSearch(parsed.data.q, parsed.data.limit ?? 12)
    return NextResponse.json(result)
  } catch (error) {
    console.error("search error", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
