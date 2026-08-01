"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Btn } from "@/components/ui"

export function ResetDataButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function reset() {
    setBusy(true)
    try {
      await fetch("/api/settings/reset", { method: "POST" })
      router.refresh()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="btn-row">
        <Btn size="sm" variant="danger" disabled={busy} onClick={reset}>
          {busy ? "Erasing…" : "Yes, erase everything"}
        </Btn>
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Btn>
      </div>
    )
  }

  return (
    <Btn size="sm" variant="danger" icon="trash" onClick={() => setConfirming(true)}>
      Clear
    </Btn>
  )
}
