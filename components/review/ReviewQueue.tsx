"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Btn, Conf, Icon } from "@/components/ui"
import { useSync } from "@/components/shell/SyncProvider"

export type ReviewItem = {
  id: string
  kind: "account" | "subscription"
  title: string
  hypothesis: string
  evidence: string[]
  confidence: number | null
  href: string
  status: string
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const router = useRouter()
  const { toast } = useSync()
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState(false)
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set())

  const remaining = useMemo(
    () => items.filter((i) => !doneIds.has(`${i.kind}:${i.id}`)),
    [items, doneIds]
  )
  const safeIndex = remaining.length === 0 ? 0 : Math.min(index, remaining.length - 1)
  const current = remaining[safeIndex] ?? null
  const position = remaining.length === 0 ? 0 : safeIndex + 1

  async function patch(item: ReviewItem, status: string, label: string) {
    setPending(true)
    try {
      const url =
        item.kind === "account"
          ? `/api/accounts/${item.id}`
          : `/api/subscriptions/${item.id}`
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("patch failed")
      toast(label, "ok")
      // Keep index; removing current shifts the next item into place.
      setDoneIds((prev) => new Set(prev).add(`${item.kind}:${item.id}`))
      router.refresh()
    } catch {
      toast("Could not save correction", "err")
    } finally {
      setPending(false)
    }
  }

  function skip(item: ReviewItem, label: string) {
    toast(label, "ok")
    setDoneIds((prev) => new Set(prev).add(`${item.kind}:${item.id}`))
  }

  if (items.length === 0) {
    return (
      <div className="digest-row">
        <Icon name="check" size={15} style={{ color: "var(--st-active)" }} />
        <span>Nothing in the review queue. New uncertain detections will land here after sync.</span>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="digest-row">
        <Icon name="check" size={15} style={{ color: "var(--st-active)" }} />
        <span>
          Queue cleared for now ({doneIds.size} handled).{" "}
          <button
            type="button"
            className="btn ghost xs"
            onClick={() => {
              setDoneIds(new Set())
              setIndex(0)
            }}
          >
            Reset session
          </button>
        </span>
      </div>
    )
  }

  const confPct =
    current.confidence == null
      ? null
      : current.confidence <= 1
        ? current.confidence * 100
        : current.confidence

  return (
    <div className="review-queue">
      <div className="review-progress">
        <span>
          {position} of {remaining.length} remaining
        </span>
        <span className="muted">
          {doneIds.size} done this session · seconds-per-item
        </span>
      </div>

      <article className="focus-card review-card">
        <p className="page-eyebrow">{current.kind === "account" ? "Account" : "Subscription"}</p>
        <h2 className="focus-card-title" style={{ fontSize: 18, marginTop: 4 }}>
          LifeOS thinks: {current.hypothesis}
        </h2>
        <p className="focus-card-explain" style={{ marginTop: 8 }}>
          {current.title}
        </p>

        <div className="review-evidence">
          <div className="focus-card-why-label">Evidence</div>
          {current.evidence.length > 0 ? (
            <ul>
              {current.evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Thin evidence — treat as uncertain, not proof.
            </p>
          )}
        </div>

        <div className="focus-card-meta">
          {confPct != null && (
            <span>
              Confidence: <Conf value={confPct} showLabel />
            </span>
          )}
          <Link href={current.href} className="focus-card-evidence">
            Open record ▸
          </Link>
        </div>

        <div className="review-actions">
          <Btn
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() =>
              patch(
                current,
                "active",
                current.kind === "account" ? "Marked still active" : "Marked active paid plan"
              )
            }
          >
            Still active
          </Btn>
          <Btn
            size="sm"
            disabled={pending}
            onClick={() =>
              patch(
                current,
                current.kind === "account" ? "ignore" : "ignored",
                "Marked incorrect / ignore"
              )
            }
          >
            Correct
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              skip(
                current,
                "Kept separate — org match never merges accounts"
              )
            }
          >
            Different account
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => skip(current, "Left as uncertain")}
          >
            Not sure
          </Btn>
        </div>
      </article>
    </div>
  )
}
