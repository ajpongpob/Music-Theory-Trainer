# QA Report — v0.7.2.1

Date: 2026-09-12
Scope: regression validation after Teacher Dashboard modularization hotfix.

## Release decision

**PASS for user acceptance testing.**

The known v0.7.2 regression (`dashboardCompletionDate is not defined`) is fixed. No additional Critical/High runtime issue was found in the tested Auth/Dashboard paths.

## 1. JavaScript syntax

`node --check` passed for every runtime JavaScript file:

- `src/data/supabase-client.js`
- `src/data/auth.repository.js`
- `src/dashboard/dashboard-utils.js`
- `src/dashboard/student-dashboard.js`
- `src/dashboard/teacher-dashboard.js`
- `src/auth-dashboard.js`
- `src/trainer.js`
- `src/keyboard.js`

## 2. Runtime Auth/Dashboard harness

The actual JavaScript files were loaded in original dependency order in a Node VM with a mocked DOM and mocked Supabase client. No database writes were made.

Passed scenarios:

1. Teacher session -> role routing -> Teacher Dashboard
   - Teacher Dashboard visible
   - class selector populated
   - class metadata rendered
   - student count = 1
   - Learning Path count = 1
   - completed count = 1
   - student `test2` rendered
   - latest mastery `100%` rendered
   - assigned date formatting executed successfully
   - Refresh path completed without runtime error

2. Student session -> Student Dashboard
   - Student Dashboard visible
   - assigned Learning Path rendered
   - Stage 2 current progress rendered
   - mastery detail rendered

3. Login -> Teacher role routing
   - sign-in handler called once
   - Teacher Dashboard opened
   - teacher class/student data rendered

4. Forgot Password
   - reset-password request invoked
   - confirmation message rendered

5. Recovery / Set New Password
   - reset panel opened
   - password update invoked
   - local sign-out invoked
   - returned to Login panel

All runtime scenarios completed with **zero captured `console.error` messages**.

The same harness was also run against v0.7.1 (the previously user-tested baseline), and both v0.7.1 and v0.7.2.1 passed the same scenarios.

## 3. Regression isolation

Compared with v0.7.2:

Unchanged byte-for-byte:

- `styles/app.css`
- `src/keyboard.js`
- `src/data/supabase-client.js`
- `src/data/auth.repository.js`
- `src/dashboard/dashboard-utils.js`
- `src/dashboard/student-dashboard.js`
- `src/auth-dashboard.js`

`src/trainer.js` is identical after normalizing only:

- `app_version: "0.7.2"` -> `app_version: "0.7.2.1"`

Functional hotfix in `src/dashboard/teacher-dashboard.js`:

- added `dashboardCompletionDate` to the functions obtained from `dashboardUtils`.

`index.html` changes from v0.7.2 are version labels only.

The trainer is also identical to the user-tested v0.7.1 after normalizing the `app_version` string.

## 4. HTML / DOM validation

- 97 HTML IDs found
- 97 unique IDs
- no duplicate IDs
- 89 statically detected `getElementById` / `$()` references
- no missing referenced IDs
- all local `<script>` and `<link>` paths exist

## 5. CSS structural validation

- opening braces: 841
- closing braces: 841
- two `@import` declarations remain at the beginning of the stylesheet

## 6. Static hosting smoke test

A local static HTTP server returned HTTP 200 for:

- `index.html`
- `styles/app.css`
- every runtime JavaScript file

## 7. Frontend security checks

- no `service_role` reference in runtime frontend files
- exactly one Supabase publishable key occurrence in runtime source
- Supabase client creation remains centralized in `src/data/supabase-client.js`

## 8. ZIP integrity

`unzip -t` reports no compressed-data errors.

## Limitation

An automated real Chromium end-to-end run could not be completed reliably in this container because the environment blocks/hangs local browser execution. Therefore this QA does **not** replace final testing in a real browser against the live Supabase project.

The runtime mock tests specifically cover the dependency/module regression that caused the v0.7.2 Teacher Dashboard failure, while Trainer/Notation risk is controlled by byte-level comparison to the already tested baseline.

## User acceptance tests still required

Before declaring v0.7.2.1 the new baseline, test on the deployed GitHub Pages site:

- Teacher login and Teacher Dashboard
- Student login and Student Dashboard
- Forgot / Reset Password
- Dashboard -> Trainer -> Dashboard
- 5-question practice session
- note input and drag
- accidentals including double sharp/flat
- stem direction
- primary/secondary beams, especially 8th + 16th terminal hook
- scoring and stage progression

