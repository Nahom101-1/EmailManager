import Link from "next/link"
import { connection } from "next/server"
import { Btn, Card, Icon } from "@/components/ui"
import { AccountsBrowser } from "@/components/accounts/AccountsBrowser"
import { getLocalUserId, listAccounts, listProviders } from "@/lib/db/local"
import { listAccountGroups } from "@/lib/identity/groups"

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ inbox?: string }>
}) {
  await connection()
  const sp = await searchParams
  const userId = getLocalUserId()
  const accounts = listAccounts(userId)
  const groups = listAccountGroups(userId)
  const inboxes = listProviders(userId).map((p) => p.email)
  const active = accounts.filter((a) => a.status === "active").length
  const review = accounts.filter((a) => a.status === "unknown").length
  const ignored = accounts.filter((a) => a.status === "ignore").length
  const multi = groups.filter((g) => g.multiInbox).length

  if (accounts.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Accounts</div>
            <h1 className="page-title">Accounts</h1>
            <p className="page-sub">
              Online services tied to your email addresses, discovered from sign-ins, receipts, and
              alerts.
            </p>
          </div>
        </div>
        <Card>
          <div className="empty">
            <span className="ico">
              <Icon name="accounts" size={22} />
            </span>
            <h4>No accounts discovered yet</h4>
            <p>
              Accounts appear here after you sync an inbox. LifeOS reads sign-in alerts, receipts,
              and welcome emails to map where you have accounts.
            </p>
            <div className="btn-row mt14" style={{ justifyContent: "center" }}>
              <Link href="/inbox-sync">
                <Btn variant="primary" icon="refresh">
                  Go to sync
                </Btn>
              </Link>
              <Link href="/connect">
                <Btn icon="connect">Connect inbox</Btn>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const stats = [
    { l: "Total discovered", v: accounts.length, ic: "accounts" },
    { l: "Active", v: active, ic: "check" },
    { l: "Needs review", v: review, ic: "flag", warn: true },
    { l: "Multi-inbox", v: multi, ic: "layers" },
    { l: "Ignored", v: ignored, ic: "archive" },
  ]

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Accounts</div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-sub">
            Online services tied to your email addresses. Grouped view merges the same company across
            inboxes.
          </p>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(stats.length, 5)},1fr)`,
          marginBottom: 16,
        }}
      >
        {stats.map((s) => (
          <Card key={s.l} className="stat">
            <span className="label">
              <Icon name={s.ic} size={13} />
              {s.l}
            </span>
            <span className="val" style={s.warn && s.v > 0 ? { color: "var(--st-warn)" } : {}}>
              {s.v}
            </span>
          </Card>
        ))}
      </div>

      <AccountsBrowser
        accounts={accounts}
        groups={groups}
        inboxes={inboxes}
        initialInbox={sp.inbox && inboxes.includes(sp.inbox) ? sp.inbox : "all"}
      />
    </div>
  )
}
