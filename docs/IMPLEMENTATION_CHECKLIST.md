# LifeOS — Implementation Checklist

Execution list. Each task: **Objective · Files · Deps · Tests · Acceptance · Risk · Migration**.
Effort XS–XL. Do in order within a phase; phases can overlap where deps allow. Keep typecheck/lint/tests
green after each task. See `MASTER_PLAN.md` for phase context.

## Phase 0 — Audit & stabilize

- [ ] **0.1 Migration runner + `schema_version`** — XS-M · Migration: **yes**
  - Objective: versioned, idempotent migrations with pre-apply DB backup.
  - Files: `lib/db/local.ts`, new `lib/db/migrations/`.
  - Deps: none.
  - Tests: fresh DB; upgrade-from-current; idempotent re-run; backup file created.
  - Acceptance: `schema_version` persists; re-run is a no-op; existing `migrate()` becomes migration #1.
  - Risk: M (data-loss if wrong) → mitigated by backup + copy-DB test.
- [ ] **0.2 Measurement scripts** — XS · Migration: no
  - Objective: baseline sync time, classify/200, DB size + row counts, crash/resume sim.
  - Files: `scripts/measure-*.ts`.
  - Tests: script runs on a seeded DB and prints numbers.
  - Acceptance: numbers captured for the plan baseline.
- [ ] **0.3 Test fixtures** — XS · Migration: no
  - Objective: 12+ scenario emails (two-Netflix, Apple-billed, cancelled-active, trial, failed-payment,
    annual-no-receipt, historical-unresolved, resolved-indirectly, prompt-injection, wrong-mailbox,
    forwarded-dup, NO/EN).
  - Files: `tests/fixtures/`.
  - Acceptance: importable by unit tests; each scenario documented.
- [ ] **0.4 Verify IMAP cursors** — S · Migration: no
  - Objective: confirm UID/UIDVALIDITY incremental handling.
  - Files: `lib/imap/sync.ts`, `tests/lib/imap-sync.test.ts`.
  - Acceptance: UIDVALIDITY change triggers safe re-sync; cursor persisted.

## Phase 1 — Durable ingestion hardening

- [ ] **1.1 Threading headers on `emails`** — S · Migration: **yes**
  - Objective: persist `references`, `in_reply_to`, `reply_to`, `content_hash`.
  - Files: `lib/db/local.ts` (migration), `lib/google/gmail.ts` (already fetches Reply-To; add
    References/In-Reply-To to `METADATA_HEADERS`), `lib/imap/sync.ts`.
  - Tests: headers stored; content_hash stable for duplicates.
  - Acceptance: columns populated on new syncs; backfillable.
- [ ] **1.2 `mailboxes` capability layer** — M · Migration: **yes**
  - Objective: per-mailbox least-privilege flags wrapping `providers`.
  - Files: `lib/db/local.ts`, `lib/ai/pipeline.ts`, connectors, `app/(shell)/settings`.
  - Tests: content/cloud/cross-inbox gated by capability; defaults least-privilege.
  - Acceptance: a metadata-only mailbox never triggers body fetch or cloud calls.
- [ ] **1.3 Durable jobs** — L · Migration: **yes**
  - Objective: `sync_jobs`/`processing_jobs` + in-process runner + progress; backfill off request path.
  - Files: `lib/jobs/`, `app/api/providers/[providerId]/sync/route.ts`, `lib/db/local.ts`.
  - Tests: crash mid-job resumes from checkpoint; idempotent; no duplicate entities.
  - Acceptance: 10k-fixture backfill runs in background, app usable, resumable.
- [ ] **1.4 Ingest Sent/Drafts** — M · Migration: maybe
  - Objective: distinguish folders; store outgoing mail for reply detection.
  - Files: connectors, `emails.folder` usage.
  - Acceptance: Sent messages queryable; used later by resolution/reply-needed.

## Phase 2 — Thread & identity

- [ ] **2.1 Conversation reconstruction** — L · Migration: **yes**
  - Files: `lib/conversations/`, `lib/db/local.ts` (`conversations`, `conversation_messages`).
  - Tests: forwarded-dup → one conversation; cross-provider thread joins.
  - Acceptance: threads span mailboxes; dups collapsed; state field present.
- [ ] **2.2 Identity & contacts** — L · Migration: **yes**
  - Files: `lib/identity/` (extend), `lib/db/local.ts`.
  - Tests: self-aliases detected; no name-only contact merge.

## Phase 3 — Account & billing graph (first build target)

- [ ] **3.1 Entity + evidence tables (schema only)** — M · Migration: **yes**
  - Files: `lib/db/local.ts` migrations.
  - Acceptance: tables + indexes per `DATA_MODEL.md`; no behavior change.
- [ ] **3.2 Entity resolver** — L · Migration: no
  - Files: `lib/entities/resolve.ts`; reuse `lib/detection.ts` vendor map + `lib/identity/groups.ts`
    normalization for **org** grouping only.
  - Tests: two-Netflix split; Apple receipt attaches billing to SA-B; no company-only merge.
- [ ] **3.3 Claim/evidence writer** — M · Migration: no
  - Files: `lib/entities/claims.ts`.
  - Tests: append-only; +/− evidence; current-best read; supersede semantics.
- [ ] **3.4 Backfill subscriptions/accounts → graph** — L · Migration: **yes (data)**
  - Files: `lib/jobs/backfill-graph.ts`.
  - Tests: idempotent/resumable; two same-company accounts stay split; newsletter→relationship.
  - Acceptance: old tables intact (fallback); graph populated.
- [ ] **3.5 Accounts/Money UI v2** — M · Migration: no
  - Files: `app/(shell)/accounts/[id]/page.tsx`, `app/(shell)/subscriptions` → Money, components.
  - Tests/Acceptance: renders multi-account-per-org with billing route, uncertainty, evidence links.

## Phase 4 — Classification & search

- [ ] Multi-label categorizer + calibration + abstention — L
- [ ] Model registry (`model_predictions` append-only) + selective reprocessing — M · Migration: yes
- [ ] Hybrid retrieval (SQL + FTS5 + embeddings) with evidence links — M

## Phase 5 — Action intelligence

- [ ] Reply-needed (thread-aware) — L
- [ ] Deadlines + waiting-for + obligations — M · Migration: yes
- [ ] Focus ranking + **Today** dashboard — L

## Phase 6 — Historical intelligence

- [ ] Resolution matching (direct + indirect) — L
- [ ] Relevance decay + audit reports — M

## Phase 7 — Reply assistant (draft-only)

- [ ] Thread summaries + style retrieval — M
- [ ] Auth-signal parsing (SPF/DKIM/DMARC, Reply-To/From, lookalike) — M
- [ ] Deterministic recipient validator (outside LLM) — M
- [ ] Gmail **draft** creation (correct thread headers), never send — M · needs compose scope

## Phase 8 — CLI / desktop / mobile

- [ ] `lifeos` CLI over shared core — L
- [ ] Electron packaging (ADR) — L
- [ ] PWA/companion mobile — M

## Phase 9 — Personalization & safe automation

- [ ] Trust-weighted feedback + active learning — M
- [ ] Per-user ranking — M
- [ ] Safe auto-categorize/label (no broad auto-send) — M
