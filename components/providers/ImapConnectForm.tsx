"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Btn, Card, Field, Icon } from "@/components/ui"

interface ImapFormData {
  email: string
  username: string
  password: string
  host: string
  port: number
  tls: boolean
}

const KNOWN_HOSTS: Record<
  string,
  { host: string; port: number; tls: boolean; requiresUsername?: boolean; usernameHint?: string }
> = {
  "domeneshop.no": {
    host: "imap.domeneshop.no",
    port: 993,
    tls: true,
    requiresUsername: true,
    usernameHint:
      "Domeneshop uses the mailbox username, for example mittnavn1, not the email address.",
  },
  "berhane.no": {
    host: "imap.domeneshop.no",
    port: 993,
    tls: true,
    requiresUsername: true,
    usernameHint:
      "Domeneshop uses the mailbox username, for example berhane1, not the email address.",
  },
  "gmail.com": { host: "imap.gmail.com", port: 993, tls: true },
  "outlook.com": { host: "outlook.office365.com", port: 993, tls: true },
  "hotmail.com": { host: "outlook.office365.com", port: 993, tls: true },
  "yahoo.com": { host: "imap.mail.yahoo.com", port: 993, tls: true },
}

const PROVIDER_PRESETS = [
  {
    id: "google",
    label: "Gmail IMAP",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    hint: "Manual Gmail IMAP requires a Google app password. Use the Google OAuth card above when possible.",
  },
  {
    id: "domeneshop",
    label: "Domeneshop",
    host: "imap.domeneshop.no",
    port: 993,
    tls: true,
    hint: "Use the mailbox username from Domeneshop, for example berhane1.",
  },
]

function detectHost(email: string) {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return null
  return KNOWN_HOSTS[domain] ?? null
}

type Status = "idle" | "testing" | "connecting" | "success" | "error"

