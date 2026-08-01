"use client"

import { useState } from "react"
import { Btn, Card, Icon, Provider } from "@/components/ui"

export function GoogleConnectCard({ error }: { error?: string }) {
  const [redirecting, setRedirecting] = useState(false)

  return (
    <Card style={{ overflow: "hidden", borderColor: "color-mix(in oklab, var(--accent) 28%, var(--border))" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, padding: "var(--pad-card)", alignItems: "center" }}>
        <div className="center" style={{ gap: 14, alignItems: "flex-start" }}>
          <Provider provider="google" size="lg" />
          <div>
            <div className="center gap8">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Connect Google</h3>
              <span className="badge active">OAuth</span>
              <span className="badge outline">Recommended</span>
            </div>
            <p className="muted mt6" style={{ fontSize: 13, maxWidth: "52ch" }}>
              Use Google&apos;s consent screen — no password required. LifeOS requests <b style={{ color: "var(--ink)" }}>read-only</b> Gmail access through the Gmail API.
            </p>
            <div className="center gap12 mt10 wrap">
              <span className="center gap6 faint" style={{ fontSize: 11.5 }}><Icon name="lock" size={12} />Read-only Gmail access</span>
              <span className="center gap6 faint" style={{ fontSize: 11.5 }}><Icon name="shield" size={12} />Tokens stored locally</span>
            </div>
          </div>
        </div>
        <div style={{ alignSelf: "center" }}>
          <a href="/api/google/connect" onClick={() => setRedirecting(true)}>
            <Btn variant="primary" icon={redirecting ? undefined : "connect"} disabled={redirecting}>
              {redirecting ? "Redirecting…" : "Connect Google"}
            </Btn>
          </a>
        </div>
      </div>
      {redirecting && (
        <div className="notice info" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span className="ic"><Icon name="ext" size={16} /></span>
          <div className="body">Opening Google&apos;s consent screen. Approve <b>read-only Gmail</b> access to continue.</div>
        </div>
      )}
      {error && (
        <div className="notice err" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span className="ic"><Icon name="alert" size={16} /></span>
          <div className="body">{error}</div>
        </div>
      )}
    </Card>
  )
}
