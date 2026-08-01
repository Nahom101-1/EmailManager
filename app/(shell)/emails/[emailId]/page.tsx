import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Btn, Card, Icon } from "@/components/ui"
import { getEmailById } from "@/lib/db/local"
import { getIntelligence } from "@/lib/db/intelligence"
import { detectAccount, detectSubscription } from "@/lib/detection"

const DETECTION_HEADERS = [
  "From",
  "To",
  "Subject",
  "Date",
  "List-Unsubscribe",
  "List-ID",
  "Reply-To",
  "Sender",
  "Message-ID",
]

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ emailId: string }>
}) {
  await connection()
  const { emailId } = await params
  const email = getEmailById(emailId)
  if (!email) notFound()

  const detectionInput = {
    from: email.from_address ?? undefined,
    to: email.to_address ?? undefined,
    subject: email.subject ?? undefined,
    snippet: email.snippet ?? undefined,
    labels: email.labels,
    headers: email.headers,
  }
  const subscription = detectSubscription(detectionInput)
  const account = detectAccount(detectionInput)
  const intel = getIntelligence(emailId)
  let intelReasons: string[] = []
  if (intel?.reasons) {
    try {
      intelReasons = JSON.parse(intel.reasons) as string[]
    } catch {
      intelReasons = []
    }
  }
  const reasons = Array.from(
    new Set([...(subscription?.reasons ?? []), ...(account?.reasons ?? []), ...intelReasons])
  )
  const gmailUrl = email.gmail_message_id
    ? `https://mail.google.com/mail/u/0/#all/${email.gmail_message_id}`
    : null

  return (
    <div className="page fade-in" style={{ maxWidth: 820 }}>
      <div className="crumbs mb18">
        <Link href="/subscriptions" className="btn ghost xs">
          <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} />
          Back
        </Link>
        <Icon name="chevR" size={13} />
        <span className="cur">Evidence</span>
      </div>

      <Card>
        <div
          className="card-pad"
          style={{
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span className="mono-tile lg">
            <Icon name="mail" size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="page-eyebrow">Evidence</div>
            <h1 className="page-title" style={{ fontSize: 22 }}>
              {email.subject ?? "(no subject)"}
            </h1>
          </div>
        </div>

        <div className="card-pad">
          <div className="kv">
            <span className="k">Sender</span>
            <span className="v mono" style={{ fontSize: 11.5 }}>
              {email.from_address ?? "—"}
            </span>
          </div>
          <div className="kv">
            <span className="k">To</span>
            <span className="v mono" style={{ fontSize: 11.5 }}>
              {email.to_address ?? "—"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Date</span>
            <span className="v mono" style={{ fontSize: 11.5 }}>
              {email.date ? new Date(email.date).toLocaleString() : "—"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Account</span>
            <span className="v">{email.provider_name ?? email.provider_email ?? "—"}</span>
          </div>
          <div className="kv">
            <span className="k">Gmail message ID</span>
            <span className="v mono" style={{ fontSize: 11 }}>
              {email.gmail_message_id ?? "—"}
            </span>
          </div>
          {intel && (
            <>
              <div className="kv">
                <span className="k">Intent</span>
                <span className="v">
                  {intel.intent}
                  {intel.uncertain ? " (uncertain)" : ""} ·{" "}
                  {Math.round(intel.intent_confidence * 100)}%
                </span>
              </div>
              {(intel.vendor || intel.amount != null || intel.due_date) && (
                <div className="kv">
                  <span className="k">Extracted</span>
                  <span className="v">
                    {[
                      intel.vendor,
                      intel.amount != null
                        ? `${intel.currency ?? "USD"} ${intel.amount}${intel.billing_cycle ? `/${intel.billing_cycle === "yearly" ? "yr" : "mo"}` : ""}`
                        : null,
                      intel.due_date ? `due ${intel.due_date}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
              {intel.cluster_id && (
                <div className="kv">
                  <span className="k">Cluster</span>
                  <span className="v mono" style={{ fontSize: 11 }}>
                    {intel.cluster_id}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {email.snippet && (
          <div className="card-pad" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="section-label" style={{ margin: "0 0 8px" }}>
              Snippet
            </div>
            <div className="notice">
              <div className="body">{email.snippet}</div>
            </div>
          </div>
        )}

        <div className="card-pad" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="section-label" style={{ margin: "0 0 8px" }}>
            Why we flagged this
          </div>
          {reasons.length > 0 ? (
            <div className="center gap6 wrap">
              {reasons.map((r) => (
                <span key={r} className="chip">
                  <Icon name="check" size={11} />
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Stored as scan context — no strong subscription or account signal on its own.
            </p>
          )}
        </div>

        <div className="card-pad" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="section-label" style={{ margin: "0 0 8px" }}>
            Headers used for detection
          </div>
          <div
            className="card"
            style={{ background: "var(--surface-inset)", padding: "var(--pad-card)" }}
          >
            {DETECTION_HEADERS.filter((name) => email.headers[name]).map((name) => (
              <div key={name} className="kv" style={{ padding: "5px 0" }}>
                <span className="k">{name}</span>
                <span
                  className="v mono"
                  style={{ fontSize: 11, wordBreak: "break-all", textAlign: "right" }}
                >
                  {email.headers[name]}
                </span>
              </div>
            ))}
            {DETECTION_HEADERS.every((name) => !email.headers[name]) && (
              <p className="muted" style={{ fontSize: 12 }}>
                No detection headers were stored for this message.
              </p>
            )}
          </div>
        </div>

        {gmailUrl && (
          <div className="card-pad" style={{ borderTop: "1px solid var(--border)" }}>
            <a href={gmailUrl} target="_blank" rel="noopener noreferrer">
              <Btn icon="ext">Open in Gmail</Btn>
            </a>
          </div>
        )}
      </Card>
    </div>
  )
}
