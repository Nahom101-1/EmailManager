"use client"

import { AtSign, ExternalLink, ShieldCheck } from "lucide-react"

export function GoogleConnectCard({ error }: { error?: string }) {
  return (
    <div className="glass-strong rounded-3xl p-8 shadow-float">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-jet text-cream">
            <AtSign size={22} strokeWidth={1.8} />
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-neutral mb-2">Recommended</p>
          <h2 className="font-display text-3xl text-jet" style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 0.95 }}>
            Connect Google
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-600 text-emerald-700">
          <ShieldCheck size={14} strokeWidth={2} />
          OAuth
        </div>
      </div>

      <p className="mt-5 text-sm font-medium leading-6 text-neutral">
        Use Google&apos;s consent screen to connect Gmail or Google Workspace. No IMAP password or manual server settings.
      </p>

      {error && (
        <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-600">
          {error}
        </div>
      )}

      <a href="/api/google/connect" className="btn-primary mt-6 w-full gap-2">
        Connect Google
        <ExternalLink size={16} strokeWidth={2.2} />
      </a>
    </div>
  )
}
