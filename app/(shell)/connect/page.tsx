import { connection } from "next/server"
import { Card, Icon, Provider, StatusBadge } from "@/components/ui"
import { GoogleConnectCard } from "@/components/providers/GoogleConnectCard"
import { ImapConnectForm } from "@/components/providers/ImapConnectForm"
import { DisconnectProviderButton } from "@/components/settings/DisconnectProviderButton"
import { getLocalUserId, listProviders } from "@/lib/db/local"

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await connection()
  const { error } = await searchParams
  const providers = listProviders(getLocalUserId())
  const errored = providers.filter((p) => p.status === "error")

  return (
    <div className="page fade-in" style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Connect</div>
          <h1 className="page-title">Connect an inbox</h1>
          <p className="page-sub">
            Add an email account so LifeOS can scan metadata for subscriptions and accounts.
            Read-only — your messages are never modified.
          </p>
        </div>
      </div>

      <GoogleConnectCard error={error} />

      <div className="section-label">Other methods</div>
      <ImapConnectForm />

      {providers.length > 0 && (
        <>
          <div className="section-label">Connected</div>
          <Card>
            <div className="list">
              {providers.map((ib) => (
                <div key={ib.id} className="list-row">
                  <Provider provider={ib.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="center gap8">
                      <span className="row-title ellip">{ib.email}</span>
                      <StatusBadge status={ib.status} pulse={ib.status === "syncing"} />
                    </div>
                    <div className="row-sub">
                      {ib.type.toUpperCase()} · last sync{" "}
                      <span className="mono">
                        {ib.last_sync_at ? new Date(ib.last_sync_at).toLocaleDateString() : "never"}
                      </span>
                    </div>
                  </div>
                  <DisconnectProviderButton providerId={ib.id} email={ib.email} />
                </div>
              ))}
            </div>
          </Card>

          {errored.length > 0 && (
            <div className="notice err mt14">
              <span className="ic">
                <Icon name="alert" size={18} />
              </span>
              <div className="body" style={{ flex: 1 }}>
                <b>Connection failed · {errored[0].email}</b>
                <div className="mt6">
                  {errored[0].error_message ??
                    "Authentication was rejected. The app password may have been revoked or expired."}
                </div>
                <ul style={{ margin: "8px 0 0 16px", color: "var(--ink-3)", fontSize: 12 }}>
                  <li>Generate a new app password in your provider&apos;s security settings</li>
                  <li>Confirm two-factor authentication is still enabled</li>
                  <li>Verify the IMAP server and port (993 / SSL)</li>
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
