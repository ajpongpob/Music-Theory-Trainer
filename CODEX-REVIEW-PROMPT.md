Audit v0.8.0-a against the user-verified v0.7.5 baseline. READ-ONLY: do not modify files.

Goal: verify that Exercise Contract + Exercise Registry were added without changing application behavior.

Check:
1. Review every diff from v0.7.5.
2. Confirm `src/exercises/exercise-contract.js` has no DOM/Supabase/runtime dependencies.
3. Confirm `src/exercises/exercise-registry.js` validates/registers definitions, rejects duplicates, and normalizes lookup codes.
4. Confirm `MAJOR_SCALE_NOTATION` is registered exactly once as metadata.
5. Confirm Student Dashboard still uses the legacy runtime in v0.8.0-a; registry must not alter exercise launch behavior yet.
6. Confirm `trainer.js` differs only by version metadata from v0.7.5.
7. Confirm notation, scoring, beaming, persistence, mastery, RPCs, repositories, auth, and dashboard rendering logic are unchanged.
8. Run all `tests/*.test.js`.
9. Check script load order and all relative asset paths.
10. Check frontend security: no `service_role`; publishable key only.
11. Report Critical / High / Medium / Low findings and a final PASS / PASS WITH MINOR ISSUES / FAIL.
