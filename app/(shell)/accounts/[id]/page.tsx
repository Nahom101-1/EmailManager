import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Card, Icon, StatusBadge, Tile, monogram } from "@/components/ui"
import { AccountActions } from "@/components/accounts/AccountActions"
import { AccountNotes } from "@/components/accounts/AccountNotes"
import { getAccountById, getAccountNote, getLocalUserId, listSubscriptions } from "@/lib/db/local"
import { findAccountSiblings } from "@/lib/identity/groups"

function fmtDate(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const userId = getLocalUserId()
  const account = getAccountById(id, userId)
  if (!account) notFound()

  const note = getAccountNote(id)
  const confidence = account.confidence != null ? Math.round(account.confidence * 100) : null
  const firstWord = account.company.toLowerCase().split(/\s+/)[0]
  const related = listSubscriptions(userId).filter(
    (s) => firstWord.length > 1 && s.company.toLowerCase().includes(firstWord)
  )
  const siblings = findAccountSiblings(id, userId)

  const evidence: Array<{ time: string; title: string; desc: string; warn?: boolean }> = []
  if (account.source_subject || account.source_snippet) {
    const warn =
      !!account.source &&
      (account.source.toLowerCase().includes("security") ||
        account.source.toLowerCase().includes("password"))
    evidence.push({
      time: fmtDate(account.last_seen),
      title: account.source_subject ?? "Detected from email",
      desc: account.source_snippet ?? account.source ?? "Matched a sign-up or security signal",
      warn,
    })
  }
  if (account.source)
    evidence.push({
      time: fmtDate(account.last_seen),
      title: account.source,
      desc: `Signal detected in ${account.provider_email ?? "your inbox"}`,
    })
  evidence.push({
    time: fmtDate(account.first_seen),
    title: "First seen",
    desc: `Earliest evidence of this account in ${account.provider_email ?? "your inbox"}`,
  })

  return (
    <div className="page fade-in" style={{ maxWidth: 1000 }}>
      <div className="crumbs mb18">
        <Link href="/accounts" className="btn ghost xs">
          <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} />
          Accounts
        </Link>
        <Icon name="chevR" size={13} />
        <span className="cur">{account.company}</span>
      </div>

      <div className="between mb18" style={{ alignItems: "flex-start" }}>
        <div className="center gap12">
          <Tile mono={monogram(account.company)} size="lg" />
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>
              {account.company}
            </h1>
            <div className="center gap8 mt6">
              <StatusBadge status={account.status} />
              {confidence != null && (
                <span className="num faint" style={{ fontSize: 12 }}>
                  {confidence}% match
                </span>
              )}
              {account.email && (
                <span className="mono faint" style={{ fontSize: 12 }}>
                  {account.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <AccountActions accountId={account.id} status={account.status} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head">
              <h3>Timeline of evidence</h3>
              <span className="sub">{evidence.length} signals</span>
            </div>
            <div className="card-pad">
              <div className="timeline">
                {evidence.map((e, i) => (
                  <div key={i} className="tl-item">
                    <span
                      className="tl-dot"
                      style={
                        e.warn
                          ? { borderColor: "var(--st-warn)", background: "var(--st-warn)" }
                          : {}
                      }
                    />
                    <div className="tl-time">{e.time}</div>
                    <div className="tl-title">{e.title}</div>
                    <div className="tl-desc">{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>User notes</h3>
            </div>
            <div className="card-pad">
              <AccountNotes accountId={account.id} initialNote={note} />
            </div>
          </Card>
        </div>

        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card className="card-pad">
            <h3 style={{ fontSize: 13, marginBottom: 4 }}>Details</h3>
            <div className="kv">
              <span className="k">Linked email</span>
              <span className="v mono" style={{ fontSize: 11.5 }}>
                {account.email ?? "—"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Source inbox</span>
              <span className="v">{account.provider_email ?? "—"}</span>
            </div>
            {siblings.length > 0 && (
              <div className="kv" style={{ alignItems: "flex-start" }}>
                <span className="k">Also found on</span>
                <span className="v" style={{ display: "grid", gap: 4 }}>
                  {siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/accounts/${s.id}`}
                      className="mono"
                      style={{ fontSize: 11.5 }}
                    >
                      {s.providerEmail ?? s.email ?? "other inbox"}
                    </Link>
                  ))}
                </span>
              </div>
            )}
            <div className="kv">
              <span className="k">First seen</span>
              <span className="v mono">{fmtDate(account.first_seen)}</span>
            </div>
            <div className="kv">
              <span className="k">Last seen</span>
              <span className="v mono">{fmtDate(account.last_seen)}</span>
            </div>
            <div className="kv">
              <span className="k">Match confidence</span>
              <span className="v">{confidence != null ? confidence + "%" : "—"}</span>
            </div>
          </Card>

          <Card className="card-pad">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Signals detected</h3>
            <div className="center gap6 wrap">
              {account.source && (
                <span className="chip" style={{ height: 24 }}>
                  <Icon name="shield" size={12} />
                  {account.source}
                </span>
              )}
              {account.domain && (
                <span className="chip" style={{ height: 24 }}>
                  <Icon name="globe" size={12} />
                  {account.domain}
                </span>
              )}
              {account.email && (
                <span className="chip" style={{ height: 24 }}>
                  <Icon name="mail" size={12} />
                  {account.email}
                </span>
              )}
              {!account.source && !account.domain && !account.email && (
                <span className="muted" style={{ fontSize: 12 }}>
                  No additional signals captured.
                </span>
              )}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Related subscriptions</h3>
            </div>
            {related.length ? (
              <div className="list">
                {related.map((s) => (
                  <Link key={s.id} href="/subscriptions" className="list-row click">
                    <Tile mono={monogram(s.company)} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div className="row-title" style={{ fontSize: 12.5 }}>
                        {s.company}
                      </div>
                    </div>
                    <span className="row-sub mono">{s.category ?? "recurring"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card-pad muted" style={{ fontSize: 12.5 }}>
                No linked subscriptions detected.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
