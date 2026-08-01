import Link from "next/link"
import { connection } from "next/server"
import { Badge, Btn, Icon, Tile, fmt, monogram } from "@/components/ui"
import { HomeThemeToggle } from "@/components/home/HomeThemeToggle"
import { getDashboardStats, getLocalUserId, listSubscriptions, type LocalSubscription } from "@/lib/db/local"

type SubRow = LocalSubscription & { amount?: number | null; billing_cycle?: string | null }

export default async function Home() {
  await connection()
  const userId = getLocalUserId()
  const stats = getDashboardStats(userId)
  const subs = listSubscriptions(userId) as SubRow[]
  const monthly = subs
    .filter((s) => s.status === "active" && s.amount != null)
    .reduce((t, s) => t + (s.billing_cycle === "yearly" ? (s.amount ?? 0) / 12 : s.amount ?? 0), 0)

  const previewStats = [
    { l: "Inboxes", v: String(stats.providerCount), ic: "mail" },
    { l: "Subscriptions", v: String(stats.subscriptionCount), ic: "subs" },
    { l: "Accounts found", v: String(stats.accountCount), ic: "accounts" },
    { l: "Monthly spend", v: monthly > 0 ? "$" + Math.round(monthly) : "—", ic: "receipt" },
  ]

  return (
    <div className="home fade-in">
      <div className="home-bar">
        <div className="center">
          <span className="brand-mark"><Icon name="layers" size={17} /></span>
          <span className="brand-name">Life<b>OS</b></span>
        </div>
        <div className="btn-row">
          <HomeThemeToggle />
          <Link href="/connect"><Btn variant="ghost" size="sm">Connect inbox</Btn></Link>
          <Link href="/dashboard"><Btn variant="primary" size="sm" iconR="chevR">Open dashboard</Btn></Link>
        </div>
      </div>

      <div className="home-wrap">
        <div>
          <Badge outline style={{ marginBottom: 22 }}><Icon name="lock" size={12} />&nbsp;Local-first</Badge>
          <h1 className="home-promise">Map your digital life<br />from your <span className="hl">inbox</span>.</h1>
          <p className="home-lede">Connect your email and LifeOS surfaces the subscriptions, accounts, and recurring charges attached to your digital life — quietly, on your own machine.</p>
          <div className="home-cta">
            <Link href="/dashboard"><Btn variant="primary" iconR="chevR">Open dashboard</Btn></Link>
            <Link href="/connect"><Btn icon="connect">Connect inbox</Btn></Link>
          </div>
          <div className="home-trust">
            <Icon name="shield" size={14} /> Your data stays on your machine. Read-only access, no servers.
          </div>
        </div>

        <div className="preview-card">
          <div className="card-head" style={{ padding: "12px 16px" }}>
            <div className="center"><Icon name="dashboard" size={14} className="muted" /><span style={{ fontWeight: 650, fontSize: 13 }}>Dashboard preview</span></div>
            <Badge tone="active" dot pulse>Live</Badge>
          </div>
          <div style={{ padding: 16 }}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {previewStats.map((s) => (
                <div key={s.l} className="card" style={{ padding: 13 }}>
                  <div className="stat" style={{ padding: 0, gap: 6 }}>
                    <span className="label"><Icon name={s.ic} size={13} />{s.l}</span>
                    <span className="val" style={{ fontSize: 21 }}>{s.v}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card mt14" style={{ overflow: "hidden" }}>
              <div className="list">
                {subs.slice(0, 3).map((s) => (
                  <div key={s.id} className="list-row" style={{ padding: "9px 13px" }}>
                    <Tile mono={monogram(s.company)} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row-title" style={{ fontSize: 12.5 }}>{s.company}</div>
                      <div className="row-sub mono">{s.category ?? "recurring"}</div>
                    </div>
                    {s.amount != null ? (
                      <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>${fmt(s.amount)}<span className="faint">/mo</span></span>
                    ) : (
                      <span className="badge idle" style={{ height: 18 }}>{s.status}</span>
                    )}
                  </div>
                ))}
                {subs.length === 0 && (
                  <div className="list-row" style={{ padding: "12px 13px" }}>
                    <span className="row-sub">Connect an inbox to see detected subscriptions here.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
