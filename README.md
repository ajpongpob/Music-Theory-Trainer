# Major Scale Notation Trainer v0.9.3

Major Scale Notation Trainer is a static classic-JavaScript learning application backed by Supabase Auth/PostgreSQL. The current architecture is:

`Auth / Student Dashboard / Teacher Dashboard → Exercise Host → Major Scale runtime → notation modules → repositories → Supabase`

v0.9.3 adds a trusted scoring boundary for Mastery evidence:

`raw notation response → authenticated Edge Function → server Major Scale scorer → service-only persistence RPC → attempts + skill evidence → Mastery → progression`

The browser no longer has direct INSERT authority for `attempts` or `attempt_skill_results`. Client-computed feedback remains useful for immediate UX, but Mastery and Learning Path progression depend on evidence recomputed by the server.

## Current learning architecture

- Supabase Auth with student/teacher roles.
- `MUSIC_THEORY_FOUNDATIONS` Learning Path.
- `MAJOR_SCALE_NOTATION` Exercise with four active Stages.
- Rolling Mastery evidence, item coverage, overall threshold and five skill thresholds.
- Diagnostic/pre-test placement.
- Student Dashboard recommendations.
- Read-only Teacher Dashboard with class authorization.
- RLS-backed Stage enforcement: learner sessions may persist only in an `in_progress` or already `mastered` Stage.

## Major Scale scoring policy

The application supports 29 Major keys through double sharps/flats. The five scored skills are:

- `BN01_TREBLE_PITCH` — pitch name; octave is intentionally not part of correctness.
- `BN06_STEM_DIRECTION` — stem direction; an independent B4 middle-line note accepts either up or down.
- `RH01_DURATION_VALUE` — duration value.
- `GR02_PRIMARY_BEAM` — expected primary beam grouping.
- `MS03_SCALE_ACCIDENTAL` — scale accidental, scored separately from pitch name.

Weights remain Pitch 30%, Stem 10%, Duration 15%, Beam 15%, Accidental 30%.

## Trusted attempt submission

`src/data/practice.repository.js` sends only session/question/item metadata plus the raw notation response to the `submit-major-scale-attempt` Edge Function. It does not forward the browser-computed score or skill evidence.

The Edge Function uses `supabase/functions/submit-major-scale-attempt/scoring.mjs` to recompute the result and then calls `persist_scored_major_scale_attempt` using the server-only service role. The RPC validates session ownership, current Stage authorization, item membership, sequential question slots and the complete five-skill evidence shape before writing evidence atomically.

The migration is:

`supabase/migrations/20260912_v093_authoritative_attempt_submission.sql`

## Static deployment

The frontend still requires no build step. It may be served with GitHub Pages or any static HTTP server. Supabase and font/CDN dependencies require network access.

## QA

Run every Node regression suite:

```bash
for t in tests/*.test.js; do node "$t" || exit 1; done
```

Run the real-Chrome fixture-backend UI suite:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_CHANNEL=chrome node tests/exercise-routing.browser.cjs
```

GitHub Actions runs both automatically. The browser suite uses a fixture backend and therefore validates real browser interaction/UI flow, not live Supabase persistence. Live database authorization and persistence are verified separately with Supabase queries/transactional smoke tests.

Important v0.9.3 regressions include:

- all historical Major Scale domain tests;
- 29-key server/client scoring parity;
- octave-independent BN01;
- separate MS03 accidental evidence;
- independent B4 stem up/down;
- server-only attempt/evidence persistence boundary;
- Stage enforcement and Mastery/progression contracts;
- real Chrome notation/dashboard interaction regression.

Historical extraction/audit documents remain in the repository as checkpoint evidence; current release documentation should be read together with `QA-REPORT-v0.9.3.md` and `MIGRATION-MANIFEST.json`.
