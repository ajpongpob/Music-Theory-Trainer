# Pre-extraction audit — v0.8.1-a

Baseline v0.8.0-c: 34 JS/CJS syntax checks, all 15 inherited test suites (including DOM/static HTTP) and actual Chrome browser routing regression passed before changes. Baseline c folder and its QA-passed ZIP are retained intact; work occurs in a separate a folder. No Git metadata/tag workflow is present.

| Actual function / constant / block | Current location | Category | Dependencies | Move? | Reason |
|---|---|---|---|---|---|
| pitchToStep, stepToPitch | src/trainer.js | A: pure pitch | LETTERS; E4 reference | YES, wrappers stay | Exact diatonic conversion and octave convention |
| clampStaffStep | src/trainer.js | A: pure pitch bounds | MIN_STAFF_STEP=-14, MAX_STAFF_STEP=20 | YES, wrapper passes bounds | No state mutation; preserve exact clamping arithmetic |
| musicEm, sp | src/trainer.js | A: pure unit math | input staffObj.spacing | YES, wrappers stay | Arithmetic only, no SVG read/write; characterize before moving |
| accidentalOffset | src/exercises/major-scale/major-scale.domain.js | A: accidental type | local offset map | YES, wrapper stays | Symbol→offset is shared; scale spelling remains domain-specific |
| literal rhythm lookup inside majorScaleTrainerKeyboard.setRhythm | src/trainer.js | A/E: value lookup | key parameter | YES, expression only | Move exact existing data lookup to rhythmFromShortcut; keep keyboard API/event listener/editing flow |
| literal accidental lookup inside majorScaleTrainerKeyboard.setAccidental | src/trainer.js | A/E: value lookup | key parameter | YES, expression only | Move exact lookup to accidentalFromShortcut; no new normalizer or accepted input convention |
| LETTERS | src/trainer.js | A: diatonic alphabet | autoStem | NO | Original stem implementation retains its constant; core uses same private alphabet |
| MIN_STAFF_STEP, MAX_STAFF_STEP | src/trainer.js | D: editing bounds | clamp wrapper | NO | Keep configured range in Trainer; pass explicitly to core |
| state | src/trainer.js | A/F/G: mixed state | all legacy controller | NO | Global state rewrite is out of scope |
| autoStem, effectiveStem | src/trainer.js | B/C: stem rules | notes/pitch | NO | Preserve stem behavior exactly |
| beamStemDirectionFromNotes, getBeamDirection, getBeamLevel, buildBeamSegments, beamGroupSignatures, drawBeams, normalizeBeamGroups | src/trainer.js | C: beaming | note groups, geometry, SVG/state | NO | Even pure beam helpers stay in place; explicit beaming prohibition |
| SMUFL, accidentalSmuflGlyph, visibleAccidentalForNote | src/trainer.js | B: rendering | glyph map / signatureMode | NO | Glyph/visibility concerns are rendering, not accidental normalization |
| drawSignature, drawExample, drawScore, drawNote, drawLedger, drawAccidentalForNote, render | src/trainer.js | B: rendering | SVG/DOM/state | NO | Preserve bodies exactly |
| layoutMeasureWithinBounds, layoutAllMeasuresWithinBounds, noteVisualHalfWidth, stepToY, yToStep | src/trainer.js | B: layout | measured SVG/state/staff | NO | Do not extract renderer geometry or add new parameterization |
| noteInteraction, pointer listener blocks, eventPointInScore, noteTargetFromEvent | src/trainer.js | D: interaction | events/DOM/SVG/capture | NO | Gesture and hit testing remain legacy |
| selectNoteRange, setMobileRangeSelectMode, moveSelectedPitch, moveCursor, insertNoteAtCursor | src/trainer.js | D/E: editing | state mutation/render | NO | Not pure; preserve the exact movement/selection sequence |
| keyboard.js keydown listener; Trainer keydown listeners; insertLetter | src/keyboard.js; src/trainer.js | E: keyboard | events/DOM/state | NO | Only the two pure data lookup expressions delegate; no event handler extraction |
| staffStepToPitch | src/trainer.js | F: mixed key-specific helper | state.key.name + legacy keyAcc table | NO | Cannot enter shared core: contains Major Scale knowledge; preserved legacy residue |
| buildMajorScale, ascendingScaleWithOctaves, buildExpected, evaluateAnswer, takeNextQuestion | src/exercises/major-scale/major-scale.domain.js | F: exercise domain | config / supplied notation callbacks | NO | Only accidentalOffset delegates to the new core |
| startSession, startQuestion, check, saveAttemptRecord, showQuestionResultTransition, advanceLevelIfMastered | src/trainer.js | G: session/controller | state, UI, repositories | NO | Session, score, feedback and persistence semantics unchanged |
| repositories, Auth, Host, Registry, Dashboards, CSS | existing files | platform/data | existing infrastructure | NO | Outside scope |

## State boundary

Notation fields: notes, selectedIds, tool, cursorIndex, cursorStaffStep, mobileRangeSelectMode, selectionAnchorIndex, mobileRangeAnchorIndex, selectionIsExplicit. Exercise fields: key, level, signatureMode, sessionBag and masteryPriorityItemCodes. Controller/session fields: questionIndex, sessionResults, sessionComplete, isTransitioning, practiceSessionId/generation/promise and attemptSaveChain. Keep the whole existing state object intact; no new state container, clone API or 15-slot generic assumption.

## Mechanical API plan

One new classic script `src/domain/notation/notation-core.js`, exposing one frozen `MajorScaleApp.notationCore` object on the existing namespace. Private constants, no shared mutable state. Eight functions: pitchToStep, stepToPitch, clampStaffStep, musicEm, sp, accidentalOffset, rhythmFromShortcut, accidentalFromShortcut. The last two wrap existing lookup expressions; they are not new input policies or keyboard listeners. No duration arithmetic is invented because the source has none independent of rendering/beaming.

There is no permissive accidental normalization: existing internal symbols are `''`, `#`, `b`, `##`, `bb`; invalid offset symbols retain the same error. Shortcut `.` selects natural; `N` does not. Shared core does not decide which accidental belongs to a scale.

Load the core before Major Scale domain and Trainer. Major Scale still receives pitch/stem/beam callbacks through its existing factory. Characterize existing function bodies/lookups first, then run the same golden cases against the core. Maintain cumulative source reconstruction: a → exact c → exact corrected b, so no renderer/beam/interaction/controller changes can hide behind fixture updates.
