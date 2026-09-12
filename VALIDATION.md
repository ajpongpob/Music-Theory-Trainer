# v0.9.3 Validation

Baseline: v0.9.2 (`83242bb919c7e549f8335bc0f79f15c3d5e760d4`).

## Source regression

- Node 22 full `tests/*.test.js` suite: PASS on the v0.9.3 source candidate.
- Major Scale historical domain: 29 spellings/expected answers, 261 evaluations, 24 deterministic sequences: PASS.
- v0.9.2 octave-independent BN01 and independent B4 stem up/down: PASS.
- notation core / renderer / interaction / beaming / boundary suites: PASS.
- Dashboard, Auth, Exercise Host/Registry, Mastery Learning Core and Path Stage Enforcement suites: PASS.
- v0.9.3 authoritative-attempt security contract: PASS.
- v0.9.3 server/client Major Scale scoring parity across all 29 keys: PASS.
- Real Chrome E2E with fixture backend: PASS.

## Live Supabase pre-cutover verification

- `submit-major-scale-attempt` Edge Function: ACTIVE, JWT verification enabled.
- `persist_scored_major_scale_attempt`: `SECURITY INVOKER`.
- RPC EXECUTE: authenticated=false, anon=false, service_role=true.
- Rollback-only transactional persistence test: PASS.
- Attempt + five skill rows written atomically inside test transaction: PASS.
- Conflicting retry of an existing question returned immutable original attempt: PASS.
- No test data retained after rollback.

## Security model

The browser sends raw notation response only. The trusted score and five skill-evidence rows are recomputed by the Edge Function and persisted through the service-only RPC. The release migration revokes direct authenticated INSERT access to `attempts` and `attempt_skill_results` at cutover.

## Scope protection

No production changes were made to:

- `src/trainer.js`
- Major Scale browser domain/scoring implementation
- notation renderer
- notation interaction
- notation beaming
- keyboard behavior
- Dashboard runtime logic
- v0.9.0 Mastery calculation/progression RPCs
- v0.9.1 Stage-enforcement policy

Two previously hash-frozen data files are intentionally changed in v0.9.3 and are covered by dedicated security/repository contract tests:

- `src/data/practice.repository.js`
- `src/data/supabase-client.js`

## Explicit limitations

The Chrome E2E suite uses a fixture backend. It is real browser execution but is not a live authenticated Supabase end-to-end test. Live backend verification is performed independently through Edge deployment inspection, function privileges and rollback-only database transactions.

Supabase Auth leaked-password protection and existing unrelated advisor findings are not changed by this release.

See `QA-REPORT-v0.9.3.md` for the detailed release/security report.
