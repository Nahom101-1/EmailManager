"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Btn, Icon } from "@/components/ui"
import { useSync } from "@/components/shell/SyncProvider"
import type { AccountStatus } from "@/lib/db/local"

export function AccountActions({ accountId, status }: { accountId: string; status: AccountStatus }) {
  const router = useRouter()
  const { toast } = useSync()
  const [pending, setPending] = useState(false)
  const [open, setOpen] = useState(false)

  async function setStatus(next: AccountStatus, label: string) {
    setPending(true)
    setOpen(false)
    try {
      await fetch(`/api/accounts/${accountId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) })
      toast(label, "ok")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="btn-row">
      <Btn size="sm" icon="check" disabled={pending} onClick={() => setStatus("active", "Marked as keep")}>Keep</Btn>
      <Btn size="sm" variant="ghost" icon="flag" disabled={pending} onClick={() => setStatus("unknown", "Flagged for review")}>Review</Btn>
      <Btn size="sm" variant="danger" icon="cancel" disabled={pending} onClick={() => setStatus("closed", "Marked to cancel")}>Cancel</Btn>
      <div style={{ position: "relative" }}>
        <Btn size="sm" variant="ghost" icon="dots" disabled={pending} onClick={() => setOpen((o) => !o)} />
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)} />
            <div className="card" style={{ position: "absolute", right: 0, top: 32, zIndex: 21, minWidth: 168, boxShadow: "var(--shadow-pop)", padding: 5 }}>
              <button className="list-row click" style={{ width: "100%", border: 0, background: "none", padding: "7px 9px", borderRadius: "var(--radius-sm)", textAlign: "left", color: "var(--st-error)", fontSize: 12.5, gap: 9 }}
                onClick={() => setStatus("ignore", "Account ignored")}>
                <Icon name="x" size={14} style={{ color: "var(--st-error)" }} />Ignore account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
