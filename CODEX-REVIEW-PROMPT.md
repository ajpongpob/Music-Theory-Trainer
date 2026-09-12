# Codex read-only review prompt — v0.7.4

Audit this repository **without modifying files**.

Compare v0.7.4 against the last known-good v0.7.3 baseline if available.

Review goals:
1. Confirm the refactor is limited to Practice/Mastery data-access extraction plus version/test/documentation changes.
2. Confirm notation, input, accidental, stem, primary/secondary-beam, scoring, answer-checking, and session-summary algorithms were not unintentionally changed.
3. Confirm `src/trainer.js` no longer directly calls Supabase `.from()`, `.rpc()`, or auth APIs.
4. Verify `src/data/practice.repository.js` reproduces the previous Supabase query semantics exactly.
5. Verify `src/data/mastery.repository.js` reproduces the previous progress/mastery query and RPC semantics exactly, including RPC argument names.
6. Verify the existing async persistence safeguards remain intact: generation guard, attempt save chain, skill-evidence gating, progress gating, and progression error handling.
7. Verify script load order in `index.html` loads repositories before `trainer.js`.
8. Confirm no `service_role` or privileged secret exists in browser code.
9. Run every test in `tests/*.test.js` and report failures exactly.
10. Inspect for undefined globals, broken relative paths, duplicate DOM IDs, accidental direct data access outside `src/data/`, and race-condition regressions.
11. Pay particular attention to `closePracticeSession(... onlyIfOpen)`, stale-session cleanup, and the Attempt -> Skill Results -> Session Progress -> Stage Progression chain.
12. Do not refactor or fix anything yet. Report findings only.

Report findings by severity: Critical / High / Medium / Low, then give PASS / PASS WITH ISSUES / FAIL.
