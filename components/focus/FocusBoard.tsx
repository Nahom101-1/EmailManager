"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FocusCard, type FocusCardModel } from "@/components/focus/FocusCard"
import { Icon } from "@/components/ui"
import { useSync } from "@/components/shell/SyncProvider"

export type FocusBoardSection = {
  id: string
  label: string
  items: FocusCardModel[]
  defaultOpen?: boolean
}

function typingTarget(el: EventTarget | null): boolean {
  const target = el as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target.isContentEditable)
  )
}

export function FocusBoard({
  sections,
  emptyMessage = "Nothing in this queue right now.",
}: {
  sections: FocusBoardSection[]
  emptyMessage?: string
}) {
  const router = useRouter()
  const { toast } = useSync()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const s of sections) init[s.id] = s.defaultOpen !== false
    return init
  })
  const [selected, setSelected] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [snoozed, setSnoozed] = useState<Set<string>>(() => new Set())
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())

  const flat = useMemo(() => {
    const out: { sectionId: string; item: FocusCardModel }[] = []
    for (const s of sections) {
      if (openSections[s.id] === false) continue
      for (const item of s.items) {
        if (snoozed.has(item.id)) continue
        out.push({ sectionId: s.id, item })
      }
    }
    return out
  }, [sections, openSections, snoozed])

  const safeSelected = flat.length === 0 ? 0 : Math.min(selected, flat.length - 1)
  const current = flat[safeSelected] ?? null

  useEffect(() => {
    const id = current?.item.id
    if (!id) return
    cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [current?.item.id])

  const openItem = useCallback(
    (item: FocusCardModel) => {
      router.push(item.primaryAction?.href ?? item.evidenceHref ?? "/review")
    },
    [router]
  )

  const selectFirstInSection = useCallback(
    (sectionId: string) => {
      const nextOpen = { ...openSections, [sectionId]: true }
      setOpenSections(nextOpen)
      let n = 0
      for (const s of sections) {
        if (s.id === sectionId) {
          setSelected(n)
          return
        }
        if (nextOpen[s.id] === false) continue
        n += s.items.filter((it) => !snoozed.has(it.id)).length
      }
    },
    [sections, openSections, snoozed]
  )

  const jumpSection = useCallback(
    (dir: -1 | 1) => {
      const ids = sections.map((s) => s.id)
      const curId = current?.sectionId ?? ids[0]
      const idx = Math.max(0, ids.indexOf(curId))
      let next = idx + dir
      while (next >= 0 && next < ids.length) {
        const sid = ids[next]
        const hasItems = sections[next].items.some((i) => !snoozed.has(i.id))
        if (hasItems) {
          selectFirstInSection(sid)
          return
        }
        next += dir
      }
    },
    [sections, current?.sectionId, snoozed, selectFirstInSection]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (typingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault()
        setSelected((i) => Math.min(Math.max(0, flat.length - 1), i + 1))
        return
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault()
        setSelected((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === "e") {
        e.preventDefault()
        if (!current) return
        setExpandedId((id) => (id === current.item.id ? null : current.item.id))
        return
      }
      if (e.key === "s") {
        e.preventDefault()
        if (!current) return
        setSnoozed((prev) => new Set(prev).add(current.item.id))
        toast("Snoozed for this session (not persisted yet)", "ok")
        return
      }
      if (e.key === "r") {
        e.preventDefault()
        if (!current) return
        openItem(current.item)
        return
      }
      if (e.key === "[") {
        e.preventDefault()
        jumpSection(-1)
        return
      }
      if (e.key === "]") {
        e.preventDefault()
        jumpSection(1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flat.length, current, openItem, jumpSection, toast])

  const totalAll = sections.reduce((n, s) => n + s.items.length, 0)
  if (totalAll === 0) {
    return <div className="digest-row">{emptyMessage}</div>
  }

  return (
    <div className="focus-board" role="listbox" aria-label="Focus items">
      <div className="focus-kbd-hint" aria-label="Keyboard shortcuts for Focus">
        <span>
          <kbd>j</kbd>/<kbd>k</kbd> move
        </span>
        <span>
          <kbd>e</kbd> expand
        </span>
        <span>
          <kbd>s</kbd> snooze
        </span>
        <span>
          <kbd>r</kbd> open
        </span>
        <span>
          <kbd>[</kbd>/<kbd>]</kbd> section
        </span>
        {flat.length > 0 && (
          <span className="muted">
            {safeSelected + 1}/{flat.length}
          </span>
        )}
      </div>

      {sections.map((section) => {
        const visibleItems = section.items.filter((i) => !snoozed.has(i.id))
        const open = openSections[section.id] !== false
        return (
          <section
            key={section.id}
            className="focus-section"
            data-focus-section={section.id}
            aria-labelledby={`focus-sec-${section.id}`}
          >
            <button
              type="button"
              className="focus-section-head"
              id={`focus-sec-${section.id}`}
              aria-expanded={open}
              onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !open }))}
            >
              <Icon name={open ? "chevD" : "chevR"} size={14} />
              <span className="focus-section-label">{section.label}</span>
              <span className="focus-section-count">{visibleItems.length}</span>
            </button>
            {open && (
              <div className="focus-section-body">
                {visibleItems.length === 0 ? (
                  <div className="digest-row">No items in this section.</div>
                ) : (
                  visibleItems.map((item) => {
                    const idx = flat.findIndex((f) => f.item.id === item.id)
                    const isSelected = idx === safeSelected
                    return (
                      <div
                        key={item.id}
                        ref={(el) => {
                          if (el) cardRefs.current.set(item.id, el)
                          else cardRefs.current.delete(item.id)
                        }}
                        className={"focus-card-wrap" + (isSelected ? " selected" : "")}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          if (idx >= 0) setSelected(idx)
                        }}
                      >
                        <FocusCard
                          item={item}
                          selected={isSelected}
                          expanded={expandedId === item.id}
                          onExpandedChange={(v) => setExpandedId(v ? item.id : null)}
                          onSnooze={() => {
                            setSnoozed((prev) => new Set(prev).add(item.id))
                            toast("Snoozed for this session (not persisted yet)", "ok")
                          }}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
