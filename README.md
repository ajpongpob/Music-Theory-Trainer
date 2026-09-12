# Major Scale Notation Trainer v0.7.2

## Checkpoint goal
Dashboard modularization with no intended behavior change.

### New dashboard modules
- `src/dashboard/dashboard-utils.js` — shared presentation helpers only.
- `src/dashboard/student-dashboard.js` — Student Dashboard data loading, rendering, mastery display, and exercise launch bridge.
- `src/dashboard/teacher-dashboard.js` — Teacher Dashboard summary/detail loading and rendering.

### `src/auth-dashboard.js` now owns
- login/register/password recovery UI
- authentication lifecycle
- role resolution
- top-level screen routing
- logout
- delegation to Student/Teacher Dashboard modules

## Deliberately unchanged
- Notation algorithms
- Note input / selection / dragging
- Accidentals
- Stem and beam logic
- Scoring and answer checking
- Practice/mastery database logic
- Supabase RPC names
- DOM IDs
- CSS

## Architecture checkpoint
This is still classic-script JavaScript. ES Modules/Vite conversion is intentionally deferred. Dashboard Supabase access is intentionally left inside dashboard modules until the data/repository extraction checkpoint, so UI modularization and data-layer refactoring are not mixed in one version.

Test this version against `REGRESSION-CHECKLIST.md` before using it as the next baseline.
