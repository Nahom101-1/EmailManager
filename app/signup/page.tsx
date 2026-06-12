"use client"

import { useState } from "react"
import Link from "next/link"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    window.localStorage.setItem("lifeos.localEmail", email)
    window.localStorage.setItem("lifeos.localPasswordSet", String(Boolean(password)))
    setDone(true)
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: "#fafaf8" }}>
        <div className="glass-strong rounded-3xl p-10 shadow-float text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-jet rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafaf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-jet mb-3" style={{ fontWeight: 800 }}>Local profile ready</h2>
          <p className="text-neutral text-sm leading-relaxed">This workspace is ready for <span className="text-jet font-600">{email}</span></p>
          <Link href="/dashboard" className="btn-primary mt-6 w-full">
            Open dashboard →
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "#fafaf8" }}>
      <svg className="absolute top-0 left-0 w-96 h-96 animate-blob opacity-40 pointer-events-none" viewBox="0 0 200 200" fill="none">
        <path d="M47.1,-57.1C60.5,-46.3,70.5,-31.4,72.8,-15.4C75.2,0.7,69.8,17.9,61.2,33.1C52.6,48.4,40.8,61.7,25.6,68.8C10.4,75.9,-8.3,76.8,-24.8,70.7C-41.4,64.6,-55.8,51.4,-64.9,35.2C-74,19,-77.8,0,-73.7,-17.2C-69.6,-34.3,-57.5,-49.5,-43,-59.4C-28.4,-69.3,-11.4,-73.8,3.5,-78C18.4,-82.1,33.7,-67.9,47.1,-57.1Z" fill="#eae9e7" transform="translate(100 100)" />
      </svg>

      <div className="w-full max-w-sm relative z-10 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl text-jet mb-2" style={{ fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
            LifeOS
          </h1>
          <p className="text-neutral text-sm font-medium">Create your account</p>
        </div>

        <div className="glass-strong rounded-3xl p-8 shadow-float">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-600 text-neutral uppercase tracking-widest mb-2">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-600 text-neutral uppercase tracking-widest mb-2">Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min. 8 characters" />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Creating account..." : "Create account →"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-jet font-600 hover:underline underline-offset-2">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
