# Codex Review Prompt — v0.7.1

Audit this repository as a read-only code reviewer. Do not modify files yet.

Baseline: v0.7.0 was manually verified to work on GitHub Pages.
Current checkpoint: v0.7.1 extracts the Supabase client and authentication data-access layer while intentionally preserving application behavior.

Review goals:

1. Compare v0.7.1 with v0.7.0 if the baseline commit/tag is available.
2. Confirm that `src/trainer.js` changed only by the `app_version` value.
3. Confirm that notation, scoring, input, beaming, secondary-beam, accidentals, selection, and mastery behavior were not refactored in this checkpoint.
4. Check script load order and dependencies among:
   - Supabase CDN
   - `src/data/supabase-client.js`
   - `src/data/auth.repository.js`
   - `src/auth-dashboard.js`
   - `src/trainer.js`
   - `src/keyboard.js`
5. Check that only a publishable Supabase key is present in browser code and that no `service_role` credential exists.
6. Review `auth.repository.js` for behavior parity with the previous direct Supabase Auth calls:
   - get session
   - get user
   - auth state listener
   - sign in
   - sign up + full_name metadata
   - local sign out
   - password reset email + redirect
   - password update
   - profile role lookup
7. Verify Student Dashboard and Teacher Dashboard RPC calls remain unchanged.
8. Check for race conditions around auth-state events, initial session loading, password recovery, and role routing.
9. Check that `window.majorScaleSupabase` compatibility behavior remains sufficient for the existing trainer.
10. Run syntax/static checks and any safe browser/smoke tests available.
11. If browser automation is available, test student login, teacher login, dashboard routing, logout, and password-recovery UI without modifying production data unnecessarily.
12. Report issues by severity: Critical / High / Medium / Low.
13. Distinguish true regressions from pre-existing technical debt.
14. End with a recommendation: PASS, PASS WITH MINOR ISSUES, or BLOCK BEFORE v0.7.2.

Do not rewrite architecture or implement fixes until the audit has been reviewed.
