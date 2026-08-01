import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAiSettings } from "@/lib/db/local"
import { buildBriefing, buildLifeContext } from "@/lib/ai/context"
import { AI_SYSTEM, fallbackAnswer, streamClaudeWithTools, type ChatMessage } from "@/lib/ai/client"
import { buildDigestContext } from "@/lib/ai/tools"
import { ollamaAvailable, streamOllama } from "@/lib/ai/local"

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

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function streamOllamaSSE(system: string, messages: ChatMessage[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const sse = (obj: Record<string, string>) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`)
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamOllama(system, messages)) {
          controller.enqueue(sse({ type: "delta", text: chunk }))
        }
        controller.enqueue(sse({ type: "done" }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        controller.enqueue(sse({ type: "error", text: msg }))
      }
      controller.close()
    },
  })
}

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

  // Priority: Claude (cloud, opt-in) → Ollama (local, always allowed) → deterministic fallback
  const allowCloud = settings.cloudAiEnabled && Boolean(process.env.ANTHROPIC_API_KEY)
  const ollamaOk = !allowCloud && (await ollamaAvailable())
  const useAi = allowCloud || ollamaOk
  const context = useAi ? buildLifeContext(settings) : ""

  const briefingUserMsg: ChatMessage = {
    role: "user",
    content:
      `CONTEXT (read from the user's inbox):\n${context}\n\n` +
      "Write a 2-3 sentence morning briefing: what genuinely needs attention today vs what can wait. Direct and factual. No greeting.",
  }

  if (parsed.data.mode === "briefing") {
    const briefing = buildBriefing()
    if (!useAi) {
      return NextResponse.json({ live: false, text: localBriefingSummary(briefing) })
    }
    const stream = allowCloud
      ? streamClaudeWithTools(AI_SYSTEM, [
          {
            ...briefingUserMsg,
            content:
              `CONTEXT (read from the user's inbox):\n${context}\n\n` +
              "Use get_daily_digest_inputs if helpful. Write a 2-3 sentence morning briefing: " +
              "what genuinely needs them today vs what can wait. Direct and factual. No greeting.",
          },
        ])
      : streamOllamaSSE(AI_SYSTEM, [briefingUserMsg])
    return sseResponse(stream)
  }

  // chat
  const { message, history } = parsed.data
  if (!useAi) {
    return NextResponse.json({ live: false, text: fallbackAnswer(message, buildBriefing()) })
  }

  const messages: ChatMessage[] = [
    ...history,
    {
      role: "user",
      content:
        `CONTEXT (read from the user's inbox):\n${context}\n\n` +
        `User question: ${message}`,
    },
  ]

  const stream = allowCloud
    ? streamClaudeWithTools(AI_SYSTEM, messages)
    : streamOllamaSSE(AI_SYSTEM, messages)
  return sseResponse(stream)
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
