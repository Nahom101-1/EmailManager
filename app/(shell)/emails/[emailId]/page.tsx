import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { Btn, Card, Conf, Icon } from "@/components/ui"
import { ReplyComposer } from "@/components/conversation/ReplyComposer"
import {
  getEmailById,
  getLocalUserId,
  listAccounts,
  listEmailsInThread,
  listProviders,
  listSubscriptions,
} from "@/lib/db/local"
import { getIntelligence } from "@/lib/db/intelligence"
import { detectAccount, detectSubscription } from "@/lib/detection"
import {
  authSignals,
  collapseThreadDups,
  participantsOf,
  shortThreadSummary,
} from "@/lib/ui/conversation"
import { suggestReplyTargets } from "@/lib/ui/reply-validate"

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ emailId: string }>
}) {
  await connection()
  const { emailId } = await params
  const email = getEmailById(emailId)
  if (!email) notFound()

  const userId = getLocalUserId()
  const providers = listProviders(userId)
  const mailboxes = providers.map((p) => p.email)

  const threadRaw =
    email.thread_id && email.provider_id
      ? listEmailsInThread(email.provider_id, email.thread_id)
      : []
  const threadBase = [...(threadRaw.length > 0 ? threadRaw : [email])]
  // Ensure focus message is present even if thread query missed it.
  if (!threadBase.some((m) => m.id === email.id)) threadBase.push(email)
  const thread = collapseThreadDups(threadBase, email.id)
  const participants = participantsOf(threadBase)

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

  const relatedAccounts = listAccounts(userId)
    .filter((a) => {
      const domain = account?.domain ?? a.domain
      if (domain && a.domain && a.domain === domain) return true
      const company = (account?.company ?? "").toLowerCase()
      return company.length > 2 && a.company.toLowerCase().includes(company)
    })
    .slice(0, 4)

  const relatedSubs = listSubscriptions(userId)
    .filter((s) => {
      const company = (subscription?.company ?? account?.company ?? "").toLowerCase()
      return company.length > 2 && s.company.toLowerCase().includes(company)
    })
    .slice(0, 4)

  const signals = authSignals(email.headers)
  const summary = shortThreadSummary({
    messageCount: thread.length,
    intel,
    reasons,
  })
  const replyTargets = suggestReplyTargets(email)
  const gmailUrl = email.gmail_message_id
    ? `https://mail.google.com/mail/u/0/#all/${email.gmail_message_id}`
    : null

  const namedAttachments = Array.from(
    new Set(threadBase.flatMap((m) => m.attachments ?? []).filter(Boolean))
  )
  const attachmentHint =
    namedAttachments.length === 0 &&
    (email.headers["Content-Type"]?.toLowerCase().includes("multipart") ||
      /attachment|pdf|invoice|contract/i.test(`${email.subject ?? ""} ${email.snippet ?? ""}`))

  return (
    <div className="page page-wide fade-in conv-page">
      <div className="crumbs mb18">
        <Link href="/emails" className="btn ghost xs">
          <Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} />
          Emails
        </Link>
        <Icon name="chevR" size={13} />
        <span className="cur">Conversation</span>
      </div>

      <div className="conv-layout">
        <div className="conv-main">
          <div className="conv-title-block">
            <p className="page-eyebrow">Conversation</p>
            <h1 className="page-title" style={{ fontSize: 22 }}>
              {email.subject ?? "(no subject)"}
            </h1>
            <p className="page-sub">{summary}</p>
          </div>

          <div className="conv-thread" role="list">
            {thread.map((msg) => (
              <article
                key={msg.id}
                role="listitem"
                className={"conv-msg" + (msg.isFocus ? " on" : "")}
                aria-current={msg.isFocus ? "true" : undefined}
              >
                <header className="conv-msg-head">
                  <div className="conv-msg-from">{msg.from_address ?? "Unknown sender"}</div>
                  <div className="conv-msg-meta">
                    {msg.date ? new Date(msg.date).toLocaleString() : "—"}
                    {msg.provider_email ? ` · via ${msg.provider_email}` : ""}
                    {(msg.collapsedDupCount ?? 1) > 1
                      ? ` · ${msg.collapsedDupCount} near-dups collapsed`
                      : ""}
                  </div>
                </header>
                {msg.to_address && (
                  <div className="conv-msg-to">To {msg.to_address}</div>
                )}
                <div className="conv-msg-body">
                  {msg.snippet ?? (
                    <span className="muted">No snippet stored for this message.</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <ReplyComposer
            initialFrom={replyTargets.from || mailboxes[0] || ""}
            initialTo={replyTargets.to}
            initialCc={replyTargets.cc}
            replyToHeader={email.headers["Reply-To"] ?? email.headers["Reply-to"]}
            fromHeader={email.headers["From"] ?? email.from_address}
            connectedMailboxes={mailboxes}
            draftPrompt={`Draft a reply to this email (do not send). Subject: ${email.subject ?? "(no subject)"}. From: ${email.from_address ?? "unknown"}. Snippet: ${email.snippet ?? "(none)"}.`}
          />
        </div>

        <aside className="conv-rail" aria-label="Conversation details">
          <Card className="card-pad">
            <h3 className="conv-rail-title">Summary</h3>
            <p className="conv-rail-text">{summary}</p>
            {intel?.uncertain && (
              <span className="uncertain-chip" style={{ marginTop: 8 }}>
                uncertain
              </span>
            )}
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Participants</h3>
            <ul className="conv-rail-list">
              {participants.slice(0, 8).map((p) => (
                <li key={p} className="mono" style={{ fontSize: 11.5 }}>
                  {p}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Detected signals</h3>
            {intel && (
              <div className="kv" style={{ padding: "4px 0" }}>
                <span className="k">Intent</span>
                <span className="v">
                  {intel.intent}
                  {intel.uncertain ? " · uncertain" : ""}
                </span>
              </div>
            )}
            {intel?.intent_confidence != null && (
              <div className="kv" style={{ padding: "4px 0" }}>
                <span className="k">Confidence</span>
                <span className="v">
                  <Conf value={intel.intent_confidence * 100} showLabel />
                </span>
              </div>
            )}
            {(intel?.vendor || intel?.amount != null || intel?.due_date) && (
              <div className="kv" style={{ padding: "4px 0", alignItems: "flex-start" }}>
                <span className="k">Extracted</span>
                <span className="v">
                  {[
                    intel.vendor,
                    intel.amount != null
                      ? `${intel.currency ?? ""} ${intel.amount}`.trim()
                      : null,
                    intel.due_date ? `due ${intel.due_date}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </div>
            )}
            {reasons.length > 0 ? (
              <div className="center gap6 wrap" style={{ marginTop: 8 }}>
                {reasons.slice(0, 6).map((r) => (
                  <span key={r} className="chip">
                    {r}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                No strong request/deadline signals on this message alone.
              </p>
            )}
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Auth / trust</h3>
            <div className="center gap6 wrap">
              {signals.map((s) => (
                <span
                  key={s.label}
                  className={
                    "chip" +
                    (s.level === "warn" ? " warn-chip" : s.level === "ok" ? "" : "")
                  }
                  title={s.level}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Attachments</h3>
            {namedAttachments.length > 0 ? (
              <ul className="conv-rail-list">
                {namedAttachments.map((name) => (
                  <li key={name}>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="conv-rail-text">
                {attachmentHint
                  ? "Possible attachment or document mentioned in headers/snippet — filenames not stored (common for Gmail metadata sync). Nothing is auto-opened or uploaded."
                  : "No attachment filenames stored for this thread."}
              </p>
            )}
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              Metadata only — LifeOS never auto-follows links or auto-uploads files.
            </p>
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Related account / org</h3>
            {relatedAccounts.length === 0 && relatedSubs.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>
                No linked account or paid-plan row yet. Org match alone never merges accounts.
              </p>
            ) : (
              <ul className="conv-rail-list">
                {relatedAccounts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/accounts/${a.id}`}>
                      {a.company}
                      <span className="muted"> · {a.status}</span>
                    </Link>
                  </li>
                ))}
                {relatedSubs.map((s) => (
                  <li key={s.id}>
                    <Link href="/subscriptions">
                      {s.company}
                      <span className="muted"> · {s.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="card-pad">
            <h3 className="conv-rail-title">Suggested actions</h3>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              <Link href={`/assistant?q=${encodeURIComponent(`Summarize this thread: ${email.subject ?? ""}`)}`}>
                <Btn size="xs">Summarize</Btn>
              </Link>
              {relatedAccounts[0] && (
                <Link href={`/accounts/${relatedAccounts[0].id}`}>
                  <Btn size="xs" variant="ghost">
                    Open account
                  </Btn>
                </Link>
              )}
              {gmailUrl && (
                <a href={gmailUrl} target="_blank" rel="noopener noreferrer">
                  <Btn size="xs" variant="ghost" icon="ext">
                    Gmail
                  </Btn>
                </a>
              )}
            </div>
            <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              Evidence behind each suggestion stays in the rail — LifeOS will not send mail for you.
            </p>
          </Card>

          <details className="conv-disclosure">
            <summary>Advanced / headers</summary>
            <div className="card card-pad" style={{ marginTop: 8, background: "var(--surface-inset)" }}>
              {["From", "To", "Reply-To", "List-Unsubscribe", "List-ID", "Message-ID", "Authentication-Results"]
                .filter((name) => email.headers[name] || (name === "From" && email.from_address))
                .map((name) => (
                  <div key={name} className="kv" style={{ padding: "4px 0" }}>
                    <span className="k">{name}</span>
                    <span className="v mono" style={{ fontSize: 10.5, wordBreak: "break-all" }}>
                      {email.headers[name] ?? (name === "From" ? email.from_address : "")}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
