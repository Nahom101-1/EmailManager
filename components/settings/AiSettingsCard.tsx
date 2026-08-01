"use client"

import { useState } from "react"
import { Card, Icon } from "@/components/ui"
import type { AiScopeId } from "@/lib/db/local"

interface ScopeMeta {
  id: AiScopeId
  label: string
  desc: string
}

const SCOPE_ICON: Record<AiScopeId, string> = {
  inboxes: "mail",
  subscriptions: "subs",
  accounts: "accounts",
  metadata: "tag",
  content: "eye",
}

export function AiSettingsCard({
  scopeMeta,
  initialScopes,
  initialCloudEnabled,
  cloudConfigured,
}: {
  scopeMeta: ScopeMeta[]
  initialScopes: Record<AiScopeId, boolean>
  initialCloudEnabled: boolean
  cloudConfigured: boolean
}) {
  const [scopes, setScopes] = useState(initialScopes)
  const [cloudEnabled, setCloudEnabled] = useState(initialCloudEnabled)

  async function persist(next: {
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
      /* ignore */
    }
  }

  function toggleScope(id: AiScopeId) {
    const next = { ...scopes, [id]: !scopes[id] }
    setScopes(next)
    persist({ scopes: { [id]: next[id] } })
  }

  function toggleCloud() {
    const next = !cloudEnabled
    setCloudEnabled(next)
    persist({ cloudAiEnabled: next })
  }

  return (
    <Card>
      <div className="card-head">
        <h3 className="center gap8">
          <Icon name="bolt" size={15} style={{ color: "var(--accent)" }} />
          AI assistant
        </h3>
        <span className={"badge " + (cloudEnabled ? "active" : "idle")}>
          {cloudEnabled ? "Opt-in · on" : "Off"}
        </span>
      </div>
      <div className="list">
        <div className="list-row" style={{ alignItems: "center" }}>
          <span className="mono-tile sm" style={{ color: "var(--ink-2)" }}>
            <Icon name="bolt" size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row-title" style={{ fontSize: 12.5 }}>
              Cloud AI assistant
            </div>
            <div className="row-sub">
              {cloudConfigured
                ? "Process inbox data in the cloud for live briefings and chat. Off by default."
                : "No ANTHROPIC_API_KEY set — answers run locally in Demo mode."}
            </div>
          </div>
          <button className={"switch" + (cloudEnabled ? " on" : "")} onClick={toggleCloud} />
        </div>
      </div>
      <div
        className="card-pad"
        style={{
          borderTop: "1px solid var(--border)",
          opacity: cloudEnabled ? 1 : 0.5,
          pointerEvents: cloudEnabled ? "auto" : "none",
        }}
      >
        <div className="section-label" style={{ margin: "0 0 10px" }}>
          What the assistant can see
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {scopeMeta.map((s) => (
            <div key={s.id} className="between">
              <div className="center gap10">
                <span
                  className="mono-tile sm"
                  style={{ color: scopes[s.id] ? "var(--accent)" : "var(--ink-3)" }}
                >
                  <Icon name={SCOPE_ICON[s.id]} size={13} />
                </span>
                <div>
                  <div className="row-title" style={{ fontSize: 12.5 }}>
                    {s.label}
                  </div>
                  <div className="row-sub">{s.desc}</div>
                </div>
              </div>
              <button
                className={"switch" + (scopes[s.id] ? " on" : "")}
                onClick={() => toggleScope(s.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
