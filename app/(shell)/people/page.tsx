import Link from "next/link"
import { connection } from "next/server"
import { Btn, Icon } from "@/components/ui"
import { getLocalUserId, listProviders, reclaimStaleSyncRuns } from "@/lib/db/local"

export default async function PeoplePage() {
  await connection()
  reclaimStaleSyncRuns()
  const providers = listProviders(getLocalUserId())

  return (
    <div className="page page-wide fade-in">
      <div className="page-head">
        <div>
          <p className="page-eyebrow">People</p>
          <h1 className="page-title">People</h1>
          <p className="page-sub">
            Relationships and communication patterns across mailboxes. This surface lands with the
            identity graph — placeholders stay honest until then.
          </p>
        </div>
      </div>

      <div className="focus-card">
        <div className="focus-card-title-row">
          <h3 className="focus-card-title">People graph not built yet</h3>
          <span className="uncertain-chip">
            <Icon name="info" size={11} />
            coming later
          </span>
        </div>
        <p className="focus-card-explain">
          You will see who you owe a reply to, who you are waiting on, and org contacts — with
          evidence links, not a contact dump.
        </p>
        <div className="focus-card-actions">
          {providers.length === 0 ? (
            <Link href="/connect">
              <Btn variant="primary" size="xs" icon="connect">
                Connect a mailbox
              </Btn>
            </Link>
          ) : (
            <Link href="/assistant">
              <Btn variant="primary" size="xs" icon="bolt">
                Ask about people
              </Btn>
            </Link>
          )}
          <Link href="/history">
            <Btn size="xs" variant="ghost">
              Browse history audits
            </Btn>
          </Link>
        </div>
      </div>
    </div>
  )
}
