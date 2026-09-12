# v0.7.4 Validation

Baseline: v0.7.3 QA-passed and confirmed working on deployed GitHub Pages by the user.

## Structural checks
- All runtime JavaScript files pass `node --check`.
- All test JavaScript files pass `node --check`.
- `trainer.js` contains no direct `window.majorScaleSupabase`, `client.from()`, `client.rpc()`, or direct `client.auth.getUser()` access.
- Practice persistence is centralized in `src/data/practice.repository.js`.
- Mastery/progress reads and progression RPCs are centralized in `src/data/mastery.repository.js`.
- Student/Teacher Dashboard modules remain free of direct `.from()` / `.rpc()` calls.
- Repository modules do not access the DOM.
- Script load order places all required repositories before `trainer.js`.
- 97 DOM IDs found; all 97 are unique.
- 84 literal `getElementById()` references were checked; none point to a missing ID.
- Browser source contains no `service_role` marker.
- The Supabase publishable key occurs exactly once in runtime source.

## Baseline protection checks
Byte-identical to v0.7.3:
- `styles/app.css`
- `src/keyboard.js`
- `src/auth-dashboard.js`
- `src/data/supabase-client.js`
- `src/data/auth.repository.js`
- `src/data/dashboard.repository.js`
- `src/dashboard/dashboard-utils.js`
- `src/dashboard/student-dashboard.js`
- `src/dashboard/teacher-dashboard.js`

Critical Trainer/domain functions compared against v0.7.3 and confirmed unchanged (18 functions), including:
- Major Scale construction / expected answer
- beam stem direction
- score layout / note rendering
- primary/secondary beam construction
- note pitch movement / beam normalization
- answer checking / scoring / mastery evaluation
- question feedback
- session aggregation / summary / finish flow

## Repository contract tests
- Dashboard repository: PASS (7 operations).
- Practice/Mastery repositories: PASS (17 operations), including exact table names, filters, RPC names, and RPC parameter names.

## Runtime/mock smoke tests
PASS:
- Teacher Dashboard
- Student Dashboard
- Login -> Teacher routing
- Forgot Password
- Reset Password
- Current Stage lookup from generic Stage progress
- Missing required-item coverage lookup
- Mastery Progress refresh
- Practice-session creation and stale-session close
- Attempt -> skill evidence -> session progress -> progression RPC -> session completion

## Error-path safeguards
PASS:
- Stale session generation cannot create a session or Attempt.
- Skill-evidence write failure blocks session-progress update and Stage advancement.
- Progression RPC failure does not complete the practice session.
- Anonymous user does not create a practice session.

## Static hosting check
A local static HTTP server returned HTTP 200 for `index.html` and all 12 local runtime CSS/JS assets (13 URLs total).

## Scope note
These tests verify source/package behavior with deterministic mocks. They do not replace the final live Supabase/browser regression test on the deployed GitHub Pages build.
