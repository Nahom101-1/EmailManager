"use client"

import { Btn } from "@/components/ui"
import { useSync, type SyncTarget } from "@/components/shell/SyncProvider"

export function SyncButton({
  target,
  size = "xs",
  label = "Sync",
}: {
  target: SyncTarget
  size?: "" | "sm" | "xs"
  label?: string
}) {
  const { startSync } = useSync()
  return (
    <Btn size={size} icon="refresh" onClick={() => startSync([target])}>
      {label}
    </Btn>
  )
}

export function SyncAllButton({
  targets,
  size = "",
  variant = "",
  children = "Sync all",
}: {
  targets: SyncTarget[]
  size?: "" | "sm" | "xs"
  variant?: "" | "primary" | "ghost" | "danger"
  children?: React.ReactNode
}) {
  const { startSync, toast } = useSync()
  return (
    <Btn
      size={size}
      variant={variant}
      icon="refresh"
      onClick={() =>
        targets.length
          ? startSync(targets, "All active inboxes")
          : toast("No active inboxes to sync", "err")
      }
    >
      {children}
    </Btn>
  )
}
