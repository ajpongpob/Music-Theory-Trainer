# Editor regression fix: mastery progress fill + post-insert note value editing

Scope is intentionally narrow.

## Fixed
- Mastery Level progress percentage now has a visible proportional fill bar.
- A newly inserted note that remains visibly highlighted can immediately change Rhythm value without requiring an extra click on the note.
- Duration shortcuts 1–5 follow the same behavior.
- Learner hint copy now matches the visible-selection behavior.

## Protected
- No Major Scale scoring changes.
- No mastery thresholds or progression changes.
- No notation engraving, beaming, accidental scoring, stem rules or server-scoring authority changes.

## Regression gates
- Static contract: `tests/editor-progress-note-value.test.js`
- Real Chrome: `tests/editor-progress-note-value.browser.cjs`
