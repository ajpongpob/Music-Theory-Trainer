# M1 Pilot Closeout

Date: 2026-09-12  
Production baseline: **Major Scale Notation Trainer v0.9.3**  
Latest meaningful production commit reviewed: `2fc0252497178aa96f411590c686f708ab357511` — Fix iPhone Safari compact score and touch targets  
Supabase project: `major-scale-trainer` (`ptksuomvpuiesbwrzzif`)

## Decision

**PENDING FINAL MANUAL DEVICE GATE**

No known P0/P1 defect remains from the automated regression, live authenticated Supabase journey, trusted-scoring/security checks, database-integrity checks, Dashboard Mastery UI verification, or required Chrome viewport gates.

M1 is not yet declared `READY` because `PILOT-ACCEPTANCE.md` explicitly requires at least one smoke pass on a **real iPhone running Safari**. Automated Chrome/mobile emulation is complementary evidence and does not satisfy that physical-device requirement.

If the real-iPhone Safari smoke checklist below passes without a P0/P1 defect, the M1 decision may be promoted to **READY**. A non-blocking P2/P3 finding may instead yield **READY WITH MINOR FIXES**.

## Acceptance evidence

| Gate | Status | Evidence |
| --- | --- | --- |
| M1.1 Live End-to-End Verification | PASS | Fresh authenticated production run verified student login, live Learning Path/Stage routing, server-authoritative score 100, five trusted skill rows, denial of direct evidence inserts, immutable retry, Mastery visibility, reload, logout/login recovery, and Teacher Dashboard access. |
| M1.2 Learning Flow UX | PASS | Existing M1.2 regression remains green; current learner Dashboard exposes current Stage, a single recommended next action, learner-facing Thai reasons, coverage/skill gaps, and completed-state behavior. |
| M1.3 Diagnostic + Mastery Experience | PASS WITH EVIDENCE LIMITATION | M1.3 diagnostic-recovery regression is green and production RPC logic was inspected live. The current dedicated QA learner already has practice evidence, so a fresh zero-evidence browser diagnostic was not destructively forced during this closeout. |
| M1.4 Student / Teacher Dashboard | PASS WITH OBSERVATION | Live student and teacher flows pass. Teacher Dashboard exposes not-started/current-stage/completed-stage/latest-Mastery information. An explicit configurable inactivity/stuck alert is not yet implemented and is deferred as a non-blocking teacher-analytics enhancement. |
| M1.5 Chrome device/viewports | PASS | Live Chrome passed 1440×900, 1280×800, tablet landscape, tablet portrait, 390×844, and 360×800 with no dashboard/trainer overflow and correct routing. Compact score reachability and mobile touch targets passed at the compact/mobile sizes. |
| Real iPhone Safari | PENDING | Required physical-device smoke test is not represented by CI or Chrome emulation. |

## Fresh live production verification

A dedicated closeout workflow was run against the deployed GitHub Pages application and live Supabase project using the existing `pilot-qa` environment.

Run: `34702314613`  
Conclusion: **SUCCESS**

Student evidence:

- Exercise: `MAJOR_SCALE_NOTATION`
- Active Stage: `STAGE_1`
- Server-authoritative known-correct score: `100`
- Trusted skill evidence rows: `5`
- Persisted `app_version`: `0.9.3`
- Direct authenticated `attempts` INSERT denied: yes
- Direct authenticated `attempt_skill_results` INSERT denied: yes
- Conflicting retry preserved the original immutable attempt: yes
- Mastery saw authoritative evidence: yes
- Reload recovery: yes
- Logout/login recovery: yes
- Teacher Dashboard check with configured QA class/student: PASS

Responsive production evidence:

- Chrome 1440×900: PASS
- Chrome 1280×800: PASS
- Chrome 1024×768 tablet landscape: PASS
- Chrome 768×1024 tablet portrait: PASS; all three compact notation systems reachable
- Chrome 390×844 mobile: PASS; all three compact systems reachable; touch targets PASS
- Chrome 360×800 mobile: PASS; all three compact systems reachable; touch targets PASS

## Learner-facing Dashboard Mastery gate

An earlier successful live run exposed a test-coverage weakness: a transient browser `get_my_stage_mastery` fetch/CORS error appeared in console while the live suite still passed because it verified the Mastery RPC directly rather than asserting the rendered learner-facing Mastery panel.

