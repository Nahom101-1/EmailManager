import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/login`)
}
