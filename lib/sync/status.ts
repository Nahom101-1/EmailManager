/** True when a provider/sync error means "retry sync", not "fix credentials". */
export function isInterruptedSyncError(message: string | null | undefined): boolean {
  if (!message) return false
  return /interrupted|timed out|process exited/i.test(message)
}
