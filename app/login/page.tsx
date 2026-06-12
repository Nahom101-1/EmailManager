"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "#fafaf8" }}>
      {/* Background blobs */}
      <svg className="absolute top-0 right-0 w-96 h-96 animate-blob opacity-50 pointer-events-none" viewBox="0 0 200 200" fill="none">
        <path d="M47.1,-57.1C60.5,-46.3,70.5,-31.4,72.8,-15.4C75.2,0.7,69.8,17.9,61.2,33.1C52.6,48.4,40.8,61.7,25.6,68.8C10.4,75.9,-8.3,76.8,-24.8,70.7C-41.4,64.6,-55.8,51.4,-64.9,35.2C-74,19,-77.8,0,-73.7,-17.2C-69.6,-34.3,-57.5,-49.5,-43,-59.4C-28.4,-69.3,-11.4,-73.8,3.5,-78C18.4,-82.1,33.7,-67.9,47.1,-57.1Z" fill="#eae9e7" transform="translate(100 100)" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-80 h-80 animate-float-slow opacity-40 pointer-events-none" viewBox="0 0 200 200" fill="none">
        <path d="M44.3,-50.4C56.3,-40.1,63.8,-24.2,65.5,-7.4C67.2,9.4,63.1,27.2,53.5,41.2C43.9,55.2,28.8,65.4,11.2,70.2C-6.4,75,-26.6,74.4,-42.3,65.3C-58,56.2,-69.2,38.7,-71.6,20.3C-74,1.9,-67.6,-17.3,-57.5,-31.7C-47.3,-46.2,-33.3,-55.8,-18.5,-63.5C-3.7,-71.2,11.9,-76.9,26.6,-73.3C41.3,-69.6,32.2,-60.8,44.3,-50.4Z" fill="#f0efed" transform="translate(100 100)" />
      </svg>

      <div className="w-full max-w-sm relative z-10 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl text-jet mb-2" style={{ fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
            LifeOS
          </h1>
          <p className="text-neutral text-sm font-medium">Welcome back</p>
        </div>

        <div className="glass-strong rounded-3xl p-8 shadow-float">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-600 text-neutral uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-neutral uppercase tracking-widest mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Opening..." : "Open local workspace →"}
            </button>
          </form>

          <p className="text-center text-sm text-neutral mt-6">
            Local development mode.{" "}
            <Link href="/signup" className="text-jet font-600 hover:underline underline-offset-2">
              Create profile
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
