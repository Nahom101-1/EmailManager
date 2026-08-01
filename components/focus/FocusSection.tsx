"use client"

import { useState, type ReactNode } from "react"
import { Icon } from "@/components/ui"

export function FocusSection({
  id,
  label,
  count,
  defaultOpen = true,
  children,
}: {
  id: string
  label: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="focus-section" aria-labelledby={`section-${id}`}>
      <button
        type="button"
        className="focus-section-head"
        id={`section-${id}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "chevD" : "chevR"} size={14} />
        <span className="focus-section-label">{label}</span>
        {count != null && <span className="focus-section-count">{count}</span>}
      </button>
      {open && <div className="focus-section-body">{children}</div>}
    </section>
  )
}
