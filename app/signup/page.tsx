"use client"

import { useState } from "react"
import Link from "next/link"
import { Btn, Card, Field, Icon } from "@/components/ui"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    window.localStorage.setItem("lifeos.localEmail", email)
    window.localStorage.setItem("lifeos.localPasswordSet", String(Boolean(password)))
    setDone(true)
  }

  if (done) {
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
        <Card
          className="card-pad fade-in"
          style={{ maxWidth: 360, width: "100%", textAlign: "center" }}
        >
          <span
            className="mono-tile lg"
            style={{
              margin: "0 auto 16px",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              border: 0,
            }}
          >
            <Icon name="check" size={22} />
          </span>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Local profile ready</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            This workspace is ready for{" "}
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{email}</span>
          </p>
          <Link href="/dashboard" style={{ display: "block", marginTop: 16 }}>
            <Btn variant="primary" iconR="chevR">
              Open dashboard
            </Btn>
          </Link>
        </Card>
      </main>
    )
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
      <div style={{ width: "100%", maxWidth: 360 }} className="fade-in">
        <div className="center" style={{ justifyContent: "center", marginBottom: 22 }}>
          <span className="brand-mark">
            <Icon name="layers" size={17} />
          </span>
          <span className="brand-name" style={{ fontSize: 18 }}>
            Life<b>OS</b>
          </span>
        </div>
        <Card className="card-pad">
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>
            Create your profile
          </h1>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>
            A local-only workspace on this machine.
          </p>
          <form onSubmit={handleSubmit} className="grid" style={{ gap: 14 }}>
            <Field label="Email">
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </Field>
            <Btn type="submit" variant="primary" disabled={loading} iconR="chevR">
              {loading ? "Creating…" : "Create account"}
            </Btn>
          </form>
          <p className="muted" style={{ textAlign: "center", fontSize: 12.5, marginTop: 16 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
