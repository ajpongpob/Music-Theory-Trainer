# v0.7.1 Validation Report

## Automated checks completed

- JavaScript syntax (`node --check`) passes for:
  - `src/data/supabase-client.js`
  - `src/data/auth.repository.js`
  - `src/auth-dashboard.js`
  - `src/trainer.js`
  - `src/keyboard.js`
- Script load order is explicit and correct:
  1. Supabase CDN
  2. `supabase-client.js`
  3. `auth.repository.js`
  4. `auth-dashboard.js`
  5. `trainer.js`
  6. `keyboard.js`
- `createClient()` now occurs in one file only: `src/data/supabase-client.js`.
- The Supabase publishable key occurs in the client configuration file only.
- No service-role credential is present in application JavaScript.
- Authentication operations used by `auth-dashboard.js` are routed through `auth.repository.js`.
- Student/Teacher Dashboard RPC calls remain unchanged.
- `trainer.js` is unchanged from v0.7.0 except `app_version` -> `0.7.1`.
- `keyboard.js` and `styles/app.css` are unchanged from v0.7.0.
- Static HTTP path checks return successfully for `index.html`, CSS, and all JavaScript files.

## Deliberately retained compatibility

`window.majorScaleSupabase` remains as a temporary compatibility bridge because the existing trainer still consumes the shared Supabase client. Removing it is deferred until the Practice/Data layer is refactored.

The trainer still contains several direct `client.auth.getUser()` calls used to identify the authenticated user while saving/loading practice data. Those calls are deliberately untouched in v0.7.1 and will be moved with the Practice repository checkpoint rather than mixed into this Auth UI refactor.

## Manual verification still required

Automated structural checks cannot prove browser behavior. Use `REGRESSION-CHECKLIST.md` on the deployed GitHub Pages build before accepting v0.7.1 as the next stable baseline.
