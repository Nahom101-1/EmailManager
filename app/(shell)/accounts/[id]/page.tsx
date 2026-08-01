import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Btn, Card, Conf, Icon, StatusBadge, Tile, monogram } from "@/components/ui"
import { AccountActions } from "@/components/accounts/AccountActions"
import { AccountNotes } from "@/components/accounts/AccountNotes"
import {
  getAccountById,
  getAccountNote,
  getLocalUserId,
  listAccounts,
  listSubscriptions,
} from "@/lib/db/local"
import { listAccountGroups } from "@/lib/identity/groups"

function fmtDate(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function statusHint(status: string): string {
  if (status === "active") return "active"
  if (status === "closed") return "inactive"
  if (status === "ignore") return "ignored"
  return "uncertain"
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  const userId = getLocalUserId()
  const account = getAccountById(id, userId)
  if (!account) notFound()

  const note = getAccountNote(id)
  const groups = listAccountGroups(userId)
  const group = groups.find((g) => g.instances.some((i) => i.id === id))
  const siblings = group?.instances ?? [
    {
      id: account.id,
      providerId: account.provider_id,
      providerEmail: account.provider_email,
      email: account.email,
      status: account.status,
      confidence: account.confidence,
      domain: account.domain,
      firstSeen: account.first_seen,
      lastSeen: account.last_seen,
    },
  ]
  const companyName = group?.company ?? account.company

  const allAccounts = listAccounts(userId)
  const accountById = new Map(allAccounts.map((a) => [a.id, a]))

  const firstWord = companyName.toLowerCase().split(/\s+/)[0]
  const related = listSubscriptions(userId).filter(
    (s) => firstWord.length > 1 && s.company.toLowerCase().includes(firstWord)
  )

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
  if (account.source) {
    evidence.push({
      time: fmtDate(account.last_seen),
      title: account.source,
      desc: `Signal detected in ${account.provider_email ?? "your inbox"}`,
    })
  }
  evidence.push({
    time: fmtDate(account.first_seen),
    title: "First seen",
    desc: `Earliest evidence of this account in ${account.provider_email ?? "your inbox"}`,
  })

  return (
    <div className="page page-wide fade-in">
      <div className="crumbs mb18">
        <Link href="/accounts" className="btn ghost xs">
          <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} />
          Accounts
        </Link>
        <Icon name="chevR" size={13} />
        <span className="cur">{companyName}</span>
      </div>

      <div className="between mb18" style={{ alignItems: "flex-start" }}>
        <div className="center gap12">
          <Tile mono={monogram(companyName)} size="lg" />
          <div>
            <p className="page-eyebrow">Organization</p>
            <h1 className="page-title" style={{ fontSize: 24 }}>
              {companyName}
            </h1>
            <p className="page-sub" style={{ marginTop: 4 }}>
              {siblings.length} separate account{siblings.length === 1 ? "" : "s"}
              {group?.multiInbox ? " across inboxes" : ""}. Org match never merges them.
            </p>
          </div>
        </div>
        <Link href="/review">
          <Btn size="sm" variant="ghost">
            Review queue
          </Btn>
        </Link>
      </div>

      <div className="org-tree mb18" role="list" aria-label="Accounts under organization">
        {siblings.map((inst) => {
          const full = accountById.get(inst.id)
          const selected = inst.id === id
          const conf =
            inst.confidence == null
              ? null
              : inst.confidence <= 1
                ? Math.round(inst.confidence * 100)
                : Math.round(inst.confidence)
          const mailbox = inst.providerEmail ?? inst.email ?? "unknown mailbox"
          const lastYear = inst.lastSeen ? new Date(inst.lastSeen).getFullYear() : null
          const paidHint = related.find(
            (s) =>
              (s.provider_email ?? "").toLowerCase() === (inst.providerEmail ?? "").toLowerCase()
          )

          return (
            <div
              key={inst.id}
              role="listitem"
              className={"org-account" + (selected ? " on" : "")}
            >
              <div className="org-account-head">
                <Link href={`/accounts/${inst.id}`} className="org-account-title">
                  Account · {mailbox}
                </Link>
                <StatusBadge status={inst.status} />
                <span className="uncertain-chip">{statusHint(inst.status)}</span>
                {conf != null && <Conf value={conf} showLabel />}
              </div>
              <div className="org-account-body">
                <p>
                  Paid plan:{" "}
                  {paidHint
                    ? `${paidHint.status === "active" ? "signal present" : paidHint.status} · ${paidHint.company}`
                    : "no current evidence"}
                  {" · "}
                  Last activity: {lastYear ?? "unknown"}
                  {" · "}
                  Mailing:{" "}
                  {full?.source?.toLowerCase().includes("newsletter")
                    ? "possible list signal"
                    : "not assessed"}
                </p>
                <div className="focus-card-actions" style={{ borderTop: 0, paddingTop: 4 }}>
                  {full?.source_email_id ? (
                    <Link href={`/emails/${full.source_email_id}`}>
                      <Btn size="xs">Evidence ▸</Btn>
                    </Link>
                  ) : (
                    <Btn size="xs" disabled>
                      Evidence ▸
                    </Btn>
                  )}
                  {selected ? (
                    <>
                      <Link href="/review">
                        <Btn size="xs" variant="ghost">
                          Review
                        </Btn>
                      </Link>
                      <Btn size="xs" variant="ghost" disabled title="Use Review queue">
                        Correct…
                      </Btn>
                    </>
                  ) : (
                    <Link href={`/accounts/${inst.id}`}>
                      <Btn size="xs" variant="ghost">
                        Open
                      </Btn>
                    </Link>
                  )}
                </div>
              </div>
              {selected && (
                <div className="org-account-actions">
                  <AccountActions accountId={account.id} status={account.status} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head">
              <h3>Timeline of evidence</h3>
              <span className="sub">{evidence.length} signals · this account</span>
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
            <h3 style={{ fontSize: 13, marginBottom: 4 }}>Selected account</h3>
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
              <span className="v">
                {account.confidence != null ? (
                  <Conf
                    value={
                      account.confidence <= 1 ? account.confidence * 100 : account.confidence
                    }
                    showLabel
                  />
                ) : (
                  "—"
                )}
              </span>
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
                      <div className="row-sub">
                        {s.provider_email ?? "—"} · {s.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card-pad muted" style={{ fontSize: 12.5 }}>
                No linked subscription signals. Absence of payment is not proof of inactivity.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
