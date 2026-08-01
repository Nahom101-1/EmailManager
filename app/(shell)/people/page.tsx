import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon } from "@/components/ui"
import { getLocalUserId, listProviders, reclaimStaleSyncRuns } from "@/lib/db/local"
import { listAccountGroups } from "@/lib/identity/groups"
import { listEmailsByIntents, listTopSenders } from "@/lib/db/email-signals"

export default async function PeoplePage() {
  await connection()
  reclaimStaleSyncRuns()
  const userId = getLocalUserId()
  const providers = listProviders(userId)

  if (providers.length === 0) {
    return (
      <div className="page page-wide fade-in">
        <p className="page-eyebrow">People</p>
        <h1 className="page-title">People</h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Relationships and communication patterns across mailboxes.
        </p>
        <Link href="/connect">
          <Btn variant="primary" icon="connect">
            Connect a mailbox
          </Btn>
        </Link>
      </div>
    )
  }

  const senders = listTopSenders({ userId, limit: 36 })
  const needsReply = listEmailsByIntents(["needs_reply"], { userId, limit: 20 })
  const maybeNeedReply = senders.filter((s) => s.needsReplyCount > 0)
  const orgGroups = listAccountGroups(userId).filter((g) => g.multiInbox).slice(0, 12)

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">People</p>
          <h1 className="page-title">People</h1>
          <p className="page-sub">
            Built from synced senders and needs_reply intents — not a full identity graph. No reply
            found is not proof you ignored someone.
          </p>
        </div>
        <Link href="/history?audit=people">
          <Btn size="sm" variant="ghost">
            History audit
          </Btn>
        </Link>
      </div>

      <section className="focus-section">
        <div className="focus-section-head" style={{ cursor: "default" }}>
          <span className="focus-section-label">May need a reply</span>
          <span className="focus-section-count">{needsReply.length}</span>
          <span className="uncertain-chip">intent signals</span>
        </div>
        <div className="focus-section-body">
          {needsReply.length === 0 ? (
            <div className="digest-row">
              <span>No needs_reply classifications right now.</span>
            </div>
          ) : (
            needsReply.map((row) => (
              <Link
                key={row.emailId}
                href={`/emails/${row.emailId}`}
                className="digest-row"
                style={{ textDecoration: "none" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{row.fromAddress ?? "Unknown"}</strong>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {row.subject ?? "(no subject)"}
                    {row.uncertain ? " · uncertain" : ""}
                  </div>
                </div>
                <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)" }} />
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="focus-section">
        <div className="focus-section-head" style={{ cursor: "default" }}>
          <span className="focus-section-label">Frequent people (inbox)</span>
          <span className="focus-section-count">{senders.length}</span>
        </div>
        <div className="focus-section-body">
          {senders.length === 0 ? (
            <div className="digest-row">
              <span>Not enough sender metadata yet — run a sync.</span>
            </div>
          ) : (
            senders.slice(0, 24).map((s) => (
              <div key={s.address} className="digest-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{s.display}</strong>
                  <div className="muted mono" style={{ fontSize: 11.5, marginTop: 2 }}>
                    {s.address} · {s.count} recent
                    {s.needsReplyCount > 0 ? ` · ${s.needsReplyCount} needs_reply` : ""}
                  </div>
                </div>
                {s.sampleEmailId ? (
                  <Link href={`/emails/${s.sampleEmailId}`}>
                    <Btn size="xs" variant="ghost">
                      Open
                    </Btn>
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {maybeNeedReply.length > 0 && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>
          {maybeNeedReply.length} sender{maybeNeedReply.length === 1 ? "" : "s"} appear in both
          frequent mail and needs_reply — still not proof of an unpaid obligation.
        </p>
      )}

      <section className="focus-section">
        <div className="focus-section-head" style={{ cursor: "default" }}>
          <span className="focus-section-label">Orgs across inboxes</span>
          <span className="focus-section-count">{orgGroups.length}</span>
          <span className="uncertain-chip">not people merges</span>
        </div>
        <div className="focus-section-body">
          {orgGroups.length === 0 ? (
            <div className="digest-row">
              <span>
                No multi-inbox org groups yet. Accounts stay separate even when the company name
                matches.
              </span>
            </div>
          ) : (
            orgGroups.map((g) => (
              <Link
                key={g.key}
                href={`/accounts/${g.instances[0]?.id}`}
                className="digest-row"
                style={{ textDecoration: "none" }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{g.company}</strong>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {g.instances.length} accounts · {g.inboxes.join(" · ")}
                  </div>
                </div>
                <Icon name="chevR" size={14} style={{ color: "var(--ink-faint)" }} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
