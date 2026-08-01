"use client"

import Link from "next/link"
import { useState } from "react"
import { Btn, Conf, Icon } from "@/components/ui"

export type FocusPriority = "high" | "medium" | "low" | "uncertain"

export type FocusCardModel = {
  id: string
  title: string
  explanation: string
  whyItMatters?: string
  deadline?: string
  mailbox?: string
  personOrOrg?: string
  evidenceCount?: number
  evidenceHref?: string
  confidence?: number
  priority?: FocusPriority
  primaryAction?: { label: string; href?: string; onClick?: () => void }
}

const PRIORITY_LABEL: Record<FocusPriority, string> = {
  high: "high",
  medium: "medium",
  low: "low",
  uncertain: "uncertain",
}

export function FocusCard({
  item,
  onSnooze,
  onDone,
  onNotForMe,
}: {
  item: FocusCardModel
  onSnooze?: () => void
  onDone?: () => void
  onNotForMe?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const priority = item.priority ?? "medium"
  const confPct =
    item.confidence == null ? null : item.confidence <= 1 ? item.confidence * 100 : item.confidence

  return (
    <article className="focus-card" aria-labelledby={`focus-${item.id}-title`}>
      <header className="focus-card-head">
        <div className="focus-card-title-row">
          <h3 id={`focus-${item.id}-title`} className="focus-card-title">
            {item.title}
          </h3>
          <span
            className={"focus-priority focus-priority-" + priority}
            title={"Priority: " + PRIORITY_LABEL[priority]}
          >
            <span className="focus-priority-mark" aria-hidden="true" />
            <span className="focus-priority-label">{PRIORITY_LABEL[priority]}</span>
          </span>
          <button
            type="button"
            className="btn ghost xs icon focus-card-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            onClick={() => setExpanded((v) => !v)}
          >
            <Icon name={expanded ? "chevUp" : "chevD"} size={14} />
          </button>
        </div>
        <p className="focus-card-explain">{item.explanation}</p>
      </header>

      {(item.whyItMatters || item.deadline || item.mailbox || item.personOrOrg) && (
        <p className="focus-card-why">
          <span className="focus-card-why-label">Why it matters:</span>{" "}
          {[
            item.deadline,
            item.mailbox ? `from ${item.mailbox}` : null,
            item.personOrOrg,
            item.whyItMatters,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="focus-card-meta">
        {item.evidenceCount != null && (
          item.evidenceHref ? (
            <Link href={item.evidenceHref} className="focus-card-evidence">
              Evidence: {item.evidenceCount} message{item.evidenceCount === 1 ? "" : "s"} ▸
            </Link>
          ) : (
            <span className="focus-card-evidence">
              Evidence: {item.evidenceCount} message{item.evidenceCount === 1 ? "" : "s"}
            </span>
          )
        )}
        {confPct != null && (
          <span className="focus-card-conf">
            Confidence: <Conf value={confPct} showLabel />
          </span>
        )}
      </div>

      {expanded && (
        <div className="focus-card-disclosure">
          <p>
            Details stay conservative: LifeOS shows supporting signals when available and leaves
            gaps explicit rather than guessing.
          </p>
          {item.confidence == null && (
            <p className="focus-card-uncertain">Confidence not estimated for this item yet.</p>
          )}
        </div>
      )}

      <div className="focus-card-actions">
        {item.primaryAction &&
          (item.primaryAction.href ? (
            <Link href={item.primaryAction.href}>
              <Btn variant="primary" size="xs">
                {item.primaryAction.label}
              </Btn>
            </Link>
          ) : (
            <Btn variant="primary" size="xs" onClick={item.primaryAction.onClick}>
              {item.primaryAction.label}
            </Btn>
          ))}
        <Btn size="xs" onClick={onSnooze} disabled={!onSnooze}>
          Snooze
        </Btn>
        <Btn size="xs" onClick={onDone} disabled={!onDone}>
          Done
        </Btn>
        <Btn size="xs" variant="ghost" onClick={onNotForMe} disabled={!onNotForMe}>
          Not for me
        </Btn>
        <Btn size="xs" variant="ghost" disabled>
          Correct…
        </Btn>
      </div>
    </article>
  )
}
