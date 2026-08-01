import type { Briefing } from "@/lib/ai/context"
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/ai/tools"

export const AI_SYSTEM =
  "You are LifeOS, a private inbox-intelligence assistant. " +
  "Your job: triage — what to deal with first, what can wait, what to ignore. " +
  "Rules: (1) Ground every answer in the CONTEXT block and tool results; never invent specifics. " +
  "(2) Sort review items by confidence — highest first. " +
  "(3) Format subscription amounts as $X.XX/mo or $X.XX/yr. " +
  "(4) Use short bullet points; no greetings; no filler. " +
  "(5) Prefer tools (search_emails, get_daily_digest_inputs, explain_subscription) over guessing. " +
  "(6) End every response with one concrete next step the user can take right now."

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/** True when a live cloud model can actually be reached. */
export function cloudAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"
const MAX_TOOL_ROUNDS = 3

export class AiUnavailableError extends Error {}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string }

type ApiMessage = {
  role: "user" | "assistant"
  content: string | ContentBlock[]
}

/**
 * Call the Anthropic Messages API. Throws AiUnavailableError when no key is
 * configured so callers can degrade to the deterministic fallback ("Demo").
 */
export async function callClaude(system: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set")

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("")
    .trim()

  if (!text) throw new Error("Anthropic API returned no text")
  return text
}

/**
 * Claude with LifeOS tools (search, digest, clusters, reclassify).
 * Runs up to MAX_TOOL_ROUNDS of tool_use → tool_result before returning text.
 */
export async function callClaudeWithTools(
  system: string,
  userMessages: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set")

  const messages: ApiMessage[] = userMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1280,
        system,
        tools: ASSISTANT_TOOLS,
        messages,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      stop_reason?: string
      content?: Array<{
        type: string
        text?: string
        id?: string
        name?: string
        input?: Record<string, unknown>
      }>
    }

    const content = data.content ?? []
    const toolUses = content.filter((b) => b.type === "tool_use" && b.id && b.name)

    if (toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
      const text = content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim()
      if (!text) throw new Error("Anthropic API returned no text")
      return text
    }

    messages.push({
      role: "assistant",
      content: content.map((b) => {
        if (b.type === "tool_use") {
          return {
            type: "tool_use" as const,
            id: b.id!,
            name: b.name!,
            input: b.input ?? {},
          }
        }
        return { type: "text" as const, text: b.text ?? "" }
      }),
    })

    const toolResults: ContentBlock[] = []
    for (const tool of toolUses) {
      const result = await runAssistantTool(tool.name!, tool.input ?? {})
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id!,
        content: result,
      })
    }
    messages.push({ role: "user", content: toolResults })
  }

  throw new Error("Tool loop exhausted without a final answer")
}

/**
 * Deterministic answer used when cloud AI is off or unavailable. Grounded in
 * the same real briefing the UI shows, so "Demo" mode still says true things.
 */
export function fallbackAnswer(userMsg: string, briefing: Briefing): string {
  const m = userMsg.toLowerCase()
  const { dealFirst, canWait, ignore, newSinceLast, needsReply, inboxLoad } = briefing

  const list = (items: Briefing["dealFirst"]) =>
    items.length ? items.map((i) => `• ${i.t} — ${i.meta}`).join("\n") : null

  if (/first|urgent|priorit|deal|review|confirm/.test(m)) {
    const body = list(dealFirst)
    return body
      ? `Deal with these first:\n${body}\nNext step: confirm or ignore the top one to sharpen your data.`
      : "Nothing is waiting on you right now — no detections need review. Next step: run a sync to scan for new activity."
  }

  if (/ignore|skip|safe|noise/.test(m)) {
    const body = list(ignore)
    return body
      ? `Safe to ignore:\n${body}`
      : "Nothing flagged as safe-to-ignore yet. Low-confidence guesses show up here once a sync runs."
  }

  if (/wait|later|can wait/.test(m)) {
    const body = list(canWait)
    return body ? `These can wait:\n${body}` : "Nothing in the can-wait pile right now."
  }

  if (/money|spend|bill|subscription|cost|charge/.test(m)) {
    const subItems = dealFirst.filter((i) => i.t.startsWith("Confirm subscription"))
    return subItems.length
      ? `On subscriptions:\n${list(subItems)}\nNext step: confirm these to get an accurate monthly total.`
      : "No subscriptions need review. Confirmed ones are tracked on the Subscriptions page."
  }

  if (/summar|glance|day|brief|unread|new|digest/.test(m)) {
    return `${needsReply} item${needsReply === 1 ? "" : "s"} need review; inbox load is ${inboxLoad.toLowerCase()} with ${newSinceLast} new in the last 24h. Everything else can wait.`
  }

  return "I can help you triage. Try: “What should I deal with first?”, “What can I ignore?”, or “Summarize my day.”"
}
