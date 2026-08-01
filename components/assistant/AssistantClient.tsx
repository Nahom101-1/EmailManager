"use client"

import { useEffect, useRef, useState } from "react"
import { Btn, Icon } from "@/components/ui"
import type { AiScopeId } from "@/lib/db/local"
import type { Briefing } from "@/lib/ai/context"

interface ScopeMeta {
  id: AiScopeId
  label: string
  desc: string
}

interface Props {
  greeting: string
  initialSummary: string
  briefing: Briefing
  scopeMeta: ScopeMeta[]
  initialScopes: Record<AiScopeId, boolean>
  initialCloudEnabled: boolean
  cloudConfigured: boolean
  suggestedPrompts: string[]
}

interface ChatMsg {
  role: "user" | "ai"
  text: string
}

export function AssistantClient({
  initialSummary,
  initialCloudEnabled,
  cloudConfigured,
  suggestedPrompts,
}: Props) {
  const [cloudEnabled, setCloudEnabled] = useState(initialCloudEnabled)
  const [summary, setSummary] = useState(initialSummary)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const live = cloudConfigured && cloudEnabled

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [msgs, busy])

  async function toggleCloud() {
    const next = !cloudEnabled
    setCloudEnabled(next)
    try {
      await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloudAiEnabled: next }),
      })
    } catch { /* ignore */ }
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput("")
    const history = msgs.map((m) => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.text,
    }))
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "ai", text: "" }])
    setBusy(true)

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", message: q, history }),
      })

      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const data = await res.json() as { text?: string }
        setMsgs((m) => [...m.slice(0, -1), { role: "ai", text: data.text ?? "Something went wrong." }])
        return
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; text?: string }
            if (evt.type === "delta" && evt.text) {
              setMsgs((m) => {
                const copy = [...m]
                copy[copy.length - 1] = { role: "ai", text: (copy[copy.length - 1]?.text ?? "") + evt.text }
                return copy
              })
            } else if (evt.type === "error") {
              setMsgs((m) => [...m.slice(0, -1), { role: "ai", text: evt.text ?? "Something went wrong." }])
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: "ai", text: "Couldn't reach the assistant. Try again." }])
    } finally {
      setBusy(false)
    }
  }

  async function regenerate() {
    setBusy(true)
    let acc = ""
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "briefing" }),
      })
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const data = await res.json() as { text?: string }
        if (data.text) setSummary(data.text)
        return
      }
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; text?: string }
            if (evt.type === "delta" && evt.text) { acc += evt.text; setSummary(acc) }
          } catch { /* ignore */ }
        }
      }
    } catch { /* keep */ } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 52px)" }}>
      {/* top briefing strip */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 14, background: "var(--surface)", flex: "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span className={"badge " + (live ? "active" : "idle")} style={{ height: 20, fontSize: 11 }}>
              <span className="dot" />
              {live ? "Live" : "Demo"}
            </span>
            {cloudConfigured && (
              <button
                className={"switch" + (cloudEnabled ? " on" : "")}
                onClick={toggleCloud}
                title={cloudEnabled ? "Cloud AI on — click to disable" : "Cloud AI off — click to enable"}
                style={{ transform: "scale(0.8)", transformOrigin: "left center" }}
              />
            )}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>{summary}</p>
        </div>
        <Btn variant="ghost" size="xs" icon="refresh" disabled={busy} onClick={regenerate}>
          Refresh
        </Btn>
      </div>

      {/* messages */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {msgs.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--ink-3)", maxWidth: 300 }}>
            <Icon name="bolt" size={24} style={{ color: "var(--accent)", marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>Ask anything about your inbox</div>
            <div style={{ fontSize: 13 }}>Subscriptions, spending, what to deal with first.</div>
          </div>
        )}
        {msgs.map((m, i) => <Bubble key={i} msg={m} />)}
        {busy && msgs[msgs.length - 1]?.role !== "ai" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
            <span className="dot pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            Thinking…
          </div>
        )}
      </div>

      {/* suggested prompts */}
      {msgs.length === 0 && (
        <div style={{ padding: "0 24px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestedPrompts.map((p) => (
            <button key={p} className="chip btn-chip" style={{ fontSize: 12 }} onClick={() => send(p)}>{p}</button>
          ))}
        </div>
      )}

      {/* input */}
      <div style={{ padding: "10px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, flex: "none", background: "var(--bg)" }}>
        <input
          className="input"
          style={{ fontSize: 14, flex: 1 }}
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={busy}
        />
        <Btn variant="primary" icon="send" disabled={busy || !input.trim()} onClick={() => send()} />
      </div>
    </div>
  )
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const ai = msg.role === "ai"
  return (
    <div style={{ display: "flex", justifyContent: ai ? "flex-start" : "flex-end" }}>
      <div style={{
        maxWidth: "80%",
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 13.5,
        lineHeight: 1.55,
        background: ai ? "var(--surface)" : "var(--accent)",
        color: ai ? "var(--ink)" : "var(--accent-ink)",
        border: ai ? "1px solid var(--border)" : "none",
        borderBottomLeftRadius: ai ? 3 : 12,
        borderBottomRightRadius: ai ? 12 : 3,
      }}>
        {ai ? <Markdown text={msg.text || "▋"} /> : <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>}
      </div>
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n")
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flush = (key: number) => {
    if (!list.length) return
    blocks.push(<ul key={`ul-${key}`} style={{ margin: "4px 0", paddingLeft: 18 }}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>)
    list = []
  }
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (/^[-•]\s+/.test(t)) list.push(t.replace(/^[-•]\s+/, ""))
    else { flush(i); if (t) blocks.push(<p key={`p-${i}`} style={{ margin: "2px 0" }}>{inline(t)}</p>) }
  })
  flush(lines.length)
  return <>{blocks}</>
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "0.9em", background: "var(--surface-inset)", padding: "1px 4px", borderRadius: 3 }}>{part.slice(1, -1)}</code>
    return <span key={i}>{part}</span>
  })
}
