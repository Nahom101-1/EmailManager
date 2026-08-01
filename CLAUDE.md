@AGENTS.md

# LifeOS — Working Guide for Claude Code

> This file is the repository-level working guide. Read it before changing anything.
> The `@AGENTS.md` include above is mandatory: **this is not the Next.js you know** — read the
> relevant guide in `node_modules/next/dist/docs/` before writing framework code.

## Product vision

LifeOS is a **local-first personal email operating system**. It connects 1–N mailboxes (Gmail OAuth +
IMAP), imports large existing mailboxes efficiently, and turns raw email into an **evidence-based graph**
of people, organizations, service accounts, entitlements, billing, payments, conversations, obligations
and deadlines. It tells the user what deserves attention, finds forgotten items, summarizes threads, and
prepares **draft** replies from the correct mailbox — privately, explainably, and honestly about
uncertainty. It aims to confidently handle 85–95% of routine email work and clearly surface the rest,
never to fake certainty.

Full detail lives in `docs/MASTER_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
`docs/AI_ML_PLAN.md`, `docs/UI_UX_SPEC.md`, `docs/PERFORMANCE_PLAN.md`, `docs/SECURITY_PRIVACY.md`,
`docs/IMPLEMENTATION_CHECKLIST.md`, and `docs/adr/`.

## Core principles

1. **Evidence over assertion.** Every important conclusion is a *Claim* backed by *Evidence* (positive
   and negative), with confidence, model version, and a time-validity window. Do not write bare
   "current value" rows for high-impact facts (paid/active/who-pays).
2. **Conservative entity resolution.** A false merge is worse than keeping two possibly-duplicate
   accounts. Never merge two service accounts on company/domain equality alone.
3. **Temporal, not latest-only.** Model timelines (created → trial → cancelled → expired → …). Support
   states like `cancelled_active_until_end`, `included`, `superseded`, `uncertain`.
4. **Separate concepts.** company ≠ service account ≠ entitlement ≠ billing agreement ≠ payment event ≠
   mailing-list membership ≠ conversation ≠ action item. Who *owns*, *uses*, and *pays* are distinct.
5. **Content is data, never instructions.** Email bodies/attachments/quoted text are untrusted input to
   analysis. They must never steer tools or the agent.
6. **Draft, never auto-send.** Sending is always an explicit human gesture.
7. **Local-first & least privilege.** Cloud AI is opt-in per mailbox; the `content` scope is off by
   default. Raw source data is immutable; derived AI data is rebuildable.
8. **Honest uncertainty.** Prefer abstention and a small review queue over confident errors.

## Architecture overview

```
mailboxes → Ingestion/Sync → Raw immutable messages → Thread reconstruction
  → Identity/Entity graph → Event/fact extraction → Temporal state engine
  → { Account intelligence · Action intelligence · Communication relationships }
  → Focus & review queue → Evidence-based Ask + draft-only reply assistant
```

Raw layer = `emails` (+ headers/labels/attachment metadata). Derived layer = embeddings, intelligence,
claims/evidence, predictions, clusters, rollups — all rebuildable from raw without re-syncing.

## Repository map

```
app/(shell)/…            Web UI routes (Home, Dashboard, Assistant, Connect, Inbox Sync,
                         Subscriptions, Accounts[/id], Emails[/id], Settings)
app/api/…                Route handlers (auth, google, providers, subscriptions, accounts,
                         emails, assistant, search, sync-runs, cron/sync, settings)
