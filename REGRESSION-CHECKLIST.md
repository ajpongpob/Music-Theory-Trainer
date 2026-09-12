# v0.8.1-a Regression Checklist

| Area | Evidence | Status |
|---|---|---|
| Namespace + pure helper behavior | notation-core test, frozen API / fresh output / input invariance | PASS |
| E4=0; C4/D4/B4/C5; lower/upper staff bounds | explicit assertions + 63 pitch / 50 step / 11 clamp fixtures | PASS |
| Pitch movement | unchanged moveSelectedPitch executed with new helpers, 80 baseline cases | PASS |
| Accidentals / note-value lookups | original offset errors and exact lookup data | PASS |
| Major Scale calling shared helper | actual domain accidentalOffset delegation and pitch callback tests | PASS |
| Spelling / generation / expected answer / scoring / octave behavior | inherited golden suites | PASS |
| Contract / Registry / Host / unsupported / context / single launch | inherited suites | PASS |
| Auth / recovery / Student / Teacher Dashboard | inherited mock runtime scenarios | PASS |
| Practice/Mastery/repository success + error safeguards | inherited suites | PASS |
| Feedback / natural . and rejected N | inherited popup/keyboard and browser tests | PASS |
| Note click / pitch drag / Shift/mobile-width range / durations / stems | actual Chrome browser | PASS |
| Primary beam/remove / 2+4 expected groups | browser and inherited golden tests | PASS |
| Final 16th inward hook after 8th | inherited geometry test, both stems | PASS |
| Renderer / pointer handlers / gestures / beam functions / controller | exact c reconstruction hash | BYTE-IDENTICAL outside listed pure helpers |
| Keyboard / CSS / Auth / Dashboards / Host / repositories | exact file hashes | BYTE-IDENTICAL |
| Static HTTP, paths, script order, DOM IDs/references | automated suites | PASS |
| Live backend, physical touch, other engines/assistive technology | not exercised | MANUAL FOLLOW-UP |

No interaction, keyboard event, beam or renderer extraction. No threshold/Attempt/RPC/schema change. ZIP rerun details: DELIVERY-CHECKS.txt. Stop here.
