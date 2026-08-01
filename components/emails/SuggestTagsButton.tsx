"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Icon } from "@/components/ui"

export function SuggestTagsButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function run() {
    setPending(true)
    try {
      await fetch("/api/providers/tags/suggest", { method: "POST" })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button className="btn sm ghost" disabled={pending} onClick={run}>
      <Icon name="bolt" size={14} />
      {pending ? "Suggesting…" : "Suggest AI tags"}
    </button>
  )
}
