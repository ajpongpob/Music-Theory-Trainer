# Review v0.8.1-a Shared Notation Core Extraction

Use source as truth. Baseline is v0.8.0-c, preserved unchanged. Do not start renderer/beam/interaction/keyboard extraction or another checkpoint. Read NOTATION-AUDIT.md before reviewing the five production paths in MIGRATION-MANIFEST.json.

Verify the new notation-core.js contains only the existing pitch, spacing, accidental offset and lookup expressions. Confirm exact E4 reference, −14/20 bounds supplied by Trainer, original return structures/errors, no new normalization and no new duration model. Original function bodies should match coreExactCopies; clamping only parameterizes existing bound names. Existing named wrappers preserve callers.

Run all tests/*.test.js, syntax checks and tests/exercise-routing.browser.cjs with Playwright/Chrome. Default tests load the delivered core. The characterization-only NOTATION_BASELINE mode was used on pre-extraction source, not as a substitute for target testing. Confirm cumulative source restoration a→c→corrected b and protected production hashes without changing fixtures to conceal unrelated edits.

Review Major Scale's sole domain change: accidentalOffset delegates to shared core. Ensure 29-key, 261-evaluation and 24-generator golden fixtures remain unchanged. Confirm natural '.', rejected N, inward final-sixteenth hook, actual browser return/reopen and persistence safeguards. Backend is mocked; do not claim live Supabase QA.

Core must have no DOM/network/Supabase/scale/key/stage knowledge. The old namespace name MajorScaleApp is reused intentionally. staffStepToPitch/keyAcc is inherited Trainer coupling, explicitly not moved into shared core. No key table, scoring, stem, beam, gesture, state or renderer rewrite is permitted. Stop at v0.8.1-a; no deployment or database change.
