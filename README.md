# Major Scale Notation Trainer v0.8.1-a

Shared Notation Core Extraction. This remains a static classic-JavaScript SPA with the same user-visible Major Scale behavior as v0.8.0-c. No build, framework or database migration.

Platform / Dashboard → Exercise Host → Registry → Major Scale adapter/module → Trainer controller → shared pure core + unchanged legacy rendering/interaction/beaming → repositories → Supabase.

## Shared core

`src/domain/notation/notation-core.js` exposes one frozen `MajorScaleApp.notationCore` object using the existing app namespace. Eight functions:

- `pitchToStep(letter, octave)` and `stepToPitch(step)`: original E4=0 diatonic convention.
- `clampStaffStep(step, MIN_STAFF_STEP, MAX_STAFF_STEP)`: exact arithmetic; Trainer supplies its original −14/20 limits.
- `musicEm(staffObj)` and `sp(staffObj, value=1)`: original spacing arithmetic only.
- `accidentalOffset(symbol)`: original internal-symbol offsets and exact unsupported-symbol error.
- `rhythmFromShortcut(key)` and `accidentalFromShortcut(key)`: original lookup expressions. These do not register keyboard listeners or edit notes.

The core has no DOM, SVG, network, repository, session, scale/key or stage knowledge. There is no newly invented accidental normalizer or duration arithmetic. State remains in Trainer. Renderer, beam functions, gestures, stem rules and keyboard event code remain legacy. Major Scale delegates its existing accidentalOffset helper; its spelling/generation/scoring logic stays in the exercise module.

## Run as a static site

Serve this folder, for example with `python3 -m http.server 8000`, or use GitHub Pages. No npm install/build or Node backend is required for deployment. Existing Supabase CDN and font dependencies are unchanged and need network access. This checkpoint was not deployed.

## Run QA

With Node installed: `for t in tests/*.test.js; do node "$t" || exit 1; done`.

Actual browser suite: `PLAYWRIGHT_MODULE=/path/to/playwright node tests/exercise-routing.browser.cjs` with Chrome installed. Tooling is QA-only; backend data is mocked. Default test runs exercise the delivered shared core.

Read NOTATION-AUDIT.md (pre-extraction decisions), QA-REPORT.md, VALIDATION.md, REGRESSION-CHECKLIST.md, SEARCH-AUDIT.md and MIGRATION-MANIFEST.json. EXTRACTION-AUDIT.md and the b/c golden fixtures are preserved historical evidence from the prior checkpoint. Stop at v0.8.1-a; no renderer, beam, interaction or keyboard extraction follows in this delivery.
