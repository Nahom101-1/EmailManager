import { connection } from "next/server"
import { AssistantClient } from "@/components/assistant/AssistantClient"
import { getAiSettings } from "@/lib/db/local"
import { buildBriefing } from "@/lib/ai/context"
import { cloudAiConfigured } from "@/lib/ai/client"
import { AI_SCOPES } from "@/lib/ai/scopes"

const SUGGESTED_PROMPTS = [
  "What should I deal with first?",
  "What can I safely ignore today?",
  "Anything to review in my subscriptions?",
  "Summarize my day in one line",
  "Which accounts need a closer look?",
]

function greetingForNow(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning."
  if (h < 18) return "Good afternoon."
  return "Good evening."
}

function localSummary(briefing: ReturnType<typeof buildBriefing>): string {
  const { needsReply, newSinceLast, inboxLoad, dealFirst } = briefing
  if (needsReply === 0 && newSinceLast === 0) {
    return "Nothing needs you right now — no detections are waiting for review and your inbox is quiet. Run a sync to scan for new activity."
  }
  const top = dealFirst[0]
  return (
    `${needsReply} item${needsReply === 1 ? "" : "s"} need your review` +
    (top ? `, starting with ${top.t.toLowerCase()}` : "") +
    `. Inbox load is ${inboxLoad.toLowerCase()} with ${newSinceLast} new in the last 24h — the rest can wait.`
  )
}

export default async function AssistantPage() {
  await connection()
  const settings = getAiSettings()
  const briefing = buildBriefing()

  return (
    <AssistantClient
      greeting={greetingForNow()}
      initialSummary={localSummary(briefing)}
      briefing={briefing}
      scopeMeta={AI_SCOPES}
      initialScopes={settings.scopes}
      initialCloudEnabled={settings.cloudAiEnabled}
      cloudConfigured={cloudAiConfigured()}
      suggestedPrompts={SUGGESTED_PROMPTS}
    />
  )
}
