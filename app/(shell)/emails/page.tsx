import Link from "next/link"
import { connection } from "next/server"
import { Btn, Card, Icon, StatusBadge, Tile, monogram } from "@/components/ui"
import { ProviderTagSelect } from "@/components/emails/ProviderTagSelect"
import { SuggestTagsButton } from "@/components/emails/SuggestTagsButton"
import { getLocalUserId, getProviderTag, setProviderTag, type ProviderTag } from "@/lib/db/local"
import { inboxSummary } from "@/lib/identity/groups"

function heuristicPurpose(email: string): ProviderTag["purpose"] {
  const lower = email.toLowerCase()
  if (/work|corp|company|job|office/.test(lower)) return "work"
  if (/shop|buy|deals|promo/.test(lower)) return "shopping"
  if (/gmail|icloud|yahoo|hotmail|outlook|proton|me\.com/.test(lower)) return "personal"
  return "other"
}

export default async function EmailsMapPage() {
  await connection()
  let summary = inboxSummary(getLocalUserId())
  // Seed local purpose tags so the map is useful before AI suggest runs.
  for (const row of summary.inboxes) {
    if (!getProviderTag(row.provider.id)) {
      setProviderTag(row.provider.id, {
        purpose: heuristicPurpose(row.provider.email),
        source: "ai",
      })
    }
  }
  summary = inboxSummary(getLocalUserId())

  if (summary.inboxes.length === 0) {
    return (
      <div className="page fade-in">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Emails</div>
            <h1 className="page-title">Your emails</h1>
            <p className="page-sub">
              Connect 2–4 inboxes to see which services live on which address — and what shows up
              on more than one.
            </p>
          </div>
        </div>
        <Card>
          <div className="empty">
            <span className="ico">
              <Icon name="mail" size={22} />
            </span>
            <h4>No inboxes connected</h4>
            <p>Add a Gmail or IMAP inbox to start mapping accounts across your emails.</p>
            <div className="btn-row mt14" style={{ justifyContent: "center" }}>
              <Link href="/connect">
                <Btn variant="primary" icon="connect">
                  Connect inbox
                </Btn>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page fade-in">
      <div className="page-head between" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="page-eyebrow">Emails</div>
          <h1 className="page-title">Your emails</h1>
          <p className="page-sub">
            What lives on each inbox — and services that appear on more than one address.
          </p>
        </div>
        <div className="btn-row">
          <SuggestTagsButton />
          <Link href="/connect">
            <Btn size="sm" icon="plus">
              Add inbox
            </Btn>
          </Link>
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "var(--gap)",
          marginBottom: 28,
        }}
      >
        {summary.inboxes.map(({ provider, tag, accountCount, subscriptionCount, activeSubscriptionCount }) => (
          <Card key={provider.id} className="card-pad" style={{ display: "grid", gap: 12 }}>
            <div className="between" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="row-title" style={{ fontSize: 14 }}>
                  {provider.email}
                </div>
                <div className="center gap6 mt6">
                  <StatusBadge status={provider.status} />
                  <span className="mono faint" style={{ fontSize: 11 }}>
                    {provider.type}
                  </span>
                </div>
              </div>
              <ProviderTagSelect providerId={provider.id} initial={tag} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div>
                <div className="faint" style={{ fontSize: 11 }}>
                  Accounts
                </div>
                <div className="num" style={{ fontWeight: 600 }}>
                  {accountCount}
                </div>
              </div>
              <div>
                <div className="faint" style={{ fontSize: 11 }}>
                  Subs
                </div>
                <div className="num" style={{ fontWeight: 600 }}>
                  {subscriptionCount}
                </div>
              </div>
              <div>
                <div className="faint" style={{ fontSize: 11 }}>
                  Active
                </div>
                <div className="num" style={{ fontWeight: 600 }}>
                  {activeSubscriptionCount}
                </div>
              </div>
            </div>
            <div className="btn-row">
              <Link href={`/accounts?inbox=${encodeURIComponent(provider.email)}`} className="btn sm ghost">
                Accounts
              </Link>
              <Link
                href={`/subscriptions?inbox=${encodeURIComponent(provider.email)}`}
                className="btn sm ghost"
              >
                Money
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <section style={{ marginBottom: 28 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>
          Shared across inboxes
        </div>
        {summary.sharedAccountGroups.length === 0 &&
        summary.sharedSubscriptionGroups.length === 0 ? (
          <Card className="card-pad muted" style={{ fontSize: 13 }}>
            No services detected on more than one inbox yet. After syncing multiple emails, duplicates
            like IMAX show up here.
          </Card>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {summary.sharedAccountGroups.map((g) => (
              <Card key={`a-${g.key}`} className="card-pad">
                <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div className="center gap10">
                    <Tile mono={monogram(g.company)} />
                    <div>
                      <div className="row-title">{g.company}</div>
                      <div className="row-sub">
                        Account · {g.inboxes.length} inboxes
                      </div>
                    </div>
                  </div>
                  <span className="chip" style={{ height: 22, fontSize: 11 }}>
                    <Icon name="layers" size={11} />
                    multi-inbox
                  </span>
                </div>
                <div className="center gap6 wrap mt10">
                  {g.instances.map((inst) => (
                    <Link
                      key={inst.id}
                      href={`/accounts/${inst.id}`}
                      className="chip"
                      style={{ height: 24, fontSize: 11.5, textDecoration: "none" }}
                    >
                      <Icon name="mail" size={11} />
                      {inst.providerEmail ?? inst.email ?? "inbox"}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
            {summary.sharedSubscriptionGroups.map((g) => (
              <Card key={`s-${g.key}`} className="card-pad">
                <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div className="center gap10">
                    <Tile mono={monogram(g.company)} />
                    <div>
                      <div className="row-title">{g.company}</div>
                      <div className="row-sub">
                        Subscription · {g.inboxes.length} inboxes
                      </div>
                    </div>
                  </div>
                  <span className="chip" style={{ height: 22, fontSize: 11 }}>
                    <Icon name="layers" size={11} />
                    multi-inbox
                  </span>
                </div>
                <div className="center gap6 wrap mt10">
                  {g.instances.map((inst) => (
                    <Link
                      key={inst.id}
                      href="/subscriptions"
                      className="chip"
                      style={{ height: 24, fontSize: 11.5, textDecoration: "none" }}
                    >
                      <Icon name="mail" size={11} />
                      {inst.providerEmail ?? inst.emailUsed ?? "inbox"}
                      {inst.amount != null
                        ? ` · $${inst.amount.toFixed(2)}`
                        : ""}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