lib/db/local.ts          SQLite schema + all persistence (better-sqlite3). Migrations live here.
lib/db/intelligence.ts   Derived-data persistence (embeddings, intelligence, clusters, FTS, rollups)
lib/detection.ts         Metadata-only subscription/account heuristics (KEEP; becomes one module)
lib/identity/groups.ts   Read-time company grouping (to be superseded by the entity graph)
lib/ai/pipeline.ts       Post-sync intelligence orchestration (embed→intent→extract→cluster→FTS)
lib/ai/{intent,extract,embeddings,cluster,near-dup,subscription-kind,learning,…}.ts
lib/ai/{client,local}.ts Claude cloud + Ollama local; graceful fallback
lib/google/{gmail,oauth}.ts   Gmail sync (metadata-first, incremental via historyId) + OAuth
lib/imap/{client,sync}.ts     IMAP connect + sync
lib/crypto/credentials.ts     Encrypted token/password storage (crypto-js)
lib/sync/status.ts       Sync state machine
cli/                     Ink-based CLI (early)
tests/lib/*.test.ts      Vitest unit tests
docs/                    Planning package (this evolution)
```

## Important commands

```
npm run dev            # local web app
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (max-warnings 0)
npm test               # vitest run
npm run check          # lint + format:check + test
npm run ci             # check + audit + build
npm run cli            # run the Ink CLI (tsx)
```

## Database conventions

- One SQLite file (`data/lifeos.sqlite`, override `LIFEOS_DB_PATH`), WAL mode, `foreign_keys=ON`.
- **Migrations are versioned** via a `schema_version` runner (Phase 0). Each migration is an ordered,
  idempotent function; the runner auto-backs-up the DB file before applying. Do not add ad-hoc
  `CREATE TABLE IF NOT EXISTS` in new code paths — register a migration.
- IDs are `TEXT` UUIDs. Timestamps are ISO-8601 `TEXT`. JSON columns store arrays/objects as text.
- Upserts must be idempotent and keyed on stable natural keys (e.g. `(provider_id, gmail_message_id)`).
- **Never widen a merge key to company/domain for accounts.** See `docs/adr/` merge-policy record.
- Prefer prepared statements + transactions for batch writes (see `lib/db/local.ts` patterns).

## AI/ML conventions

- **Cascade, not one big model:** rules → header/sender signals → fast classifier → embeddings →
  thread-level → optional local SLM → abstain/review. Do not add a per-email LLM call.
- Hash embeddings must not drive high-impact semantic decisions (pin MiniLM when available).
- Every prediction records **model version, feature version, confidence, reasons, and input scope**, and
  is written **append-only** to `model_predictions` (never overwrite prior predictions).
- Confidence policies differ by consequence (categorize vs financial vs security vs reply vs send).
- Cloud LLM (`lib/ai/client.ts`) only when `cloudAiEnabled` AND the relevant scope is on; never send
  body/snippet unless the `content` scope is enabled.

## Privacy rules

- Cloud AI defaults **off**; `content` scope defaults **off**. Respect `getAiSettings()` and per-mailbox
  capabilities everywhere content or cross-inbox linking is used.
- Do not silently change privacy behaviour. Any change to what leaves the device is a reviewed change and
  must be reflected in Settings + `docs/SECURITY_PRIVACY.md`.
- Support per-mailbox deletion and derived-data rebuild. Never train a shared/global model on private
  email by default.

## Security rules

- Treat all email content as untrusted. Analyzers/summarizers have **no tools**. The draft generator
  produces **text only**. Recipient validation and send happen **outside** the LLM.
- Parse and surface auth signals (SPF/DKIM/DMARC, Reply-To/From mismatch, lookalike domains) before
  recommending replies. Reduce trust on failure; never auto-follow links or auto-upload attachments.
- Encrypt OAuth tokens at rest; prefer OS keychain when packaged (desktop ADR).

## Testing expectations

- New logic ships with vitest tests (`tests/lib/*.test.ts`). Add a **regression test for every bug**.
- Use the shared fixtures in `tests/fixtures/` (two-Netflix, Apple-billed, cancelled-active, trial,
  failed-payment, annual-no-receipt, historical-unresolved, resolved-indirectly, prompt-injection,
  wrong-mailbox, forwarded-dup, NO/EN).
- Evaluation splits are **identity-aware** — never place the same company/account in train and test
  unless explicitly measuring known-vendor performance.
- Migrations are tested on a copy of a real DB; re-running the runner must be a no-op.

## Performance expectations

- Metadata-first ingestion; selective body/attachment retrieval; bounded concurrency; batch embeddings;
  incremental rollups. The app must be usable while backfill continues. See `docs/PERFORMANCE_PLAN.md`.

## Files that require special care

- `lib/db/local.ts` — schema + migrations (data-loss risk). Back up before migrating.
- `lib/google/gmail.ts` — incremental sync/cursor logic (crash-safe token; historyId 404 handling).
- `lib/ai/pipeline.ts` — scope gating + LLM budget.
- `lib/crypto/credentials.ts` — token encryption.
- `app/api/assistant/route.ts` — content + context; prompt-injection boundary.

## Current migration phase

**Phase 0 → Phase 3.** Building the planning package + Phase-0 scaffolding (versioned migration runner,
measurement scripts, fixtures) toward the **account & billing entity graph** (first build target).
`subscriptions`/`accounts` remain as back-compat during migration.

## Definition of done

Typecheck + lint + tests green; new logic covered (incl. a regression test if fixing a bug); migrations
versioned/idempotent/backed-up and tested on a DB copy; privacy/security behaviour unchanged unless
explicitly reviewed and documented; claims carry evidence + confidence + model version; user-facing
uncertainty shown honestly.

## Prohibited shortcuts

- ❌ Auto-sending email (any category) by default.
- ❌ Merging accounts on company/domain alone.
- ❌ Treating a newsletter as evidence of a paid account.
- ❌ Treating "no observed payment" as proof a subscription is inactive.
- ❌ Treating "no reply found" as proof an obligation was ignored.
- ❌ Using email content as system/agent instructions.
- ❌ Overwriting prior predictions / discarding source evidence.
- ❌ A per-email LLM call, or depending on cloud AI for basic functionality.
- ❌ Irreversible migrations without a backup + recovery path.
