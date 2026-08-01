import React, { useEffect, useState } from "react"
import { Box, Text } from "ink"

interface BillItem {
  vendor: string | null
  amount: number | null
  billing_cycle: string | null
  due_date: string
}

interface SubItem {
  company: string
  amount?: number | null
  billing_cycle?: string | null
  status: string
}

interface BriefItem {
  t: string
  meta: string
}

interface BriefingData {
  dealFirst: BriefItem[]
  canWait: BriefItem[]
  needsReply: number
  newSinceLast: number
  inboxLoad: string
}

interface Props {
  height: number
}

export function BriefingPanel({ height }: Props) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null)
  const [bills, setBills] = useState<BillItem[]>([])
  const [subs, setSubs] = useState<SubItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        // Direct DB access — same as the web app
        const { buildBriefing } = await import("../../lib/ai/context.js")
        const { getUpcomingBills } = await import("../../lib/db/intelligence.js")
        const { listSubscriptions, getLocalUserId } = await import("../../lib/db/local.js")
        const userId = getLocalUserId()
        const b = buildBriefing(userId)
        setBriefing(b)
        setBills(getUpcomingBills(30))
        const rawSubs = listSubscriptions(userId) as SubItem[]
        setSubs(rawSubs.filter((s) => s.status === "active").slice(0, 6))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      }
    }
    void load()
  }, [])

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text color="gray" dimColor>Run a sync from the web app first.</Text>
      </Box>
    )
  }

  if (!briefing) {
    return <Box padding={1}><Text color="gray">Loading…</Text></Box>
  }

  const maxItems = Math.floor((height - 12) / 3)

  return (
    <Box flexDirection="column" padding={1} overflow="hidden">
      <Text bold color="yellow">▸ Needs attention ({briefing.needsReply})</Text>
      {briefing.dealFirst.slice(0, Math.max(1, maxItems)).map((item, i) => (
        <Box key={i} flexDirection="column" marginTop={1}>
          <Text color="white" wrap="truncate">{"  "}● {item.t}</Text>
          <Text color="gray" dimColor wrap="truncate">{"    "}{item.meta}</Text>
        </Box>
      ))}
      {briefing.dealFirst.length === 0 && (
        <Text color="gray" dimColor>{"  "}All clear.</Text>
      )}

      <Box marginTop={1} />
      <Text bold color="blue">▸ Active subscriptions</Text>
      {subs.slice(0, Math.max(1, maxItems)).map((s, i) => (
        <Box key={i} marginTop={1}>
          <Text color="white" wrap="truncate">{"  "}{s.company}</Text>
          {s.amount != null && (
            <Text color="gray"> ${s.amount}/{s.billing_cycle === "yearly" ? "yr" : "mo"}</Text>
          )}
        </Box>
      ))}
      {subs.length === 0 && <Text color="gray" dimColor>{"  "}No active subscriptions.</Text>}

      {bills.length > 0 && (
        <>
          <Box marginTop={1} />
          <Text bold color="red">▸ Bills due soon</Text>
          {bills.slice(0, 3).map((b, i) => (
            <Box key={i} marginTop={1} flexDirection="column">
              <Text color="white" wrap="truncate">{"  "}● {b.vendor ?? "Unknown"}</Text>
              <Text color="gray" dimColor wrap="truncate">
                {"    "}
                {b.amount != null ? `$${b.amount}/${b.billing_cycle === "yearly" ? "yr" : "mo"} ` : ""}
                due {b.due_date}
              </Text>
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}
