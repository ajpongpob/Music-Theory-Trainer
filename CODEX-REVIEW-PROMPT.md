# Codex read-only review prompt — v0.7.2.1

Audit this repository without modifying files. Compare v0.7.2.1 with the previous tested v0.7.1 checkpoint.

Focus on:
1. Confirm dashboard extraction did not change observable Student/Teacher Dashboard behavior.
2. Check classic-script load order and `window.MajorScaleApp` dependencies.
3. Check that auth-dashboard delegates safely to student/teacher dashboard modules.
4. Look for stale references to moved functions or moved state (`dashboardLoadToken`, `teacherDashboardLoadToken`, `teacherDashboardSummaryRows`, `dashboardOpening`).
5. Verify sign-out invalidates pending dashboard loads.
6. Verify Teacher Dashboard class change/refresh race protection remains correct.
7. Verify no changes to notation, beaming, scoring, answer checking, or persistence logic except version metadata.
8. Verify Supabase frontend security: publishable key only; no service_role.
9. Run syntax/static-path checks and any practical browser smoke tests.
10. Report Critical / High / Medium / Low issues. Do not fix them yet.
