"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ALL_NAV } from "@/components/shell/nav"

/** Desktop go-to chords from UI_UX_SPEC §15 (`g t`, `g m`, …) plus `?` help. */
export function KeyboardNav({
  onOpenPalette,
  onOpenHelp,
}: {
  onOpenPalette: () => void
  onOpenHelp: () => void
}) {
  const router = useRouter()
  const awaitingG = useRef(false)
  const clearTimer = useRef<number | null>(null)
  const [chord, setChord] = useState<string | null>(null)

  useEffect(() => {
    function reset() {
      awaitingG.current = false
      setChord(null)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "?") {
        e.preventDefault()
        onOpenHelp()
        return
      }
      if (e.key === "/") {
        e.preventDefault()
        onOpenPalette()
        return
      }

      if (awaitingG.current) {
        const key = e.key.toLowerCase()
        const match = ALL_NAV.find((n) => n.goKey === key)
        reset()
        if (match) {
          e.preventDefault()
          router.push(match.href)
        }
        return
      }

      if (e.key.toLowerCase() === "g") {
        e.preventDefault()
        awaitingG.current = true
        setChord("g …")
        clearTimer.current = window.setTimeout(reset, 1500)
      }
    }

    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (clearTimer.current) window.clearTimeout(clearTimer.current)
    }
  }, [onOpenHelp, onOpenPalette, router])

  if (!chord) return null
  return (
    <div className="key-chord" role="status" aria-live="polite">
      {chord}
    </div>
  )
}
