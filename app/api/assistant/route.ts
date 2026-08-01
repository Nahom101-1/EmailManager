import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAiSettings } from "@/lib/db/local"
import { buildBriefing, buildLifeContext } from "@/lib/ai/context"
import {
  AI_SYSTEM,
  fallbackAnswer,
  streamClaudeWithTools,
  type ChatMessage,
} from "@/lib/ai/client"
import { buildDigestContext } from "@/lib/ai/tools"

const chatSchema = z.object({
  mode: z.literal("chat"),
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(40)
    .optional()
    .default([]),
})

const briefingSchema = z.object({
  mode: z.literal("briefing"),
})

const schema = z.discriminatedUnion("mode", [chatSchema, briefingSchema])

export async function POST(request: NextRequest) {
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

  const settings = getAiSettings()

  // Cloud AI is opt-in. When it's off we never build/send context — answer
  // locally from the deterministic briefing instead.
  const allowCloud = settings.cloudAiEnabled
  const context = allowCloud ? buildLifeContext(settings) : ""

  if (parsed.data.mode === "briefing") {
    const briefing = buildBriefing()
    if (!allowCloud) {
      return NextResponse.json({ live: false, text: localBriefingSummary(briefing) })
    }
    const stream = streamClaudeWithTools(AI_SYSTEM, [
      {
        role: "user",
        content:
          `CONTEXT (read from the user's inbox):\n${context}\n\n` +
          "Use get_daily_digest_inputs if helpful. Write a 2-3 sentence morning briefing: " +
          "what genuinely needs them today vs what can wait. Direct and factual. No greeting.",
      },
    ])
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }

  // chat
  const { message, history } = parsed.data
  if (!allowCloud) {
    return NextResponse.json({ live: false, text: fallbackAnswer(message, buildBriefing()) })
  }

  const messages: ChatMessage[] = [
    ...history,
    {
      role: "user",
      content:
        `CONTEXT (read from the user's inbox — only the sources you enabled):\n${context}\n\n` +
        `User question: ${message}`,
    },
  ]

  const stream = streamClaudeWithTools(AI_SYSTEM, messages)
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

function localBriefingSummary(briefing: ReturnType<typeof buildBriefing>): string {
  const { needsReply, newSinceLast, inboxLoad, dealFirst } = briefing
  const digest = buildDigestContext(24)
  const digestLine = digest.includes("no classified")
    ? ""
    : ` ${digest.split("\n")[0]?.replace("Email intelligence digest", "Digest") ?? ""}`

  if (needsReply === 0 && newSinceLast === 0) {
    return (
      "Nothing needs you right now — no detections are waiting for review and your inbox is quiet." +
      digestLine +
      " Run a sync to scan for new activity."
    )
  }
  const top = dealFirst[0]
  return (
    `${needsReply} item${needsReply === 1 ? "" : "s"} need your review` +
    (top ? `, starting with ${top.t.toLowerCase()}` : "") +
    `. Inbox load is ${inboxLoad.toLowerCase()} with ${newSinceLast} new in the last 24h — the rest can wait.` +
    digestLine
  )
}
