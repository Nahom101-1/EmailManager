"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Btn, Card, Field, Icon } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    window.localStorage.setItem("lifeos.localEmail", email)
    window.localStorage.setItem("lifeos.localPasswordSet", String(Boolean(password)))
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)" }}>
      <div style={{ width: "100%", maxWidth: 360 }} className="fade-in">
        <div className="center" style={{ justifyContent: "center", marginBottom: 22 }}>
          <span className="brand-mark"><Icon name="layers" size={17} /></span>
          <span className="brand-name" style={{ fontSize: 18 }}>Life<b>OS</b></span>
        </div>
        <Card className="card-pad">
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.02em" }}>Welcome back</h1>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>Open your local workspace.</p>
          <form onSubmit={handleSubmit} className="grid" style={{ gap: 14 }}>
            <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Password"><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
            <Btn type="submit" variant="primary" disabled={loading} iconR="chevR">{loading ? "Opening…" : "Open local workspace"}</Btn>
          </form>
          <p className="muted" style={{ textAlign: "center", fontSize: 12.5, marginTop: 16 }}>
            Local development mode.{" "}
            <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 600 }}>Create profile</Link>
          </p>
        </Card>
      </div>
    </main>
  )
}
