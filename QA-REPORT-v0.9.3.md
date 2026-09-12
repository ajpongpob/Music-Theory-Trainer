# QA Report — v0.9.3 Authoritative Mastery Evidence

Date: 2026-09-12  
Baseline: `v0.9.2` / `83242bb919c7e549f8335bc0f79f15c3d5e760d4`

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

The release migration removes direct authenticated INSERT policy/grant access to `attempts` and `attempt_skill_results` after the server path is deployed.

## Live Supabase verification performed before final cutover

The Edge Function `submit-major-scale-attempt` was deployed ACTIVE with JWT verification enabled.

The persistence RPC was deployed and checked with:

- `authenticated` EXECUTE: false
- `anon` EXECUTE: false
- `service_role` EXECUTE: true

A rollback-only database smoke transaction created a temporary Stage-authorized practice session, persisted one authoritative attempt plus all five skill rows, verified the persisted result, then retried the same question with conflicting score/evidence. The retry returned the original immutable attempt. The transaction was rolled back, leaving no test row in production.

No real learner row was edited or deleted during this verification.

## Automated regression

GitHub Actions was added for Node 22 plus real Chrome.

A full source run on commit `8830c2ba1e304a2ec82ebcd7abc2d9beb9558a6f` passed the Node step, including:

- all inherited contract/runtime tests;
- 29 Major Scale spellings/expected answers;
- 261 historical golden evaluations;
- 24 deterministic question-generation sequences;
- notation core/renderer/interaction/beaming suites;
- path-stage enforcement;
- v0.9.2 pitch/octave/B4 stem regression;
- v0.9.3 authoritative-attempt security contract;
- v0.9.3 server/client scoring parity.

The same CI run passed the existing real-Chrome E2E suite after installing pinned Playwright. The browser suite uses a fixture backend; it validates real UI/interaction behavior, not live Supabase transport.

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

## Remaining limitations

- Real Chrome CI uses the fixture backend. A fresh authenticated browser-to-live-Edge-to-live-DB journey requires a dedicated disposable QA account/session and is not claimed by this report.
- Supabase Auth leaked-password protection is still an account configuration item and was not changed by this source release.
- Existing Security Advisor warnings for other intentionally exposed `SECURITY DEFINER` RPCs require function-by-function review; v0.9.3 does not broadly rewrite those functions.
- Existing database performance-advisor findings (foreign-key indexes and RLS init-plan optimization) are separate scale/performance work, not part of this security correction.
- The legacy trainer still contains historical internal version/copy literals. Runtime-visible version and persisted session provenance are centralized at `0.9.3`; a later controller cleanup can remove historical literals without mixing that refactor into this security release.

## Release decision

The P0 issue identified by the audit is addressed in architecture and regression coverage. Final release cutover requires the migration's direct authenticated INSERT revocations to be applied after the v0.9.3 client path is merged/deployed, followed by post-cutover privilege/integrity verification.
