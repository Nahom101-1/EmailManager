import { connection } from "next/server"
import { Btn, Card, Icon, Provider, StatusBadge } from "@/components/ui"
import { AppearanceCard } from "@/components/settings/AppearanceCard"
import { AiSettingsCard } from "@/components/settings/AiSettingsCard"
import { ResetDataButton } from "@/components/settings/ResetDataButton"
import { DisconnectProviderButton } from "@/components/settings/DisconnectProviderButton"
import { getAiSettings, getDbPath, getLocalUserId, listProviders } from "@/lib/db/local"
import { cloudAiConfigured } from "@/lib/ai/client"
import { AI_SCOPES } from "@/lib/ai/scopes"
import pkg from "@/package.json"

function Row({ icon, title, desc, danger, children }: { icon?: string; title: string; desc?: React.ReactNode; danger?: boolean; children?: React.ReactNode }) {
  return (
    <div className="list-row" style={{ alignItems: "center" }}>
      {icon && <span className="mono-tile sm" style={{ color: danger ? "var(--st-error)" : "var(--ink-2)" }}><Icon name={icon} size={14} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ fontSize: 12.5, color: danger ? "var(--st-error)" : "var(--ink)" }}>{title}</div>
        {desc && <div className="row-sub">{desc}</div>}
      </div>
      <div className="center gap8">{children}</div>
    </div>
  )
}

export default async function SettingsPage() {
  await connection()
  const providers = listProviders(getLocalUserId())
  const ai = getAiSettings()
  const encryptionConfigured = Boolean(process.env.ENCRYPTION_SECRET)
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "(derived from request origin)"
  const googleProvider = providers.find((p) => p.type === "gmail")
  const imapProviders = providers.filter((p) => p.type === "imap")

  return (
    <div className="page fade-in" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Settings</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage local data, security, and connected services. Everything runs on this machine.</p>
        </div>
      </div>

      <div className="grid" style={{ gap: 18 }}>
        <AppearanceCard />

        <AiSettingsCard
          scopeMeta={AI_SCOPES}
          initialScopes={ai.scopes}
          initialCloudEnabled={ai.cloudAiEnabled}
          cloudConfigured={cloudAiConfigured()}
        />

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="db" size={15} className="muted" />Local data</h3><span className="badge active"><Icon name="lock" size={11} />On this machine</span></div>
          <div className="list">
            <Row icon="db" title="Database location" desc="SQLite file storing all scanned metadata">
              <span className="mono faint" style={{ fontSize: 11.5 }}>{getDbPath()}</span>
            </Row>
            <Row icon="trash" title="Clear local data" desc="Permanently remove all scanned metadata" danger>
              <ResetDataButton />
            </Row>
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="shield" size={15} className="muted" />Security</h3></div>
          <div className="list">
            <Row icon="lock" title="Token encryption" desc={encryptionConfigured ? "Tokens encrypted at rest (AES via crypto-js)" : "Using dev fallback key — set ENCRYPTION_SECRET"}>
              <span className={"badge " + (encryptionConfigured ? "active" : "warn")}>{encryptionConfigured ? "Enabled" : "Dev key"}</span>
            </Row>
            <Row icon="key" title="Rotate local encryption secret" desc="Re-encrypt stored tokens with a new key">
              <span className="badge idle">Coming soon</span>
            </Row>
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Provider provider="google" size="sm" />Google</h3></div>
          <div className="list">
            <Row title="OAuth client" desc={googleConfigured ? "GOOGLE_CLIENT_ID / SECRET configured" : "Missing GOOGLE_CLIENT_ID / SECRET"}>
              <span className={"badge " + (googleConfigured ? "active" : "warn")}><span className="dot" />{googleConfigured ? "Configured" : "Missing"}</span>
            </Row>
            {googleProvider ? (
              <Row icon="mail" title={googleProvider.email} desc="Read-only Gmail · token stored locally">
                <StatusBadge status={googleProvider.status} />
                <DisconnectProviderButton providerId={googleProvider.id} email={googleProvider.email} />
              </Row>
            ) : (
              <Row icon="mail" title="No Google account connected" desc="Connect from the Connect page" />
            )}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="mail" size={15} className="muted" />IMAP</h3></div>
          <div className="list">
            {imapProviders.length === 0 ? (
              <Row icon="mail" title="No IMAP providers" desc="Add one from the Connect page" />
            ) : imapProviders.map((p) => (
              <Row key={p.id} icon="mail" title={p.email} desc={<span className="mono">{p.host}:{p.port} · {p.tls ? "SSL" : "plain"}</span>}>
                <StatusBadge status={p.status} />
                <DisconnectProviderButton providerId={p.id} email={p.email} />
              </Row>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="bolt" size={15} className="muted" />Developer</h3><span className="sub">Environment checks</span></div>
          <div className="card-pad grid" style={{ gap: 0 }}>
            <div className="kv"><span className="k">App version</span><span className="v mono">LifeOS v{pkg.version}</span></div>
            <div className="kv"><span className="k">Token encryption</span><span className="v"><span className={"badge " + (encryptionConfigured ? "active" : "warn")}><span className="dot" />{encryptionConfigured ? "Configured" : "Dev key"}</span></span></div>
            <div className="kv"><span className="k">Google OAuth client</span><span className="v"><span className={"badge " + (googleConfigured ? "active" : "warn")}><span className="dot" />{googleConfigured ? "Configured" : "Missing"}</span></span></div>
            <div className="kv"><span className="k">Cloud AI</span><span className="v"><span className={"badge " + (cloudAiConfigured() ? "active" : "idle")}><span className="dot" />{cloudAiConfigured() ? "Key set" : "Demo mode"}</span></span></div>
            <div className="kv"><span className="k">Google redirect URI</span><span className="v mono" style={{ fontSize: 11 }}>{redirectUri}</span></div>
            <div className="kv"><span className="k">SQLite</span><span className="v mono" style={{ fontSize: 11.5 }}>better-sqlite3 · WAL mode</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
