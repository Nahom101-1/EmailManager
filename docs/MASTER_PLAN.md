# LifeOS — Master Plan

Companion to `CLAUDE.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `AI_ML_PLAN.md`, `UI_UX_SPEC.md`,
`PERFORMANCE_PLAN.md`, `SECURITY_PRIVACY.md`, `IMPLEMENTATION_CHECKLIST.md`, and `adr/`. This is the
step-by-step engineering plan derived from a repository audit. **Do not rewrite the app**; evolve it
additively behind back-compat tables.

## 1. Current state (audit summary)

Working, keep: metadata-first **incremental Gmail sync** (crash-safe resume token, `history.list` delta
with 404→recent fallback, backoff), selective scope-gated body fetch, an embed→intent→extract→cluster→
FTS→rollups **intelligence pipeline** (confidence/reasons/uncertain), encrypted tokens, WAL + FTS5, sync-
run tracking, read-time company grouping.

Gaps to close: **company=account=subscription=payment conflation** (subscriptions/accounts keyed
`unique(user_id,provider_id,company)`); no entity graph; no claim/evidence or temporal state; no
conversation reconstruction; no action/historical intelligence; no draft assistant; no append-only
prediction registry; weak security posture (no auth-signal parsing, no formal injection boundary); ad-hoc
migrations (no `schema_version`); inline sync (no durable jobs); Sent/Drafts not distinguished.

## 2. Target state

An evidence-based personal graph (people, orgs, service accounts, entitlements, billing, payments,
conversations, obligations) with temporal state and claim/evidence provenance; action intelligence
(Today/Focus/Waiting), historical resolution, and a **draft-only** reply assistant — local-first,
private, explainable, honest about uncertainty. See `ARCHITECTURE.md` and `DATA_MODEL.md`.

## 3. Architectural decisions

Recorded as ADRs (`docs/adr/`): keep SQLite; embeddings BLOB + in-memory cosine (revisit sqlite-vec);
in-process durable jobs (not microservices); Electron for eventual desktop; PWA→companion→RN for mobile;
Transformers.js/ONNX + optional Ollama/Claude runtime; Python offline training → ONNX runtime;
**conservative account merge**; **append-only claim/evidence**; immutable raw retention; metadata-first
attachments; opt-in cloud boundary; **draft-only**.

## 4. Workstreams & dependencies

```
Ingestion/Jobs ──▶ Thread/Identity ──▶ Entity/Billing graph ──▶ Action intelligence ──▶ Reply assistant
        │                    │                   │                        │
        └────────▶ Search/Registry ◀─────────────┘             Historical intelligence
