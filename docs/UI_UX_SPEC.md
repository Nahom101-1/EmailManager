# LifeOS — UI/UX Spec

Principle: calm, fast, action-oriented. Not a database admin panel. Show the next action and the
evidence behind it; hide machinery behind progressive disclosure. Always surface uncertainty honestly.

## 1. Information architecture / navigation

```
Today · Focus · Waiting · Money · Accounts · People · History · Ask · Settings
```

- Current routes (Home, Dashboard, Assistant, Connect, Inbox Sync, Subscriptions, Accounts, Settings)
  map forward: Dashboard→**Today**, Assistant→**Ask**, Subscriptions→**Money**, Accounts→**Accounts**.
  **Focus/Waiting/People/History** are new. Keep **Connect/Inbox Sync** under Settings/onboarding.
- Desktop: left sidebar + command palette (`⌘K`). Mobile: bottom tab bar (Today, Focus, Ask, Search,
  More) + swipe actions.

## 2. Today screen

Answers: what needs me now · what can wait · what changed · what's handled. Sections, each collapsible,
each item a **Focus card**:

```
Now                 Reply to landlord about lease · Payment failed for Adobe · Reg deadline tomorrow
This week           Confirm dentist · Review employment contract · Spotify +20 NOK
Waiting for others  Garmin service (6d) · Housing application · Work reimbursement
Possibly forgotten  2024 invoice unresolved · 2 security alerts, no password change · Uni doc request
Low-priority        23 newsletters · 8 receipts · 4 deliveries · 19 promotions  (digest, one row)
```

Overload signal instead of vanity metrics: *"62 messages, 4 seem to need you."* No "71 unread".

## 3. Focus card (the atom)

```
┌───────────────────────────────────────────────────────────────┐
│ Reply to landlord about lease document          ● high  ⌄      │
│ Sarah asked you to confirm one of two times.                    │
│ Why it matters: deadline Fri · from personal@ · Sarah (landlord)│
│ Evidence: 2 messages ▸        Confidence: ●●●○ (78%)            │
│ [Draft reply]  [Snooze]  [Done]  [Not for me]  [Correct…]       │
└───────────────────────────────────────────────────────────────┘
```

Fields: title, one-sentence explanation, why-it-matters, deadline, confidence (numeric + non-colour
icon), source mailbox, person/org, evidence link, primary action, and dismiss/complete/snooze/correct.

## 4. Conversation view

Chronological thread (cross-provider, forwarded dups collapsed) + right rail: short summary,
participants, detected requests, deadlines, attachments, conversation state, related account/org,
suggested actions, suggested reply, and the evidence behind each recommendation. Reply composer shows
**Replying from / To / Cc** explicitly with validator warnings.

## 5. Account view (must support multiple accounts per org)

```
Netflix
├─ Account · old@gmail.com                     status: inactive  ⓘ
│   Paid plan: no current evidence · Last activity: 2024 · Mailing: active
│   Evidence ▸   [Review]  [Correct…]
└─ Account · me@gmail.com                       status: active
    Plan: Premium · Billing: Apple · Last charge: 199 NOK (Jul) · Next: ~15 Aug
    Evidence ▸   [Open thread]  [Correct…]
```

Never merge the two because the org matches. Uncertainty is explicit ("no current evidence", "~").

## 6. Money view

Active paid plans · possibly-active · trials · price increases · payment failures · refunds · duplicate/
overlapping subs · direct vs third-party billing · normalized monthly+annual cost · supporting payment
evidence. Mailing lists are a **separate** tab, never mixed into spend.

## 7. History view (guided audits)

Buttons, not a search box: *Review last 3 years · Unresolved requests · Forgotten financial issues · Old
accounts · Possibly-still-active subscriptions · People I may not have replied to · Security events · Old
documents/deadlines.* Results grouped by **relevance status** (open_and_relevant, resolved_indirectly,
expired, superseded, probably_irrelevant, uncertain), not by date. Finite summary up top
("5 unresolved · 12 old accounts · 3 possible recurring payments · 8 people · 127 stale newsletters").

## 8. Ask interface

Chat over local data; every answer **cites** messages/records and states missing evidence. Supports
"what should I focus on today", "which need replies", "what am I waiting for", "do I have >1 Netflix
account", "who actually pays for Netflix", "did I miss anything in 2024", "summarize my Garmin case",
"draft a reply to my landlord" (→ produces a **draft**, never sends). "Find accounts on my old email".

## 9. Review queue

```
LifeOS thinks: this is an inactive Netflix account.
Evidence: membership ended 2024 · marketing email 2026 · no recent billing.
[Correct]  [Still active]  [Different account]  [Not sure]
```

Seconds-per-item. Corrections become strong labels (`feedback_events.trust = explicit_correction`).

## 10. Progressive disclosure

Default is minimal + action-oriented. An expander reveals: confidence, model version, extracted events,
raw headers, matching logic, contradicting evidence, processing history. Advanced/debug controls live
here and in Settings.

## 11. States

- **Empty:** onboarding CTA ("Connect a mailbox"), sample of what Today will look like.
- **Loading / first sync:** streaming progress ("Scanned 3,200 / ~9,000 · usable now"); the app is
  usable on partial data. Skeletons for cards; virtualized lists.
- **Error:** actionable ("Sync interrupted — Retry, progress saved"; "Reconnect Google").
- **Uncertain:** explicit `uncertain`/`unknown` chips rather than a forced guess.

## 12. Confidence display

Numeric % + a 4-dot non-colour indicator + word ("likely/uncertain"). Never colour-only. Financial and
security items show the evidence count inline.

## 13. Mobile vs desktop

- **Mobile:** Today, Focus, Waiting, notifications, quick review (swipe), thread summaries, draft
  approval, search/Ask. Bottom nav; large touch targets; no bulk-admin surfaces.
- **Desktop:** multi-column browsing, `⌘K` palette, keyboard nav, bulk review, timeline exploration,
  side-by-side evidence, draft editing, debug/privacy controls.

## 14. Accessibility

Full keyboard nav + visible focus states; screen-reader labels on cards/actions/evidence; AA contrast;
reduced-motion honoured; **non-colour** confidence/status indicators; large touch targets; plain-language
explanations; no critical info conveyed by colour alone.

## 15. Keyboard shortcuts (desktop)

`⌘K` palette · `j/k` move · `e` done · `s` snooze · `r` draft reply · `x` select · `[`/`]` prev/next
section · `?` help · `g t` Today · `g m` Money · `g a` Accounts · `g h` History · `/` search.