The closeout branch therefore adds `tests/live-dashboard-mastery.browser.cjs` and integrates it into `Live Pilot QA`.

The new gate fails when:

- the Dashboard Mastery panel remains in an error state;
- the learner sees `โหลดผลการเรียนไม่สำเร็จ`;
- a Mastery/CORS/failed-fetch console error is emitted;
- reload does not recover the rendered Mastery state.

Fresh production verification passed both initial load and reload. The panel rendered overall Mastery, threshold, evidence count, coverage state, and all five per-skill results. The earlier CORS symptom did **not** recur. Its exact earlier cause is not established and is therefore not attributed to a specific root cause.

## Production regression and data integrity

The production commit `2fc0252497178aa96f411590c686f708ab357511` passed the normal GitHub `QA` workflow, including:

- all Node regression suites;
- real Chrome fixture-backend E2E;
- mobile touch/compact-score E2E.

Post-closeout live database checks returned zero for:

- orphan attempts;
- orphan skill results;
- duplicate question slots;
- duplicate attempt/skill rows;
- invalid Stage references;
- Exercise/Stage mismatches.

## Diagnostic evidence note

The current recommendation policy in production remains deterministic:

- zero practice + zero pre-test evidence → `diagnostic`;
- interrupted pre-test before practice → restart/continue diagnostic with `INCOMPLETE_DIAGNOSTIC` explanation;
- completed diagnostic below threshold before practice → practice recommendation with score-versus-threshold explanation;
- practice evidence then drives coverage, skill-gap, overall-threshold, and advance recommendations.

The M1.3 regression verifies that placement is invoked only after the planned diagnostic is complete, placement authority remains backend-controlled, and the M1.3 recovery change does not alter mastery thresholds or skill thresholds.

A future dedicated **fresh diagnostic QA identity** would allow this specific zero-evidence browser journey to be included in routine live acceptance without resetting the existing QA learner.

## Security follow-up outside the M1 P0 evidence-forgery closure

The current Supabase security advisor still reports inherited warnings requiring targeted review:

- 13 authenticated-callable `SECURITY DEFINER` RPCs;
- Auth leaked-password protection disabled.

These findings do not reopen the v0.9.3 browser evidence-forgery path: trusted Major Scale scoring remains behind the authenticated Edge Function and the service-only `SECURITY INVOKER` persistence RPC. Nevertheless, each `SECURITY DEFINER` RPC should receive a function-by-function authorization review before broader deployment; leaked-password protection should be enabled when the account configuration permits it.

## Required real-iPhone Safari smoke checklist

Use the deployed production URL and a dedicated QA learner only.

1. Open the production site in **Safari on a physical iPhone**.
2. Log in with the dedicated QA student and confirm the Student Dashboard renders normally.
3. Confirm the current Mastery panel loads overall score/threshold and per-skill results; it must not show `โหลดผลการเรียนไม่สำเร็จ`.
4. Tap the recommended/current-Stage action and confirm the Trainer opens the same Stage and the Level selector remains locked by Learning Path authority.
5. Confirm all three compact notation systems can be reached by normal vertical scrolling; no system is permanently hidden behind the palette/browser chrome.
6. Confirm the palette and controls do not cover the intended notation touch targets.
7. Tap/select a note and exercise representative touch interactions: move/drag pitch, accidental, duration, stem, and beam controls.
8. Submit at least one disposable QA response and confirm the result UI remains usable.
9. Return to Dashboard and confirm persisted progress/Mastery is still visible.
10. Reload the page; confirm authentication/Dashboard recovery and no blank, frozen, or permanently unclickable state.
11. Rotate portrait ↔ landscape once and confirm the interface remains recoverable and scrollable.

Record device model, iOS version, Safari result (`PASS`/`FAIL`), and any finding with a screenshot if available.

## Closeout change set

This closeout branch intentionally does **not** modify production notation, scoring, Mastery rules, progression rules, or Supabase schema.

Net code/repository changes are limited to:

- add `tests/live-dashboard-mastery.browser.cjs`;
- add that learner-facing Dashboard Mastery gate to `.github/workflows/live-pilot.yml`;
- add this closeout evidence record.

After the real-iPhone Safari gate passes, record the device evidence and change the M1 decision to the applicable official status before beginning M2 Adaptive Learning Foundation work.
