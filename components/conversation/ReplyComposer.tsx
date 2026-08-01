"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Btn, Field, Icon } from "@/components/ui"
import { validateReplyDraft, type ReplyWarning } from "@/lib/ui/reply-validate"

export function ReplyComposer({
  initialFrom,
  initialTo,
  initialCc = "",
  replyToHeader,
  fromHeader,
  connectedMailboxes,
  draftPrompt,
}: {
  initialFrom: string
  initialTo: string
  initialCc?: string
  replyToHeader?: string | null
  fromHeader?: string | null
  connectedMailboxes: string[]
  /** Prefill Ask with a draft request — never sends. */
  draftPrompt: string
}) {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [cc, setCc] = useState(initialCc)
  const [body, setBody] = useState("")
  const [showCc, setShowCc] = useState(Boolean(initialCc))

  const warnings = useMemo(
    () =>
      validateReplyDraft({
        from,
        to,
        cc,
        replyToHeader,
        fromHeader,
        connectedMailboxes,
      }),
    [from, to, cc, replyToHeader, fromHeader, connectedMailboxes]
  )

  const blocking = warnings.some((w) => w.level === "error")
  const askHref =
    "/assistant?q=" +
    encodeURIComponent(
      `${draftPrompt}\n\nReplying from: ${from}\nTo: ${to}${cc ? `\nCc: ${cc}` : ""}${
        body.trim() ? `\n\nNotes for draft:\n${body.trim()}` : ""
      }`
    )

  return (
    <div className="reply-composer">
      <div className="reply-composer-head">
        <Icon name="edit" size={14} />
        <strong>Reply draft</strong>
        <span className="uncertain-chip">never auto-sends</span>
      </div>

      <div className="reply-fields">
        <Field label="Replying from">
          {connectedMailboxes.length > 1 ? (
            <select
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Replying from mailbox"
            >
              {connectedMailboxes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Replying from mailbox"
            />
          )}
        </Field>
        <Field label="To">
          <input
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            aria-label="To recipients"
          />
        </Field>
        {showCc ? (
          <Field label="Cc">
            <input
              className="input"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="optional"
              aria-label="Cc recipients"
            />
          </Field>
        ) : (
          <button type="button" className="btn ghost xs" onClick={() => setShowCc(true)}>
            Add Cc
          </button>
        )}
        <Field label="Notes for draft (optional)" hint="Passed to Ask — not sent as email.">
          <textarea
            className="input"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tone, points to include, constraints…"
            aria-label="Draft notes"
          />
        </Field>
      </div>

      {warnings.length > 0 && (
        <ul className="reply-warnings" aria-live="polite">
          {warnings.map((w) => (
            <WarningRow key={w.code + w.message} warning={w} />
          ))}
        </ul>
      )}

      <div className="focus-card-actions" style={{ borderTop: 0, paddingTop: 0 }}>
        {blocking ? (
          <Btn variant="primary" size="xs" disabled>
            Fix warnings to draft
          </Btn>
        ) : (
          <Link href={askHref}>
            <Btn variant="primary" size="xs" icon="bolt">
              Draft with Ask
            </Btn>
          </Link>
        )}
        <Btn size="xs" variant="ghost" disabled title="Send is never available here">
          Send…
        </Btn>
      </div>
    </div>
  )
}

function WarningRow({ warning }: { warning: ReplyWarning }) {
  return (
    <li className={"reply-warn reply-warn-" + warning.level}>
      <Icon
        name={warning.level === "error" ? "alert" : warning.level === "warn" ? "info" : "check"}
        size={13}
      />
      <span>{warning.message}</span>
    </li>
  )
}
