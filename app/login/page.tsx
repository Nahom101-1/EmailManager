"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Btn, Card, Field, Icon } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    // APP_SECRET not set means local dev with no auth — just go in
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push("/dashboard")
      router.refresh()
    } else if (res.status === 503) {
      // Server not configured — dev mode, pass through
      router.push("/dashboard")
    } else {
      setError("Wrong password. Try again.")
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 340 }} className="fade-in">
        <div className="center" style={{ justifyContent: "center", marginBottom: 22 }}>
          <span className="brand-mark">
            <Icon name="layers" size={17} />
          </span>
          <span className="brand-name" style={{ fontSize: 18 }}>
            Life<b>OS</b>
          </span>
        </div>
        <Card className="card-pad">
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Welcome back</h1>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>
            Enter your password to open your workspace.
          </p>
          <form onSubmit={handleSubmit} className="grid" style={{ gap: 14 }}>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {error && (
              <p style={{ fontSize: 12.5, color: "var(--st-warn)", margin: 0 }}>{error}</p>
            )}
            <Btn type="submit" variant="primary" disabled={loading} iconR="chevR">
              {loading ? "Checking…" : "Enter"}
            </Btn>
          </form>
        </Card>
      </div>
    </main>
  )
}
