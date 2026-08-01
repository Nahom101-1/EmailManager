"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Btn, Icon } from "@/components/ui"

export interface SyncTarget {
  id: string
  email: string
}

interface ToastItem {
  id: number
  msg: string
  kind?: "ok" | "err"
  sub?: string
}

interface SyncResult {
  listed: number
  stored: number
  subscriptionsDetected: number
  accountsDetected: number
  embedded: number
  backlogRemaining: number
  historySynced: number
  historyTarget: number
  historyComplete: boolean
  rounds: number
}

interface SyncContextValue {
  startSync: (targets: SyncTarget[], label?: string) => void
  toast: (msg: string, kind?: "ok" | "err", sub?: string) => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

const STEPS = [
  { k: "token", label: "Refreshing token" },
  { k: "fetch", label: "Fetching messages" },
  { k: "store", label: "Storing metadata" },
  { k: "detect", label: "Detecting subscriptions" },
]

const MAX_AUTO_ROUNDS = 12
const BACKOFF_MS = 600

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [sync, setSync] = useState<{ targets: SyncTarget[]; label: string } | null>(null)
  const tid = useRef(0)

  const toast = useCallback((msg: string, kind?: "ok" | "err", sub?: string) => {
    const id = ++tid.current
    setToasts((l) => [...l, { id, msg, kind, sub }])
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3200)
  }, [])

  const startSync = useCallback((targets: SyncTarget[], label?: string) => {
    if (targets.length === 0) {
      toast("No inboxes to sync", "err")
      return
    }
    setSync({ targets, label: label ?? (targets.length === 1 ? targets[0].email : `${targets.length} inboxes`) })
  }, [toast])

  const close = useCallback(() => {
    setSync(null)
    router.refresh()
  }, [router])

  return (
    <SyncContext.Provider value={{ startSync, toast }}>
      {children}
      {sync && <SyncModal targets={sync.targets} label={sync.label} onClose={close} onToast={toast} />}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className={"t-ic " + (t.kind === "err" ? "err" : "ok")}>
              <Icon name={t.kind === "err" ? "alert" : "check"} size={13} />
            </span>
            <div className="t-body">
              <div className="tt">{t.msg}</div>
              {t.sub && <div className="ts">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </SyncContext.Provider>
  )
}

