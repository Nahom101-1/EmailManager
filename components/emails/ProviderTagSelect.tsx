"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ProviderPurpose, ProviderTag } from "@/lib/db/local"

const OPTIONS: Array<{ value: ProviderPurpose; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
]

export function ProviderTagSelect({
  providerId,
  initial,
}: {
  providerId: string
  initial: ProviderTag | null
}) {
  const router = useRouter()
  const [purpose, setPurpose] = useState<ProviderPurpose | "">(initial?.purpose ?? "")
  const [pending, setPending] = useState(false)

  async function save(next: ProviderPurpose) {
    setPurpose(next)
    setPending(true)
    try {
      await fetch(`/api/providers/${providerId}/tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: next }),
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <select
      className="chip"
      style={{ height: 28, fontSize: 12, cursor: "var(--border)", background: "var(--surface)" }}
      value={purpose}
      disabled={pending}
      onChange={(e) => save(e.target.value as ProviderPurpose)}
      aria-label="Inbox purpose"
    >
      <option value="" disabled>
        Tag purpose
      </option>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
          {initial?.source === "ai" && initial.purpose === o.value ? " (AI)" : ""}
        </option>
      ))}
    </select>
  )
}
