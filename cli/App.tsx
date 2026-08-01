import React, { useState, useCallback, useEffect } from "react"
import { Box, Text, useApp, useInput } from "ink"
import TextInput from "ink-text-input"
import { StatusBar } from "./components/StatusBar.js"
import { BriefingPanel } from "./components/BriefingPanel.js"
import { ChatPanel } from "./components/ChatPanel.js"

export interface ChatMsg {
  role: "user" | "ai"
  text: string
  streaming?: boolean
}

export function App() {
  const { exit } = useApp()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [modelLabel, setModelLabel] = useState("…")
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [width, setWidth] = useState(process.stdout.columns || 120)
  const [height, setHeight] = useState(process.stdout.rows || 36)

  useEffect(() => {
    const onResize = () => {
      setWidth(process.stdout.columns || 120)
      setHeight(process.stdout.rows || 36)
    }
    process.stdout.on("resize", onResize)
    return () => {
      process.stdout.off("resize", onResize)
    }
  }, [])

  useEffect(() => {
    async function detectBackend() {
      if (process.env.ANTHROPIC_API_KEY) {
        setModelLabel("Claude API")
        setOllamaOk(false)
      } else {
        const { ollamaAvailable, LOCAL_MODEL } = await import("../lib/ai/local.js")
        const ok = await ollamaAvailable()
        setOllamaOk(ok)
        setModelLabel(ok ? LOCAL_MODEL : "unavailable")
      }
    }
    void detectBackend()
  }, [])

  useInput((input, key) => {
    if (key.ctrl && input === "c") exit()
    if (key.escape) exit()
  })

  const handleSubmit = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || loading) return
      setInput("")
      const history = messages.map((m) => ({
        role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }))
      setMessages((m) => [...m, { role: "user", text: q }])
      setLoading(true)
      // Add streaming placeholder
      setMessages((m) => [...m, { role: "ai", text: "", streaming: true }])
      try {
        const { streamAi, AI_SYSTEM } = await import("../lib/ai/client.js")
        let accumulated = ""
        for await (const chunk of streamAi(AI_SYSTEM, [...history, { role: "user", content: q }])) {
          accumulated += chunk
          const finalText = accumulated
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { role: "ai", text: finalText, streaming: true }
            return copy
          })
        }
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: "ai", text: accumulated, streaming: false }
          return copy
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error calling AI"
        setMessages((m) => [...m.slice(0, -1), { role: "ai", text: `Error: ${msg}` }])
      } finally {
        setLoading(false)
      }
    },
    [messages, loading]
  )

  const leftWidth = Math.floor(width * 0.35)
  const rightWidth = width - leftWidth

  return (
    <Box flexDirection="column" width={width} height={height}>
      <StatusBar model={modelLabel} ollamaOk={ollamaOk} width={width} />
      <Box flexGrow={1}>
        <Box width={leftWidth} flexDirection="column" borderStyle="single" borderColor="gray">
          <BriefingPanel height={height - 5} />
        </Box>
        <Box width={rightWidth} flexDirection="column" borderStyle="single" borderColor="gray">
          <ChatPanel messages={messages} loading={loading} height={height - 5} />
        </Box>
      </Box>
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan">{"› "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Ask anything… (Ctrl+C to quit)"
        />
      </Box>
    </Box>
  )
}
