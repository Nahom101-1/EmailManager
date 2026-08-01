import { NextResponse } from "next/server"
import { suggestProviderTags } from "@/lib/ai/provider-tags"

export async function POST() {
  try {
    const result = await suggestProviderTags()
    return NextResponse.json(result)
  } catch (err) {
    console.error("[providers/tags/suggest]", err)
    return NextResponse.json({ error: "Failed to suggest tags" }, { status: 500 })
  }
}
