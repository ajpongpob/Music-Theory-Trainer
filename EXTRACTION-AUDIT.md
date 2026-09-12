# Pre-implementation audit: v0.8.0-c

Baseline: v0.8.0-b with the explicitly authorized Feedback inert correction. All 13 existing unit/mock suites and the actual browser routing test passed before extraction began. The browser test now follows Feedback → Mastery → Continue before clicking Dashboard. Original b is backed up in the sibling `-before-feedback-fix` folder.

| Actual symbol / block | Current file | Category | Move in c? | Reason |
|---|---|---|---|---|
| KEYS, LEVEL_KEYS, LO_META, LO_WEIGHTS | src/trainer.js | Major Scale configuration | Yes | Exact key pools, stage membership, labels and score weights |
| parseTonic, accidentalOffset, notePc, buildMajorScale, ascendingScaleWithOctaves | src/trainer.js | Major Scale domain | Yes | Pure spelling, including theoretical keys |
| buildExpected | src/trainer.js | Major Scale answer pattern | Yes, keep default-key wrapper | Fixed 15-note exercise pattern; inject unchanged notation helpers |
| check | src/trainer.js | Major Scale evaluation | Yes, keep controller wrapper | Return shape remains {score, lo, expected} |
| percent, makeEvidence, weightedScore | src/trainer.js | Evaluation helpers | Yes, aliases for summary | Preserve rounding, null applicability, LO weights |
| shuffle, refillSessionBag, takeNextQuestionFromBag | src/trainer.js | Major Scale generation / state | Pure portions | Module returns key/bag/priority data; controller owns state and logging |
| autoStem, beamStemDirectionFromNotes, pitchToStep, effectiveStem, beamGroupSignatures | src/trainer.js | Shared notation helpers | No | Pass existing functions into domain rules; preserve bodies exactly |
| drawSignature, drawExample, drawScore, drawNote, drawBeams, buildBeamSegments, getBeamDirection, getBeamLevel, render | src/trainer.js | Notation rendering | No | Geometry and rendering stay legacy |
| noteInteraction, pointer listener blocks, selectNoteRange, setMobileRangeSelectMode, insertNoteAtCursor, moveCursor | src/trainer.js | Notation input | No | No selection, pitch, cursor or keyboard behavioral change |
| MASTERY_CRITERIA, MASTERY_UI_THRESHOLDS, evaluateMastery, advanceLevelIfMastered | src/trainer.js | Mastery/controller | No | Thresholds and progression must remain identical |
| startTrainerForAuthenticatedUser, startSession, startQuestion, resetQuestionWorkspace | src/trainer.js | Controller | No (delegation only) | Keep runtime entry and question/session lifecycle |
| showQuestionResultTransition, hideQuestionResultTransition, finishSession | src/trainer.js | Popup/controller | No | Inert correction completed and tested in baseline first |
| resolveMajorScaleExerciseStage, createPracticeSessionRecord, saveAttemptRecord, saveAttemptSkillResults, snapshotAttemptResponse | src/trainer.js | Repository orchestration | No | Preserve persisted payloads and lazy session creation |
| repository implementations | src/data/* | Data access | No | Existing repositories remain sole backend access |

## Dependency plan

New config and domain classic scripts use only the existing MajorScaleApp namespace. Config loads before domain; both before adapter/definition and Trainer. Host/Registry APIs remain unchanged. Domain rules receive legacy notation callbacks explicitly; no DOM/client/session object crosses into the domain.

## Question and result contracts

The existing question is a key record `{name, tonic, acc, type}`. Stage level, active key and bag remain controller-owned; do not introduce a second question state. Generator inputs are level, bag, previous tonic and priority item codes; output includes selected key, remaining bag and priority flag. Expected notes retain letter, accidental, octave, rhythm, measure, optional beamGroup, stem. Evaluation returns `{score, lo, expected}`; each unchanged skill code maps to `{flags, correct, total, score}`. No feedback HTML, Attempt payload, skill-result payload or RPC signature changes.

## Remaining legacy coupling

Trainer retains stage validity checks through a config alias and repository orchestration references to the exercise code. This is a gradual Major Scale extraction, not a generic Trainer rewrite. Runtime adapter continues to invoke the same start/close entry points. All notation/controller bodies outside explicit wrappers must compare byte-for-byte to the corrected b baseline.