export function ImapConnectForm({ onSuccess }: { onSuccess?: (data: unknown) => void }) {
  const router = useRouter()
  const [form, setForm] = useState<ImapFormData>({
    email: "",
    username: "",
    password: "",
    host: "",
    port: 993,
    tls: true,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [presetHint, setPresetHint] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [testOk, setTestOk] = useState(false)

  function handleEmailChange(email: string) {
    setForm((f) => {
      const detected = detectHost(email)
      return {
        ...f,
        email,
        host: detected?.host ?? f.host,
        port: detected?.port ?? f.port,
        tls: detected?.tls ?? f.tls,
      }
    })
    if (detectHost(email)?.requiresUsername) {
      setShowAdvanced(true)
      setPresetHint(detectHost(email)?.usernameHint ?? "")
    }
  }

  function applyPreset(preset: (typeof PROVIDER_PRESETS)[number]) {
    setForm((f) => ({
      ...f,
      host: preset.host,
      port: preset.port,
      tls: preset.tls,
      username: preset.id === "domeneshop" ? f.username : "",
    }))
    setPresetHint(preset.hint)
    setShowAdvanced(preset.id === "domeneshop")
    setStatus("idle")
    setMessage("")
    setTestOk(false)
  }

  async function handleTest() {
    if (form.host === "imap.domeneshop.no" && !form.username.trim()) {
      setStatus("error")
      setMessage("Domeneshop requires the mailbox username, for example berhane1.")
      setShowAdvanced(true)
      return
    }
    setStatus("testing")
    setMessage("")
    setTestOk(false)
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(data.error ?? "Connection failed")
      } else {
        setStatus("idle")
        setTestOk(true)
        setMessage(`Connected — ${data.emailCount} emails in INBOX`)
      }
    } catch {
      setStatus("error")
      setMessage("Network error — check your connection")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.host === "imap.domeneshop.no" && !form.username.trim()) {
      setStatus("error")
      setMessage("Domeneshop requires the mailbox username, for example berhane1.")
      setShowAdvanced(true)
      return
    }
    setStatus("connecting")
    setMessage("")
    try {
      const res = await fetch("/api/providers/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(data.error ?? "Failed to connect account")
      } else {
        setStatus("success")
        onSuccess?.(data)
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setStatus("error")
      setMessage("Network error")
    }
  }

  const isLoading = status === "testing" || status === "connecting"
  const detected = detectHost(form.email)
  const usesGoogle = form.host === "imap.gmail.com"
  const requiresMailboxUsername = form.host === "imap.domeneshop.no"
  const canSubmit =
    !!form.email &&
    !!form.password &&
    !!form.host &&
    !isLoading &&
    (!requiresMailboxUsername || !!form.username.trim())

  return (
    <Card>
      <div className="card-head">
        <div className="center gap8">
          <span className="mono-tile sm">
            <Icon name="mail" size={14} />
          </span>
          <h3>Manual IMAP</h3>
          <span className="badge idle">Advanced</span>
        </div>
        <span className="sub">For providers without OAuth</span>
      </div>
      <form onSubmit={handleSubmit} className="card-pad grid" style={{ gap: 16 }}>
        <Field label="Provider preset">
          <div className="btn-row">
            {PROVIDER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={"chip btn-chip" + (form.host === p.host ? " on" : "")}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="chip btn-chip"
              onClick={() => {
                setShowAdvanced(true)
                setPresetHint(
                  "Enter the IMAP host, port, and SSL/TLS setting from your email provider."
                )
              }}
            >
              Custom
            </button>
          </div>
        </Field>

        {presetHint && (
          <div
            className={"notice " + (usesGoogle ? "warn" : "info")}
            style={{ padding: "10px 13px" }}
          >
            <span className="ic">
              <Icon name={usesGoogle ? "alert" : "info"} size={15} />
            </span>
            <div className="body">
              {usesGoogle && <b>OAuth is preferred for Gmail. </b>}
              {presetHint}
            </div>
          </div>
        )}

        <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Email address">
            <input
              className="input mono"
              type="email"
              required
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
          </Field>
          <Field
            label="Password"
            hint={usesGoogle ? "Generated in your provider's security settings" : undefined}
          >
            <div style={{ position: "relative" }}>
              <input
                className="input mono"
                type={showPw ? "text" : "password"}
                required
                placeholder="••••••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                style={{ paddingRight: 38 }}
              />
              <button
                type="button"
                className="btn ghost icon sm"
                style={{ position: "absolute", right: 4, top: 3 }}
                onClick={() => setShowPw((v) => !v)}
              >
                <Icon name={showPw ? "eyeOff" : "eye"} size={15} />
              </button>
            </div>
          </Field>
        </div>

        <button
          type="button"
          className="center gap6"
          style={{
            background: "none",
            border: 0,
            color: "var(--ink-2)",
            fontWeight: 600,
            fontSize: 12.5,
            alignSelf: "flex-start",
            padding: 0,
          }}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <Icon name={showAdvanced ? "chevD" : "chevR"} size={14} /> Advanced settings
        </button>

        {showAdvanced && (
          <div
            className="card fade-in"
            style={{ background: "var(--surface-inset)", padding: "var(--pad-card)" }}
          >
            <div className="field-row" style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 0.9fr" }}>
              <Field label="IMAP username">
                <input
                  className="input mono"
                  placeholder={usesGoogle ? "Uses email" : "e.g. berhane1"}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </Field>
              <Field label="IMAP server">
                <input
                  className="input mono"
                  placeholder="imap.example.com"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </Field>
              <Field label="Port">
                <input
                  className="input mono"
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Encryption">
                <select
                  className="input"
                  value={form.tls ? "ssl" : "none"}
                  onChange={(e) => setForm((f) => ({ ...f, tls: e.target.value !== "none" }))}
                >
                  <option value="ssl">SSL / TLS</option>
                  <option value="none">None</option>
                </select>
              </Field>
            </div>
            {detected?.requiresUsername && (
              <div className="hint mt10" style={{ color: "var(--ink-3)", fontSize: 11 }}>
                <Icon name="info" size={12} /> {detected.usernameHint}
              </div>
            )}
          </div>
        )}

        <div className="between" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="center gap8">
            {testOk && (
              <span className="badge active">
                <Icon name="check" size={12} />
                {message}
              </span>
            )}
            {status === "error" && (
              <span className="badge error">
                <Icon name="x" size={12} />
                {message}
              </span>
            )}
            {status === "testing" && (
              <span className="badge sync">
                <span className="dot pulse" />
                Testing…
              </span>
            )}
            {status === "idle" && !testOk && (
              <span className="faint" style={{ fontSize: 12 }}>
                Test before connecting to verify credentials.
              </span>
            )}
          </div>
          <div className="btn-row">
            <Btn
              type="button"
              size="sm"
              icon={status === "testing" ? undefined : "bolt"}
              disabled={isLoading || !form.email || !form.password}
              onClick={handleTest}
            >
              {status === "testing" ? "Testing…" : "Test connection"}
            </Btn>
            <Btn type="submit" variant="primary" size="sm" icon="link" disabled={!canSubmit}>
              {status === "connecting" ? "Connecting…" : "Connect account"}
            </Btn>
          </div>
        </div>
      </form>
    </Card>
  )
}
