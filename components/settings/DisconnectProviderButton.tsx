"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Btn } from "@/components/ui"

export function DisconnectProviderButton({
  providerId,
  email,
}: {
  providerId: string
  email: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function disconnect() {
    setBusy(true)
    try {
      await fetch(`/api/providers/${providerId}`, { method: "DELETE" })
      router.refresh()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="btn-row">
        <Btn size="sm" variant="danger" disabled={busy} onClick={disconnect}>
          {busy ? "Removing…" : `Remove ${email}`}
        </Btn>
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Btn>
      </div>
    )
  }

  return (
    <Btn size="sm" variant="ghost" icon="trash" onClick={() => setConfirming(true)}>
      Disconnect
    </Btn>
  )
}
