# QA Report — v0.9.3 Authoritative Mastery Evidence

Date: 2026-09-12  
Baseline: `v0.9.2` / `83242bb919c7e549f8335bc0f79f15c3d5e760d4`  
Release commit: `659600b7dd790b177de46cd40d5fb8af03196515`

## Purpose

v0.9.3 closes the academic-integrity gap identified in the system simulation audit: an authenticated browser previously had direct INSERT authority for `attempts` and `attempt_skill_results`, while Mastery trusted those rows as evidence.

The release moves the authoritative scoring boundary to Supabase:

`raw notation response → authenticated Edge Function → server Major Scale scorer → service-only persistence RPC → trusted attempt/skill rows → Mastery → progression`

The client still calculates immediate feedback for responsiveness, but client-calculated scores and skill evidence are not sent to the trusted persistence path.

## Production changes

Frontend/data layer:

- `src/data/practice.repository.js` routes raw answers through `submit-major-scale-attempt` and no longer inserts attempts or skill evidence directly.
- `src/data/supabase-client.js` exposes centralized runtime version `0.9.3`; the repository uses it for `practice_sessions.app_version`.

Backend:

- `supabase/functions/submit-major-scale-attempt/index.ts`
- `supabase/functions/submit-major-scale-attempt/scoring.mjs`
- `supabase/migrations/20260912_v093_authoritative_attempt_submission.sql`

Infrastructure:

- `.github/workflows/qa.yml`

The notation controller, renderer, interaction module, beaming module, keyboard module and browser Major Scale scoring module are unchanged from v0.9.2.

## Server scoring policy

The server scorer reproduces the existing Major Scale domain policy and is guarded by parity regression:

- 29 supported Major keys.
- `BN01_TREBLE_PITCH`: pitch letter only; octave does not affect correctness.
- `MS03_SCALE_ACCIDENTAL`: accidental evaluated separately.
- `BN06_STEM_DIRECTION`: based on actual written positions; independent B4 on the treble middle line accepts both stem directions.
- `RH01_DURATION_VALUE`: unchanged.
- `GR02_PRIMARY_BEAM`: unchanged exact group membership policy.
- Weights remain 30/10/15/15/30.

## Database trust boundary

`persist_scored_major_scale_attempt` is `SECURITY INVOKER` and callable only by `service_role`. It validates:

- learner/session ownership supplied by the verified Edge request;
- active Major Scale exercise/stage scope;
- learner Stage status is `in_progress` or `mastered`;
- `item_code` belongs to the Stage required-item configuration;
- sequential immutable question slots;
- planned-question upper bound when present;
- exactly five distinct expected skill evidence rows;
- evidence count/score/flag consistency.

The operation writes the attempt and all five skill rows atomically and updates session progress. Existing question slots are idempotent: a retry returns the original persisted result rather than replacing it.

Direct authenticated INSERT policy/grant access to `attempts` and `attempt_skill_results` is revoked in production.

## Live Supabase verification

The Edge Function `submit-major-scale-attempt` is ACTIVE with JWT verification enabled.

Final post-cutover privileges were verified as:

- `authenticated` INSERT `attempts`: false
- `authenticated` INSERT `attempt_skill_results`: false
- `anon` INSERT `attempts`: false
- `anon` INSERT `attempt_skill_results`: false
- `service_role` INSERT `attempts`: true
- `service_role` INSERT `attempt_skill_results`: true
- `authenticated` EXECUTE `persist_scored_major_scale_attempt`: false
- `anon` EXECUTE `persist_scored_major_scale_attempt`: false
- `service_role` EXECUTE `persist_scored_major_scale_attempt`: true
- learner INSERT policies remaining on the two evidence tables: 0

A rollback-only post-cutover transaction switched to `service_role`, persisted an authoritative attempt plus all five skill rows through the restricted RPC and returned the expected score/session progress. The transaction was rolled back, leaving no QA row in production.

A separate rollback-only pre-cutover test retried an existing question with conflicting score/evidence and confirmed that the original immutable attempt was returned rather than replaced.

