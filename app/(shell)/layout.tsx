import { connection } from "next/server"
import { AppShell } from "@/components/shell/AppShell"
import { getLocalUserId, listAccounts, listProviders, listSubscriptions } from "@/lib/db/local"
import { monogram } from "@/components/ui"

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  await connection()
  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const counts = {
    subs: listSubscriptions(userId).length,
    accounts: listAccounts(userId).length,
  }

  const primary = providers[0]
  const account = {
    name: primary?.display_name ?? primary?.email ?? "Local user",
    sub: `${providers.length} ${providers.length === 1 ? "inbox" : "inboxes"} · local`,
    initials: monogram(primary?.display_name ?? primary?.email ?? "LO"),
  }

  return (
    <AppShell counts={counts} account={account}>
      {children}
    </AppShell>
  )
}
