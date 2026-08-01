# LifeOS — AI/ML Plan

Local-first, specialist-models-over-one-LLM, evidence-and-abstention. Runtime is TypeScript
(Transformers.js/ONNX + optional Ollama + optional Claude); heavy training is offline Python exporting
ONNX. No per-email LLM call; cloud AI never required for basic function.

## 1. Current state (repo)

- Embeddings: `lib/ai/embeddings.ts` — MiniLM via `@huggingface/transformers` with a **hash fallback**;
  `resolveActiveEmbeddingModel()` pins one space and purges mismatched vectors.
- Intent: `lib/ai/intent.ts` — prototype/rule classification with `uncertain` flag + reasons.
- Extract: `lib/ai/extract.ts` — regex fields (amount/cycle/date/vendor) + optional single Claude pass,
  scope-gated.
- Kind: `lib/ai/subscription-kind.ts` — paid vs mailing_list.
- Cluster/near-dup: `lib/ai/{cluster,near-dup}.ts`. Learning bias: `lib/ai/learning.ts`.
- Orchestration: `lib/ai/pipeline.ts` (embed→intent→extract→cluster→FTS→rollups), incremental with
  backlog + LLM budget (`MAX_LLM_EXTRACT`).

**Gaps:** no thread-level models, no reply-needed/resolution/importance models, no calibration/abstention
policy per consequence, no append-only prediction registry, no identity-aware evaluation harness.

## 2. Specialist components (target)

| Component | Type | Output (with confidence + reasons + evidence) |
| --- | --- | --- |
| Email type classifier | rules + fast supervised (SetFit/logreg on embeddings) | transactional/conversation/newsletter/promotion/notification/security/spam |
| Multi-label domain tagger | fast supervised | money/account/work/study/health/housing/travel/shopping/social |
| Intent classifier | prototypes + supervised (exists, extend) | receipt/renewal/trial/security/action_required/… |
| Event extractor | rules + optional SLM | typed events (charge, failed_charge, cancellation, price_change, document_requested, …) |
| Deadline extractor | rules (NO/EN dates) + SLM fallback | due_at + confidence |
| Reply-needed classifier | thread-level features + rules | required/recommended/action_no_reply/optional_ack/none/uncertain |
| Thread-resolution classifier | thread-level | resolved_directly/indirectly/expired/superseded/open/uncertain |
| Financial-event / entitlement-state | rules + fold over events | entitlement + billing state |
| Security-risk classifier | header/auth rules + lookalike | low/med/high, favour recall |
| Importance ranker | features (relationship, mailbox purpose, direct-recipient, follow-up, money/security, deadline, user rules) | focus score |
| Entity resolver | deterministic + embeddings for org names | org/service-account links (conservative) |
| Relationship classifier | features | manager/university/friend/vendor/automated |
| Reply generator | SLM/Claude, **text only, no tools** | draft + rationale + needs_facts |
| Confidence calibrator | isotonic/Platt per model | calibrated probability |

## 3. Inference cascade

`deterministic parse → header/sender rules → fast multi-label classifier → embedding similarity/retrieval
→ thread-level model → optional local SLM (uncertain only) → confidence calibration → abstain/review`.
A verification pass runs for high-impact claims ("is there evidence this was already answered or
cancelled?") before finalizing. Hash embeddings never drive high-impact semantic decisions.

## 4. Features

- **Header/auth:** From/Reply-To/To/Cc, List-Unsubscribe/List-ID, SPF/DKIM/DMARC/Authentication-Results,
  domain vs display-name, lookalike distance.
- **Text:** subject/snippet/(body when scope-on) embeddings; keyword rules; NO/EN date & currency
  (NOK, kr, `,-`, decimal comma) parsing.
- **Thread:** latest-meaningful-sender, question/request presence, direct-recipient vs cc, later outgoing
  reply from any alias, follow-up count, automated/no-reply detection.
- **Graph/context:** contact relationship, mailbox purpose, organization, prior similar-request outcome,
  user rules.

## 5. Weak supervision & active learning

- Trust ordering (from `feedback_events`): explicit_correction ≫ confirm > independent_reply > archive >
  ai_auto(=none). AI-caused actions produce **no** training signal (breaks feedback loops).
- Combine noisy behavioural signals with a small clean hand-labeled set; never treat "not replied" as a
  hard negative.
- Active learning: surface **uncertain, high-consequence** items to the review queue first; corrections
  become strong labels and can trigger selective reprocessing (by model version).

## 6. Calibration & abstention (per consequence)

```
categorization:  ≥0.98 auto · 0.90–0.98 auto+easy-undo · 0.70–0.90 recommend · <0.70 review
financial claim: much stricter; require corroborating +evidence; single receipt ≠ ongoing plan
security:        favour recall; surface uncertainty rather than reassure
reply/draft:     recommend only; never auto-send
archival:        lenient for newsletters; strict for anything account/finance/security
```

Calibrate each classifier (isotonic on a held-out set) so thresholds mean what they say. Abstention
(`unknown`/`uncertain`) is a first-class output, not a failure.

## 7. Model registry & reprocessing

- Every inference writes an append-only `model_predictions` row (model, feature_version, output,
  confidence, reasons, input_scope). Claims reference the producing version.
- On a new model, reprocess **only affected subjects** (new reply model → conversations; new resolver →
  accounts; new embedding model → selected searchable text). Never re-run every model over every email.

## 8. Runtime & fallback

- Embeddings/classifiers export to **ONNX**, run via Transformers.js/onnxruntime-node as a **singleton**;
  batch inputs; quantize where quality holds. Multilingual embedding model (EN+NO) preferred over
  English-only MiniLM once validated.
- Optional **Ollama** local SLM for uncertain cases and drafting when installed; optional **Claude** when
  `cloudAiEnabled` + scope. If neither is available, the cascade still produces rules/embedding results
  and abstains where needed — the app remains functional.

## 9. Security around LLMs

- Analyzer/summarizer/extractor prompts treat email content as **quoted untrusted data**, never
  instructions; they have **no tools**. The reply generator returns **text only**. Recipient validation
  and sending are deterministic and outside the model. See `docs/SECURITY_PRIVACY.md`.

## 10. Evaluation (identity-aware)

- **Never** put the same company/account in train and test unless explicitly measuring known-vendor
  performance. Evaluate on: new email from known account; new account at known company; unseen company;
  same company across inboxes; one paid + one inactive at same company; third-party billing; NO vs EN;
  metadata-only vs body; historical vs current; adversarial/prompt-injection.
- **Metrics:** account-merge precision (a false merge is the worst error), account-split recall,
  paid-plan precision/recall, current-status accuracy, historical-state accuracy, reply-needed precision,
  missed-critical-action rate, false-urgent rate, draft factual accuracy, incorrect-recipient rate,
  abstention rate, calibration (ECE), time per 10k emails.
- Fixtures in `tests/fixtures/` seed regression + eval; add a fixture for every discovered failure.
