"use client"

import Link from "next/link"
import { Btn } from "@/components/ui"
import { SyncButton } from "@/components/shell/SyncButtons"
import type { SyncTarget } from "@/components/shell/SyncProvider"
import { isInterruptedSyncError } from "@/lib/sync/status"

/** Sync / Retry / Fix controls for one inbox row. */
export function InboxSyncActions({
  target,
  status,
  errorMessage,
  historyComplete,
}: {
  target: SyncTarget
  status: string
  errorMessage?: string | null
  historyComplete: boolean
}) {
  if (status === "error" && isInterruptedSyncError(errorMessage)) {
    return <SyncButton target={target} label="Retry" />
  }

  if (status === "error") {
    return (
      <Link href="/connect">
        <Btn variant="danger" size="xs" icon="alert">
          Fix
        </Btn>
      </Link>
    )
  }

  if (status === "syncing") {
    return (
      <Btn size="xs" icon="sync" disabled>
        Syncing…
      </Btn>
    )
  }

  return <SyncButton target={target} label={historyComplete ? "Sync" : "Continue"} />
}
