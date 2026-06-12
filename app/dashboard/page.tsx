import Link from "next/link"
import { connection } from "next/server"
import { NavDock } from "@/components/NavDock"
import { AtSign, Mail, Plus, RefreshCw, AlertCircle } from "lucide-react"
import { getLocalUserId, listProviders } from "@/lib/db/local"

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active:   { bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-400" },
  syncing:  { bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-400" },
  pending:  { bg: "bg-amber-50",    text: "text-amber-700",   dot: "bg-amber-400" },
  error:    { bg: "bg-red-50",      text: "text-red-700",     dot: "bg-red-400" },
}

export default async function DashboardPage() {
  await connection()
  const providers = listProviders(getLocalUserId())

  const providerCount = providers?.length ?? 0

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <NavDock />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16">

        {/* Header */}
        <div className="mb-12 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <p className="text-neutral text-sm font-medium mb-2 uppercase tracking-widest">Dashboard</p>
          <h1 className="font-display text-6xl text-jet" style={{ fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.88 }}>
            Your life,<br />organized.
          </h1>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-12 opacity-0 animate-fade-up delay-100" style={{ animationFillMode: "forwards" }}>
          {[
            { label: "Accounts connected", value: providerCount },
            { label: "Emails scanned", value: "0" },
            { label: "Subscriptions found", value: "0" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-3xl p-6 shadow-float hover:shadow-float-hover transition-all duration-300 hover:-translate-y-0.5 cursor-default">
              <p className="font-display text-5xl text-jet mb-2" style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {stat.value}
              </p>
              <p className="text-neutral text-xs uppercase tracking-widest font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Providers section */}
        <div className="opacity-0 animate-fade-up delay-200" style={{ animationFillMode: "forwards" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl text-jet" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
              Email accounts
            </h2>
            <Link href="/connect" className="btn-primary !py-2.5 !px-5 !text-xs flex items-center gap-1.5">
              <Plus size={14} strokeWidth={2.5} />
              Connect
            </Link>
          </div>

          {providerCount === 0 ? (
            <div className="glass rounded-3xl p-12 shadow-float text-center border-2 border-dashed" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "#f0efed" }}>
                <Mail size={24} className="text-neutral" strokeWidth={1.5} />
              </div>
              <p className="font-display text-xl text-jet mb-1" style={{ fontWeight: 700 }}>No accounts yet</p>
              <p className="text-neutral text-sm mb-6">Connect your first inbox to get started</p>
              <Link href="/connect" className="btn-primary !py-2.5 !px-6 !text-sm">
                Connect account →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {providers!.map((p, i) => {
                const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.pending
                return (
                  <div
                    key={p.id}
                    className="glass rounded-2xl p-5 shadow-float hover:shadow-float-hover transition-all duration-300 hover:-translate-y-0.5 opacity-0 animate-fade-up"
                    style={{ animationFillMode: "forwards", animationDelay: `${300 + i * 60}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#f0efed" }}>
                          {p.status === "error"
                            ? <AlertCircle size={20} className="text-red-500" strokeWidth={1.5} />
                            : p.status === "syncing"
                            ? <RefreshCw size={20} className="text-blue-500 animate-spin" strokeWidth={1.5} />
                            : p.type === "gmail"
                            ? <AtSign size={20} className="text-neutral" strokeWidth={1.5} />
                            : <Mail size={20} className="text-neutral" strokeWidth={1.5} />
                          }
                        </div>
                        <div>
                          <p className="font-display text-base text-jet" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                            {p.display_name}
                          </p>
                          <p className="text-neutral-light text-xs font-medium mt-0.5">
                            {p.type === "gmail"
                              ? "Google OAuth · Gmail API"
                              : `${p.host}:${p.port} · ${p.type.toUpperCase()}`
                            }
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${s.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        <span className={`text-xs font-600 ${s.text}`}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
