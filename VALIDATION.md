# Validation — v0.7.2

## Automated structural checks passed

- JavaScript syntax (`node --check`) passed for every `.js` file.
- All local files referenced by the app returned HTTP 200 from a local static server.
- 97 HTML IDs remain unique.
- 106 literal `$("id")` / `$('id')` JavaScript references were checked; none point to a missing HTML ID.
- `styles/app.css` is byte-for-byte identical to tested v0.7.1.
- `src/keyboard.js` is byte-for-byte identical to tested v0.7.1.
- `src/data/supabase-client.js` is byte-for-byte identical to tested v0.7.1.
- `src/data/auth.repository.js` is byte-for-byte identical to tested v0.7.1.
- `src/trainer.js` differs from v0.7.1 only in `app_version: "0.7.1"` -> `"0.7.2"`.
- No stale references to the moved dashboard-local state/functions remain in `src/auth-dashboard.js`.
- No `service_role` string/key is present in runtime frontend files.
- Dashboard RPC calls are now located in their respective dashboard modules.

## Intentional structural changes

- Shared dashboard presentation helpers moved to `src/dashboard/dashboard-utils.js`.
- Student Dashboard functions/state moved to `src/dashboard/student-dashboard.js`.
- Teacher Dashboard functions/state moved to `src/dashboard/teacher-dashboard.js`.
- `src/auth-dashboard.js` delegates dashboard loading/actions to those modules.
- Sign-out invalidates both dashboard modules' in-flight load tokens.
- Teacher class refresh/change remain protected by the teacher dashboard load token.

## Not automatically verified here

A complete browser end-to-end test against the live Supabase project was not performed in this build environment. Use `REGRESSION-CHECKLIST.md` on the deployed GitHub Pages site before declaring v0.7.2 the new baseline.