function SyncModal({
  targets,
  label,
  onClose,
  onToast,
}: {
  targets: SyncTarget[]
  label: string
  onClose: () => void
  onToast: (msg: string, kind?: "ok" | "err", sub?: string) => void
}) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [errored, setErrored] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [progressLabel, setProgressLabel] = useState("Starting…")
  const cancelRef = useRef(false)
  const [result, setResult] = useState<SyncResult>({
    listed: 0,
    stored: 0,
    subscriptionsDetected: 0,
    accountsDetected: 0,
    embedded: 0,
    backlogRemaining: 0,
    historySynced: 0,
    historyTarget: 2000,
    historyComplete: true,
    rounds: 0,
  })

  const cancel = useCallback(() => {
    cancelRef.current = true
    setCancelled(true)
  }, [])

  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    ;[700, 1500, 2300].forEach((ms, i) => {
      timers.push(setTimeout(() => alive && setStep(i + 1), ms))
    })

    ;(async () => {
      const agg: SyncResult = {
        listed: 0,
        stored: 0,
        subscriptionsDetected: 0,
        accountsDetected: 0,
        embedded: 0,
        backlogRemaining: 0,
        historySynced: 0,
        historyTarget: 2000,
        historyComplete: true,
        rounds: 0,
      }
      let anyError = false
      let allHistoryComplete = true

      // Per-target auto-continue while history incomplete or intel backlog remains.
      for (const target of targets) {
        if (cancelRef.current || !alive) break

        let needMore = true
        let rounds = 0
        let targetHistoryComplete = false
        let backlog = 0

        while (needMore && rounds < MAX_AUTO_ROUNDS) {
          if (cancelRef.current || !alive) break
          rounds += 1
          agg.rounds += 1
          if (alive) {
            setProgressLabel(
              rounds === 1
                ? `Syncing ${target.email}…`
                : `Continuing ${target.email} (round ${rounds})…`
            )
          }

          try {
            const res = await fetch(`/api/providers/${target.id}/sync`, { method: "POST" })
            const data = await res.json()
            if (!res.ok) {
              anyError = true
              needMore = false
              allHistoryComplete = false
              continue
            }
            agg.listed += data.listed ?? 0
            agg.stored += data.stored ?? 0
            agg.subscriptionsDetected += data.subscriptionsDetected ?? 0
            agg.accountsDetected += data.accountsDetected ?? 0
            agg.embedded += data.intelligence?.embedded ?? 0
            backlog = data.intelligence?.backlogRemaining ?? 0
            agg.backlogRemaining = backlog
            targetHistoryComplete = Boolean(data.history?.complete)
            if (data.history) {
              agg.historySynced = Math.max(agg.historySynced, data.history.synced ?? 0)
              agg.historyTarget = data.history.target ?? agg.historyTarget
            }
            needMore = !targetHistoryComplete || backlog > 0
            if (alive) {
              setResult({
                ...agg,
                historyComplete: targetHistoryComplete && backlog === 0,
              })
            }
            if (needMore && !cancelRef.current) {
              await delay(BACKOFF_MS)
            }
          } catch {
            anyError = true
            needMore = false
            allHistoryComplete = false
          }
        }

        if (!targetHistoryComplete || backlog > 0) allHistoryComplete = false
      }

      agg.historyComplete = !cancelRef.current && allHistoryComplete && agg.backlogRemaining === 0
      if (cancelRef.current) agg.historyComplete = false

      if (!alive) return
      timers.forEach(clearTimeout)
      setResult(agg)
      setErrored(anyError)
      setStep(STEPS.length)
      setDone(true)
      if (cancelRef.current) {
        onToast("Sync paused", "ok", "Resume anytime — progress is saved")
      } else if (anyError) {
        onToast("Some inboxes failed to sync", "err")
      } else {
        const hist = agg.historyComplete
          ? `${agg.stored} stored`
          : `${agg.historySynced.toLocaleString()} / ${agg.historyTarget.toLocaleString()} history`
        const intel =
          agg.backlogRemaining > 0
            ? ` · ${agg.embedded} indexed (${agg.backlogRemaining} queued)`
            : ` · ${agg.embedded} indexed`
        onToast("Sync complete", "ok", `${hist}${intel}`)
      }
    })()

    return () => {
      alive = false
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-scrim" onClick={done ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mono-tile sm" style={{ color: "var(--accent)" }}>
            <Icon name={done ? (errored ? "alert" : cancelled ? "pause" : "check") : "sync"} size={15} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: 13.5 }}>
              {done
                ? errored
                  ? "Sync finished with errors"
                  : cancelled
                    ? "Sync paused"
                    : "Sync complete"
                : "Syncing inbox"}
            </div>
            <div className="row-sub mono">{done ? label : progressLabel}</div>
          </div>
          {done ? (
            <button className="btn ghost icon sm" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          ) : (
            <button className="btn ghost sm" onClick={cancel} type="button">
              Cancel
            </button>
          )}
        </div>

        <div className="modal-body">
          {!done ? (
            <div className="steps">
              {STEPS.map((s, i) => (
                <div key={s.k} className={"step " + (i < step ? "done" : i === step ? "active" : "")}>
                  <span className="sdot">
                    {i < step ? <Icon name="check" size={11} /> : i === step ? <span className="spin" /> : null}
                  </span>
                  {s.label}
                </div>
              ))}
              {result.rounds > 1 && (
                <div className="notice" style={{ marginTop: 12, padding: "8px 10px" }}>
                  <div className="body" style={{ fontSize: 12 }}>
                    Auto-continuing · round {result.rounds}
                    {!result.historyComplete
                      ? ` · ${result.historySynced.toLocaleString()} / ${result.historyTarget.toLocaleString()} emails`
                      : ""}
                    {result.backlogRemaining > 0
                      ? ` · ${result.backlogRemaining.toLocaleString()} to index`
                      : ""}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { l: "Messages scanned", v: result.listed },
                  { l: "Stored", v: result.stored },
                  { l: "Subscriptions", v: result.subscriptionsDetected },
                  { l: "Accounts", v: result.accountsDetected },
                ].map((r) => (
                  <div key={r.l} className="card" style={{ padding: 13, background: "var(--surface-inset)" }}>
                    <div className="stat" style={{ padding: 0, gap: 4 }}>
                      <span className="label">{r.l}</span>
                      <span className="val" style={{ fontSize: 22 }}>{r.v.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="notice" style={{ marginTop: 12, padding: "10px 12px" }}>
                <div className="body" style={{ fontSize: 12.5 }}>
                  History: {result.historySynced.toLocaleString()} / {result.historyTarget.toLocaleString()}
                  {result.historyComplete ? " · complete" : " · more remains — sync again to continue"}
                  {result.backlogRemaining > 0
                    ? ` · intelligence backlog ${result.backlogRemaining.toLocaleString()}`
                    : ""}
                  {result.rounds > 1 ? ` · ${result.rounds} rounds` : ""}
                </div>
              </div>
            </>
          )}
        </div>

        {done && (
          <div className="modal-foot">
            <span className="faint mono center" style={{ fontSize: 11, marginRight: "auto" }}>
              <Icon name="clock" size={12} />&nbsp;Last synced just now
            </span>
            {!result.historyComplete || result.backlogRemaining > 0 ? (
              <Btn
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose()
                  // Parent refresh; user can hit Sync again — auto-loop will resume.
                }}
              >
                Done
              </Btn>
            ) : (
              <Link href="/subscriptions" onClick={onClose}>
                <Btn size="sm" variant="ghost">View subscriptions</Btn>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error("useSync must be used within SyncProvider")
  return ctx
}