Security/Privacy & Testing/Fixtures & Migration-runner are cross-cutting from Phase 0.
```

Hard dependencies: entity graph needs the migration runner + entity tables + resolver + claim writer;
reply assistant needs conversations + auth-signal parsing + recipient validator; historical intelligence
needs conversations + events + Sent mail.

## 5. Migration order (safe, additive)

1. `schema_version` + versioned runner + pre-migration backup.
2. Extend `emails` (references/in_reply_to/reply_to/content_hash).
3. `mailboxes` capability layer (wraps `providers`).
4. Entity/evidence/job tables (schema only).
5. Entity resolver + claim/evidence writer.
6. Backfill `subscriptions`/`accounts` → graph (idempotent, resumable), keep old tables as fallback.
7. Graph-backed Accounts/Money UI; then deprecate old read paths.
Every migration is idempotent, backed up, and tested on a copy of a real DB.

## 6. Phases (per-step detail below uses: Purpose · Problem · Design · Data/API/UI/AI · Files · Migration
· Tests · Perf · Privacy · Security · Acceptance · Rollback · Deps · Effort · Independent? · Order)

### Phase 0 — Audit & stabilize
- **0.1 Migration runner + `schema_version`.** *Purpose:* safe schema evolution. *Problem:* ad-hoc
  `IF NOT EXISTS`/`ensureColumns`, no version, no backup. *Design:* ordered idempotent migration fns;
  read/write `schema_version`; copy `data/lifeos.sqlite`→`.bak-<ts>` before applying. *Files:*
  `lib/db/local.ts` (+ `lib/db/migrations/`). *Migration:* yes (introduces the mechanism; existing
  `migrate()` becomes migration #1). *Tests:* fresh DB, upgrade-from-current, idempotent re-run, backup
  created. *Perf:* negligible. *Privacy/Security:* backup file is local (encrypt for user backups).
  *Acceptance:* re-run is a no-op; version persists. *Rollback:* restore `.bak`. *Deps:* none.
  *Effort:* M. *Independent:* yes. *Order:* 1.
- **0.2 Measurement scripts.** Time metadata sync; classify/200; DB size + row counts; crash/resume sim.
  *Files:* `scripts/`. *Effort:* XS. *Order:* 2.
- **0.3 Fixtures.** The 12+ scenarios. *Files:* `tests/fixtures/`. *Effort:* XS. *Order:* 3.
- **0.4 Verify IMAP cursors.** Confirm UID/UIDVALIDITY handling in `lib/imap/sync.ts`; add tests.
  *Effort:* S. *Order:* 4.

### Phase 1 — Durable ingestion hardening
- **1.1 Threading headers on `emails`** (references/in_reply_to/reply_to/content_hash). *AI:* enables
  thread reconstruction. *Migration:* yes (`ensureColumns` via runner). *Effort:* S.
- **1.2 `mailboxes` capability layer.** Per-mailbox least-privilege flags; wire into pipeline/connector
  gates and `getAiSettings`. *Security/Privacy:* central. *Migration:* yes. *Effort:* M.
- **1.3 Durable jobs.** `sync_jobs`/`processing_jobs` + in-process runner + progress; move backfill out
  of the request path; idempotent/resumable. *Perf:* usable during backfill. *Effort:* L.
- **1.4 Ingest Sent/Drafts** where permitted (needed for "did I reply"). *Effort:* M.

### Phase 2 — Thread & identity
- **2.1 Conversation reconstruction** (threadId + Message-ID + References/In-Reply-To + subject +
  participants + date proximity), cross-provider, dedup forwarded copies. *Tables:* `conversations`,
  `conversation_messages`. *Tests:* forwarded-dup fixture yields one conversation. *Effort:* L.
- **2.2 Identity** (`user_identities`, `email_aliases`, `contacts`, `contact_email_addresses`);
  self-alias detection; conservative contact resolution (never by name alone). *Effort:* L.

### Phase 3 — Account & billing graph (FIRST BUILD TARGET)
- **3.1 Entity tables** (orgs/service_accounts/entitlements/billing_agreements/payment_events/
  communication_relationships) + claim/evidence/model_predictions. *Migration:* yes. *Effort:* M.
- **3.2 Entity resolver** `lib/entities/resolve.ts` (descriptor/domain/vendor→org; conservative
  service-account keying; merge policy encoded). *Tests:* two-Netflix stays split; Apple receipt →
  billing on SA-B. *Effort:* L.
- **3.3 Claim/evidence writer** `lib/entities/claims.ts` (append-only; +/− evidence; current-best read).
  *Effort:* M.
- **3.4 Backfill** subscriptions/accounts → graph (idempotent/resumable; keep old tables). *Effort:* L.
- **3.5 Accounts/Money UI v2** (multi-account-per-org, billing route, uncertainty, evidence links).
  *Effort:* M.

### Phase 4 — Classification & search
Multi-label categorization; calibrated confidence + abstention/`unknown`; hybrid retrieval (SQL+FTS5+
embeddings) with evidence links; **model registry** + selective reprocessing. *Effort:* L.

### Phase 5 — Action intelligence
Reply-needed (thread-aware, multi-signal), deadlines, waiting-for, focus ranking, **Today** dashboard.
Uses graph + conversations. *Effort:* L.

### Phase 6 — Historical intelligence
Resolution matching (direct + indirect via Sent/receipts/confirmations), relevance decay, forgotten
accounts/obligations, finite evidence-based audit reports. *Effort:* L.

### Phase 7 — Reply assistant (draft-only)
Thread summaries; style retrieval; correct sending mailbox; reply/reply-all + **deterministic recipient
validator**; auth-signal check before generation; Gmail **draft** creation; never send. *Effort:* L.

### Phase 8 — CLI / desktop / mobile
`lifeos` CLI (init/connect/sync/backfill/status/audit/ask/reprocess/doctor/serve) over the shared core;
Electron packaging (ADR); PWA/companion mobile. *Effort:* L (staged).

### Phase 9 — Personalization & safe automation
Trust-weighted active learning; per-user ranking; safe auto-categorize/label; **broad auto-send stays off
by default**. *Effort:* L.

## 7. Risks

False account merges; migration data-loss; prompt injection; over-claiming from absent evidence; backfill
scale. Mitigations in `SECURITY_PRIVACY.md`, ADRs, and the acceptance tests below.

## 8. Acceptance criteria (program-level)

- Two-Netflix fixtures → two `service_accounts` under one `organization`; one entitlement active, one
  expired; Apple receipt → `billing_agreements.channel='apple'` distinct from login mailbox; newsletter →
  `communication_relationship`, not entitlement; **no** company/domain-only merge.
- Migration runner: idempotent, backed up, tested on a real-DB copy.
- Backfill: zero per-email LLM calls; resumable after injected crash; app usable on partial data.
- Every high-impact claim carries +/− evidence, confidence, and model version; predictions append-only.
- Draft assistant never sends; recipient validator + auth check run outside the LLM.

## 9. Testing criteria

Unit + integration; connector tests (Gmail/IMAP); migration tests; thread-reconstruction; entity-
resolution; temporal-state; historical-resolution; security/prompt-injection; reply-recipient; draft-
threading; performance/large-mailbox sim; model-regression; UI + a11y; e2e. **Identity-aware eval
splits** (no vendor leakage). See `AI_ML_PLAN.md` §10.

## 10. Rollback considerations

Each migration documents a rollback (restore pre-migration backup). Derived AI data is rebuildable from
raw. New features ship behind back-compat read paths; old tables are deprecated only after the new path is
verified. No irreversible operation runs without a backup + explicit confirmation.
