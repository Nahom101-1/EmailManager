"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AtSign, ChevronDown, ChevronUp, Mail, SlidersHorizontal, Wifi, WifiOff } from "lucide-react"

interface ImapFormData {
  email: string
  username: string
  password: string
  host: string
  port: number
  tls: boolean
}

const KNOWN_HOSTS: Record<string, { host: string; port: number; tls: boolean; requiresUsername?: boolean; usernameHint?: string }> = {
  "domeneshop.no": {
    host: "imap.domeneshop.no",
    port: 993,
    tls: true,
    requiresUsername: true,
    usernameHint: "Domeneshop uses the mailbox username, for example mittnavn1, not the email address.",
  },
  "berhane.no": {
    host: "imap.domeneshop.no",
    port: 993,
    tls: true,
    requiresUsername: true,
    usernameHint: "Domeneshop uses the mailbox username, for example berhane1, not the email address.",
  },
  "gmail.com":     { host: "imap.gmail.com",      port: 993, tls: true },
  "outlook.com":   { host: "outlook.office365.com", port: 993, tls: true },
  "hotmail.com":   { host: "outlook.office365.com", port: 993, tls: true },
  "yahoo.com":     { host: "imap.mail.yahoo.com",   port: 993, tls: true },
}

const PROVIDER_PRESETS = [
  {
    id: "google",
    label: "Gmail IMAP",
    icon: AtSign,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    hint: "Manual Gmail IMAP requires a Google app password. Use the Google OAuth card above when possible.",
  },
  {
    id: "domeneshop",
    label: "Domeneshop",
    icon: Mail,
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
  const [form, setForm] = useState<ImapFormData>({ email: "", username: "", password: "", host: "", port: 993, tls: true })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [presetHint, setPresetHint] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [testOk, setTestOk] = useState(false)

  function handleEmailChange(email: string) {
    setForm((f) => {
      const detected = detectHost(email)
      return { ...f, email, host: detected?.host ?? f.host, port: detected?.port ?? f.port, tls: detected?.tls ?? f.tls }
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
    const requiresMailboxUsername = form.host === "imap.domeneshop.no"
    if (requiresMailboxUsername && !form.username.trim()) {
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
    const requiresMailboxUsername = form.host === "imap.domeneshop.no"
    if (requiresMailboxUsername && !form.username.trim()) {
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
  const canSubmit = !!form.email && !!form.password && !!form.host && !isLoading && (!requiresMailboxUsername || !!form.username.trim())

  return (
    <div className="glass-strong rounded-3xl p-8 shadow-float">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDER_PRESETS.map((preset) => {
              const Icon = preset.icon
              const active = form.host === preset.host

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`h-12 rounded-2xl border text-sm font-600 transition-all flex items-center justify-center gap-2 ${
                    active
                      ? "bg-jet text-cream border-jet shadow-float"
                      : "bg-white/60 text-neutral border-black/[.08] hover:bg-white hover:text-jet"
                  }`}
                >
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.6} />
                  {preset.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setShowAdvanced(true)
                setPresetHint("Enter the IMAP host, port, and SSL/TLS setting from your email provider.")
              }}
              className="h-12 rounded-2xl border border-black/[.08] bg-white/60 text-sm font-600 text-neutral transition-all flex items-center justify-center gap-2 hover:bg-white hover:text-jet"
            >
              <SlidersHorizontal size={16} strokeWidth={1.6} />
              Custom
            </button>
          </div>
          {presetHint && (
            <p className="text-neutral-light text-xs mt-2 font-medium leading-5">
              {presetHint}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">Email address</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="nahom@berhane.no"
            className="input"
          />
          {form.host && (
            <p className="text-neutral-light text-xs mt-1.5 font-medium">
              Detected: {form.host}:{form.port}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="App password or email password"
            className="input"
          />
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral hover:text-jet transition-colors"
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Advanced settings
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <div>
              <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">
                IMAP username
                <span className="normal-case ml-1 text-neutral-light">
                  {usesGoogle ? "(not needed for Google)" : "(leave blank to use email)"}
                </span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={usesGoogle ? "Uses email address automatically" : "e.g. berhane1"}
                className="input"
              />
              {detected?.requiresUsername && (
                <p className="text-neutral-light text-xs mt-1.5 font-medium">
                  {detected.usernameHint}
                </p>
              )}
              {usesGoogle && (
                <p className="text-neutral-light text-xs mt-1.5 font-medium">
                  Google uses your full email address as the IMAP username, so this can stay blank.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">IMAP server</label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="imap.domeneshop.no"
                className="input"
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral uppercase tracking-widest mb-2">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  className="input"
                />
              </div>
              <div className="flex items-center gap-2.5 pb-3">
                <input
                  type="checkbox"
                  id="tls"
                  checked={form.tls}
                  onChange={(e) => setForm((f) => ({ ...f, tls: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="tls" className="text-sm font-medium text-jet">SSL/TLS</label>
              </div>
            </div>
          </div>
        )}

        {/* Status message */}
        {message && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
            status === "error" ? "bg-red-50 text-red-600" :
            testOk ? "bg-emerald-50 text-emerald-700" :
            "bg-blue-50 text-blue-700"
          }`}>
            {status === "error" ? <WifiOff size={16} /> : <Wifi size={16} />}
            {message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isLoading || !form.email || !form.password}
            className="btn-ghost flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "testing" ? "Testing..." : "Test connection"}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary flex-1"
          >
            {status === "connecting" ? "Connecting..." : "Connect account →"}
          </button>
        </div>
      </form>
    </div>
  )
}
