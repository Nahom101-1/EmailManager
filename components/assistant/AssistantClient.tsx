"use client"

import { useEffect, useRef, useState } from "react"
import { Btn, Card, Icon } from "@/components/ui"
import type { AiScopeId } from "@/lib/db/local"
import type { BriefItem, Briefing } from "@/lib/ai/context"

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
  greeting,
  initialSummary,
  briefing,
  scopeMeta,
  initialScopes,
  initialCloudEnabled,
  cloudConfigured,
  suggestedPrompts,
}: Props) {
  const [scopes, setScopes] = useState(initialScopes)
  const [cloudEnabled, setCloudEnabled] = useState(initialCloudEnabled)
  const [summary, setSummary] = useState(initialSummary)
  const [briefBusy, setBriefBusy] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const live = cloudConfigured && cloudEnabled

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [msgs, busy])

  async function persistAi(next: {
    cloudAiEnabled?: boolean
    scopes?: Partial<Record<AiScopeId, boolean>>
  }) {
    try {
      await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
    } catch {
      /* local-first: ignore */
    }
  }

  function toggleScope(id: AiScopeId) {
    const next = { ...scopes, [id]: !scopes[id] }
    setScopes(next)
    persistAi({ scopes: { [id]: next[id] } })
  }

  function toggleCloud() {
    const next = !cloudEnabled
    setCloudEnabled(next)
    persistAi({ cloudAiEnabled: next })
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput("")
    const history = msgs.map((m) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }))
    setMsgs((m) => [...m, { role: "user", text: q }])
    setBusy(true)
    // Add placeholder AI message so the bubble appears immediately
    setMsgs((m) => [...m, { role: "ai", text: "" }])

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", message: q, history }),
      })

      // Non-streaming fallback (live: false)
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const data = await res.json()
        setMsgs((m) => [
          ...m.slice(0, -1),
          { role: "ai", text: data.text ?? "Something went wrong." },
        ])
        return
      }

      // SSE streaming
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
                copy[copy.length - 1] = {
                  role: "ai",
                  text: (copy[copy.length - 1]?.text ?? "") + evt.text,
                }
                return copy
              })
            } else if (evt.type === "error") {
              setMsgs((m) => [
                ...m.slice(0, -1),
                { role: "ai", text: evt.text ?? "Something went wrong." },
              ])
            }
            // "done" and "progress" events: no action needed
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setMsgs((m) => [
        ...m.slice(0, -1),
        { role: "ai", text: "I couldn't reach the assistant just now. Try again." },
      ])
    } finally {
      setBusy(false)
    }
  }

  async function regenerate() {
    setBriefBusy(true)
    let accumulated = ""
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "briefing" }),
      })

      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const data = await res.json()
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
            if (evt.type === "delta" && evt.text) {
              accumulated += evt.text
              setSummary(accumulated)
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      /* keep existing summary */
    } finally {
      setBriefBusy(false)
    }
  }

  return (
    <div className="page fade-in" style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Assistant</div>
          <h1 className="page-title">Your briefing</h1>
          <p className="page-sub">
            A direct read on your digital life — what needs you, what can wait, what to ignore.
          </p>
        </div>
        <AccessControl
          scopeMeta={scopeMeta}
          scopes={scopes}
          cloudEnabled={cloudEnabled}
          cloudConfigured={cloudConfigured}
          onToggleScope={toggleScope}
          onToggleCloud={toggleCloud}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.15fr 1fr", alignItems: "start" }}>
        {/* briefing column */}
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card
            className="card-pad"
            style={{ borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border))" }}
          >
            <div className="between">
              <div className="center gap8">
                <Icon name="bolt" size={15} style={{ color: "var(--accent)" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{greeting}</span>
              </div>
              <Btn
                variant="ghost"
                size="xs"
                icon={briefBusy ? undefined : "refresh"}
                disabled={briefBusy}
                onClick={regenerate}
              >
                {briefBusy ? "Thinking…" : "Regenerate"}
              </Btn>
            </div>
            <p style={{ marginTop: 11, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
              {summary}
            </p>
            <div className="center gap6 wrap mt14">
              <span className="chip" style={{ height: 24 }}>
                <Icon name="mail" size={12} />
                {briefing.newSinceLast} new
              </span>
              <span className="chip" style={{ height: 24 }}>
                <Icon name="flag" size={12} />
                {briefing.needsReply} need review
              </span>
              <span className="chip" style={{ height: 24 }}>
                <Icon name="bolt" size={12} />
                {briefing.inboxLoad} load
              </span>
            </div>
          </Card>

          <BriefColumn title="Deal with first" tone="warn" icon="flag" items={briefing.dealFirst} />
          <BriefColumn title="Can wait" tone="sync" icon="clock" items={briefing.canWait} />
          <BriefColumn
            title="Safe to ignore"
            tone="idle"
            icon="archive"
            items={briefing.ignore}
            muted
          />
        </div>

        {/* chat column */}
        <Card
          style={{
            display: "flex",
            flexDirection: "column",
            height: 620,
            position: "sticky",
            top: 0,
            overflow: "hidden",
          }}
        >
          <div className="card-head">
            <h3 className="center gap8">
              <Icon name="bolt" size={14} style={{ color: "var(--accent)" }} />
              Ask LifeOS
            </h3>
            <span className={"badge " + (live ? "active" : "idle")}>
              <span className="dot" />
              {live ? "Live" : "Demo"}
            </span>
          </div>
          <div
            ref={bodyRef}
            className="scroll"
            style={{
              flex: 1,
              padding: "16px var(--pad-card)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {msgs.length === 0 && (
              <div style={{ margin: "auto 0", textAlign: "center", color: "var(--ink-3)" }}>
                <span
                  className="mono-tile"
                  style={{ margin: "0 auto 12px", width: 40, height: 40, color: "var(--accent)" }}
                >
                  <Icon name="bolt" size={18} />
                </span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
                  Ask about anything in your inbox
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Triage, subscriptions, accounts, what to ignore.
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {busy && (
              <div
                className="center gap8"
                style={{ color: "var(--ink-3)", fontSize: 12.5, padding: "2px 4px" }}
              >
                <span
                  className="dot pulse"
                  style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }}
                />
                LifeOS is thinking…
              </div>
            )}
          </div>
          {msgs.length === 0 && (
            <div className="center gap6 wrap" style={{ padding: "0 var(--pad-card) 10px" }}>
              {suggestedPrompts.slice(0, 4).map((p) => (
                <button
                  key={p}
                  className="chip btn-chip"
                  style={{ fontSize: 11.5 }}
                  onClick={() => send(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              padding: "12px var(--pad-card)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              className="input"
              placeholder="Ask anything about your inbox…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Btn
              variant="primary"
              icon="send"
              disabled={busy || !input.trim()}
              onClick={() => send()}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

function AccessControl({
  scopeMeta,
  scopes,
  cloudEnabled,
  cloudConfigured,
  onToggleScope,
  onToggleCloud,
}: {
  scopeMeta: ScopeMeta[]
  scopes: Record<AiScopeId, boolean>
  cloudEnabled: boolean
  cloudConfigured: boolean
  onToggleScope: (id: AiScopeId) => void
  onToggleCloud: () => void
}) {
  const [open, setOpen] = useState(false)
  const onCount = scopeMeta.filter((s) => scopes[s.id]).length

  return (
    <div style={{ position: "relative" }}>
      <button className="btn sm" onClick={() => setOpen((o) => !o)}>
        <Icon name="shield" size={14} style={{ color: "var(--accent)" }} />
        Cloud AI · {onCount}/{scopeMeta.length} sources
        <Icon name="chevD" size={13} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div
            className="card"
            style={{
              position: "absolute",
              right: 0,
              top: 40,
              zIndex: 31,
              width: 320,
              boxShadow: "var(--shadow-pop)",
              overflow: "hidden",
            }}
          >
            <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="center gap8" style={{ fontWeight: 650, fontSize: 13 }}>
                <Icon name="shield" size={15} style={{ color: "var(--accent)" }} />
                What the assistant can see
              </div>
              <p className="row-sub" style={{ marginTop: 5, lineHeight: 1.45 }}>
                Opt-in. The assistant only reads the sources you enable — processed in the cloud,
                never stored.
              </p>
            </div>
            <div className="list-row" style={{ padding: "11px 16px" }}>
              <div style={{ flex: 1 }}>
                <div className="row-title" style={{ fontSize: 12.5 }}>
                  Cloud AI
                </div>
                <div className="row-sub">
                  {cloudConfigured ? "Live answers from Claude" : "No API key — Demo answers only"}
                </div>
              </div>
              <button className={"switch" + (cloudEnabled ? " on" : "")} onClick={onToggleCloud} />
            </div>
            <div
              className="list"
              style={{
                opacity: cloudEnabled ? 1 : 0.55,
                pointerEvents: cloudEnabled ? "auto" : "none",
              }}
            >
              {scopeMeta.map((s) => (
                <div key={s.id} className="list-row" style={{ padding: "11px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div className="row-title" style={{ fontSize: 12.5 }}>
                      {s.label}
                    </div>
                    <div className="row-sub">{s.desc}</div>
                  </div>
                  <button
                    className={"switch" + (scopes[s.id] ? " on" : "")}
                    onClick={() => onToggleScope(s.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BriefColumn({
  title,
  tone,
  icon,
  items,
  muted,
}: {
  title: string
  tone: string
  icon: string
  items: BriefItem[]
  muted?: boolean
}) {
  return (
    <Card>
      <div className="card-head" style={{ padding: "11px var(--pad-card)" }}>
        <h3 className="center gap8" style={{ fontSize: 12.5 }}>
          <span
            className="badge"
            style={{ background: `var(--st-${tone}-bg)`, color: `var(--st-${tone})`, height: 19 }}
          >
            <Icon name={icon} size={11} />
          </span>
          {title}
        </h3>
        <span className="badge idle">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="card-pad muted" style={{ fontSize: 12 }}>
          Nothing here right now.
        </div>
      ) : (
        <div className="list">
          {items.map((it, i) => (
            <div key={i} className="list-row" style={{ padding: "10px var(--pad-card)" }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid var(--border-strong)",
                  flex: "none",
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  className="row-title"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 550,
                    color: muted ? "var(--ink-2)" : "var(--ink)",
                  }}
                >
                  {it.t}
                </div>
                <div className="row-sub mono">{it.meta}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const ai = msg.role === "ai"
  const common: React.CSSProperties = {
    maxWidth: "88%",
    padding: "10px 13px",
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.5,
    background: ai ? "var(--surface-inset)" : "var(--accent)",
    color: ai ? "var(--ink)" : "var(--accent-ink)",
    border: ai ? "1px solid var(--border)" : "0",
    borderBottomLeftRadius: ai ? 3 : 12,
    borderBottomRightRadius: ai ? 12 : 3,
  }
  return (
    <div style={{ display: "flex", justifyContent: ai ? "flex-start" : "flex-end" }}>
      {ai ? (
        <div className="bubble-md" style={common}>
          <Markdown text={msg.text} />
        </div>
      ) : (
        <div style={{ ...common, whiteSpace: "pre-wrap" }}>{msg.text}</div>
      )}
    </div>
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n")
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flush = (key: number) => {
    if (!list.length) return
    blocks.push(
      <ul key={`ul-${key}`}>
        {list.map((li, i) => (
          <li key={i}>{inline(li)}</li>
        ))}
      </ul>
    )
    list = []
  }
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (/^[-•]\s+/.test(t)) list.push(t.replace(/^[-•]\s+/, ""))
    else {
      flush(i)
      if (t) blocks.push(<p key={`p-${i}`}>{inline(t)}</p>)
    }
  })
  flush(lines.length)
  return <>{blocks}</>
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>
    return <span key={i}>{part}</span>
  })
}