Post-cutover integrity verification returned:

- orphan attempts: 0
- orphan skill results: 0
- duplicate question slots: 0
- duplicate attempt/skill rows: 0
- invalid Stage references: 0
- exercise/Stage mismatches: 0
- retained v0.9.3 QA sessions: 0

No real learner row was edited or deleted during these verification transactions.

The production migration history includes `v093_authoritative_attempt_submission` after v0.9.0 and v0.9.1 migrations.

## Automated regression

GitHub Actions runs Node 22 plus real Chrome.

PR-specific CI passed before merge. After merge, the `main` workflow for release commit `659600b7dd790b177de46cd40d5fb8af03196515` also completed successfully.

The Node regression includes:

- all inherited contract/runtime tests;
- 29 Major Scale spellings/expected answers;
- 261 historical golden evaluations;
- 24 deterministic question-generation sequences;
- notation core/renderer/interaction/beaming suites;
- path-stage enforcement;
- v0.9.2 pitch/octave/B4 stem regression;
- v0.9.3 authoritative-attempt security contract;
- v0.9.3 server/client scoring parity.

The same CI workflow passed the existing real-Chrome E2E suite after installing pinned Playwright. The browser suite uses a fixture backend; it validates real UI/interaction behavior, not live Supabase transport.

## Scoring parity coverage added in v0.9.3

`tests/server-major-scale-scoring.test.js` compares server and browser domain behavior for every one of the 29 keys:

- expected answer parity;
- correct answer;
- octave-displaced answer;
- accidental-only error;
- wrong pitch letter;
- independent B4 stem up and down.

Malformed notation payloads and unsupported key codes are also rejected by the server scorer.

## Security regression coverage added

`tests/authoritative-attempt-security.test.js` checks that:

- browser repository invokes the scoring Edge Function;
- browser repository does not insert `attempts` directly;
- browser repository does not insert `attempt_skill_results` directly;
- client `score` is not trusted by the Edge Function;
- client `skill_results` are not trusted by the Edge Function;
- privileged persistence RPC is service-role only;
- Stage, item, sequence and evidence-shape checks exist in the migration;
- the service role marker does not appear in browser source.

## Post-cutover advisors

The new v0.9.3 persistence RPC does not appear in the `authenticated SECURITY DEFINER` warning because it is `SECURITY INVOKER` and service-role only.

Remaining advisor findings are inherited/separate work:

- 13 existing authenticated-callable `SECURITY DEFINER` RPC warnings require function-by-function authorization review rather than a blanket rewrite.
- Supabase Auth leaked-password protection is disabled.
- Performance advisor reports 10 unindexed foreign keys, 10 RLS auth-init-plan warnings and 5 currently unused indexes.

These findings do not reopen the v0.9.3 Mastery-evidence forgery path.

## Remaining limitations / follow-up

- Real Chrome CI uses the fixture backend. A fresh authenticated browser-to-live-Edge-to-live-DB journey requires a dedicated disposable QA account/session and is not claimed by this report.
- Supabase Auth leaked-password protection is an account configuration item and was not changed by this release.
- Existing `SECURITY DEFINER` advisor warnings require targeted review of each RPC's internal authorization checks.
- Database performance-advisor findings should be handled as separate scale/performance work after functional stability.
- The legacy Trainer still contains historical internal version/copy literals. Runtime-visible version and persisted session provenance are centralized at `0.9.3`; a later controller cleanup can remove those literals without mixing controller refactoring into this security release.
- The learner-facing BN01 feedback label in the legacy controller still uses older “Treble Pitch” wording even though the scoring semantics are already correct; this is a copy/UX issue, not a scoring defect.

## Release decision

**v0.9.3 production cutover is complete.**

The P0 Mastery evidence-forgery issue identified by the audit is closed at the browser, database privilege and trusted-persistence layers. Automated Node + Chrome regression is green on `main`, the server scorer is active, the restricted RPC remains service-role only, and post-cutover database integrity checks are clean.
