import Link from "next/link"
import { ArrowRight, Inbox, Search, ShieldCheck } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-cream px-6 py-8 text-jet">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="font-display text-2xl font-800 tracking-tight">
          LifeOS
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost !px-5 !py-2.5 !text-sm">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn-primary !px-5 !py-2.5 !text-sm">
            Open app
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-6xl items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-3xl opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-neutral">
            Personal operations
          </p>
          <h1 className="font-display text-6xl text-jet sm:text-7xl lg:text-8xl" style={{ fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.86 }}>
            Your digital life, organized.
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-neutral">
            Connect your inboxes, uncover subscriptions, and map the accounts attached to your email.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="btn-primary gap-2">
              Open dashboard
              <ArrowRight size={17} strokeWidth={2.3} />
            </Link>
            <Link href="/connect" className="btn-ghost">
              Connect inbox
            </Link>
          </div>
        </div>

        <div className="grid gap-4 opacity-0 animate-fade-up delay-100" style={{ animationFillMode: "forwards" }}>
          {[
            { icon: Inbox, label: "Inbox connections", value: "IMAP ready" },
            { icon: Search, label: "Discovery", value: "Subscriptions and accounts" },
            { icon: ShieldCheck, label: "Control", value: "Private local workspace" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="glass-strong rounded-3xl p-6 shadow-float">
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-jet text-cream">
                <Icon size={22} strokeWidth={1.7} />
              </div>
              <p className="text-xs font-medium uppercase tracking-widest text-neutral">{label}</p>
              <p className="mt-2 font-display text-3xl text-jet" style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 0.95 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
