# LifeOS — Performance Plan

Goal: the app feels fast and stays usable **while** thousands of messages are still processing. Budgets
are targets on a typical modern laptop (local SQLite, Node). Measure before optimizing; Phase-0 scripts
capture the baseline.

## 1. Budgets

| Operation | Target |
| --- | --- |
| Cold start (server boot → first paint) | < 3 s |
| Warm start | < 1 s |
| Dashboard/Today load (cached rollups) | < 300 ms |
| Search (FTS5 + filters) | < 150 ms typical |
| Thread open | < 200 ms |
| Draft generation (local SLM / cloud) | < 4 s (streamed) |
| Classification per email (rules+embed, amortized) | < 15 ms |
| Classification per 200-email batch | < 3 s |
| Initial metadata sync | ~500 msg IDs/list page; ~50/batch fetch; visible progress within seconds |
| Historical backfill (10k–50k) | background, resumable, non-blocking; usable partial results throughout |
| Incremental sync (delta) | < 5 s typical |
| Memory (idle) | < 400 MB incl. model singleton |
| DB size | ~ few hundred MB at 50k metadata-only messages; bodies stored selectively |
| Model load (embeddings singleton) | < 2 s first use, then cached |
| Mobile interaction latency | < 100 ms for taps/swipes |

## 2. Backfill architecture

- **Metadata-first** (already): fetch headers/snippet/labels, not bodies. Reject most messages cheaply.
- **Durable jobs** (`sync_jobs`/`processing_jobs`): checkpointed, idempotent, resumable after crash;
  progress surfaced to the UI. Replaces inline sync in the request path for large crawls.
- **Selective body/attachment retrieval**: only for high-signal/uncertain/conversation/financial/security
  candidates; scope-gated; capped per run (current `MAX_BODY_FETCH`).
- **Selective deep analysis / no per-email LLM**: SLM/LLM only for summaries, ambiguous requests,
  drafting, resolution — never every message.
- **Partial usability**: Today/Money/Accounts render on whatever is processed; a banner shows remaining
  backlog (`backlogRemaining` already returned by the pipeline).

## 3. Batching & concurrency

- Gmail: bounded concurrency (current 2 workers + 80 ms delay), page size 100, 429/5xx backoff. Consider
  batch endpoint (≤50/batch) for fetch throughput while respecting rate limits.
- Embeddings: batch texts per run; reuse near-dup donor vectors (already implemented) to skip work.
- DB writes: transactions + prepared statements for every bulk upsert.

## 4. Caching & precomputation

- **Rollups** (`overview_stats`/`overview_daily`) precompute dashboard numbers incrementally.
- **Precomputed summaries** per conversation (cache; invalidate on new message in thread).
- **Vector cache** (`lib/ai/vector-cache.ts`) — invalidate on embedding writes (already wired).
- Cache "current best claim" per (subject, predicate) with a partial index; recompute on new evidence.

## 5. Database

- WAL + `foreign_keys=ON` (already). Prepared statements everywhere. Indexes per `docs/DATA_MODEL.md`
  (claims current-best partial index; payment_events by agreement/date; emails thread/message/hash).
- FTS5 (`emails_fts`) for keyword; embeddings BLOB + in-memory cosine for semantic; hybrid ranker for
  Ask/Search. Revisit `sqlite-vec` if in-memory cosine becomes the bottleneck (ADR).

## 6. Worker model

- Move embedding/classification off the request thread into a **worker thread** for backfill so the UI
  stays responsive. Model loaded once per worker (singleton). Jobs pull work in bounded batches.

## 7. Frontend

- Virtualized lists for inbox/threads/review queue; cursor/pagination, not offset scans.
- Stream first-sync progress; optimistic UI only for reversible actions (snooze/done), never for sends.
- Avoid unnecessary React re-renders (stable keys, memo where measured); lazy-load heavy/debug panels.
- PWA caching for shell; data always from the local API.

## 8. Profiling & benchmarks

- Phase-0 `scripts/`: (a) time a metadata sync of N messages; (b) time classify/200; (c) report DB size
  + per-table row counts; (d) simulate crash mid-backfill and confirm resume.
- Track regressions: keep a small benchmark that runs the pipeline over `tests/fixtures/` and asserts
  time/quality bounds.

## 9. Acceptance thresholds

- Backfill of the fixture corpus completes with **zero** per-email LLM calls and is resumable after an
  injected crash. Dashboard renders on partial data. Incremental delta sync < 5 s. No dashboard query
  does a full table scan (verify with `EXPLAIN QUERY PLAN`).
