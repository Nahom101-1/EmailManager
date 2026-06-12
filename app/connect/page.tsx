import { NavDock } from "@/components/NavDock"
import { GoogleConnectCard } from "@/components/providers/GoogleConnectCard"
import { ImapConnectForm } from "@/components/providers/ImapConnectForm"

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen" style={{ background: "#fafaf8" }}>
      <NavDock />
      <main className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        <div className="mb-10 opacity-0 animate-fade-up" style={{ animationFillMode: "forwards" }}>
          <p className="text-neutral text-sm font-medium mb-2 uppercase tracking-widest">Connect</p>
          <h1 className="font-display text-5xl text-jet" style={{ fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}>
            Add your<br />inbox.
          </h1>
        </div>
        <div className="space-y-5 opacity-0 animate-fade-up delay-100" style={{ animationFillMode: "forwards" }}>
          <GoogleConnectCard error={error} />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-black/[.06]" />
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-light">Manual IMAP</span>
            <div className="h-px flex-1 bg-black/[.06]" />
          </div>
          <ImapConnectForm />
        </div>
      </main>
    </div>
  )
}
