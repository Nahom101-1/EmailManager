import React from "react"
import { Box, Text } from "ink"
import type { ChatMsg } from "../App.js"

interface Props {
  messages: ChatMsg[]
  loading: boolean
  height: number
}

export function ChatPanel({ messages, loading, height }: Props) {
  const visibleHeight = height - 4
  // Show most recent messages that fit
  const lines: Array<{ text: string; color: string; bold?: boolean }> = []
  for (const msg of messages) {
    const isUser = msg.role === "user"
    lines.push({ text: isUser ? "You:" : "LifeOS:", color: isUser ? "cyan" : "green", bold: true })
    // Word-wrap naively by splitting on newlines
    const paragraphs = msg.text.split("\n").filter(Boolean)
    if (paragraphs.length === 0) {
      lines.push({ text: msg.streaming ? "▋" : "…", color: "gray" })
    } else {
      for (const p of paragraphs) {
        lines.push({ text: "  " + p + (msg.streaming && p === paragraphs[paragraphs.length - 1] ? "▋" : ""), color: isUser ? "white" : "gray" })
      }
    }
    lines.push({ text: "", color: "gray" })
  }

  const visible = lines.slice(-visibleHeight)

  return (
    <Box flexDirection="column" padding={1} overflow="hidden">
      {messages.length === 0 && !loading && (
        <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
          <Text color="gray" dimColor>Ask anything about your inbox</Text>
          <Text color="gray" dimColor>briefing · search · subscriptions · bills</Text>
        </Box>
      )}
      {visible.map((line, i) => (
        <Text key={i} color={line.color as Parameters<typeof Text>[0]["color"]} bold={line.bold} wrap="truncate">
          {line.text}
        </Text>
      ))}
      {loading && messages[messages.length - 1]?.role !== "ai" && (
        <Text color="gray" dimColor>LifeOS is thinking…</Text>
      )}
    </Box>
  )
}
