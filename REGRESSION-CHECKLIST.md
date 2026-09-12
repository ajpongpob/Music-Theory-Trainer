# v0.8.0-a Regression Checklist

Because this checkpoint must not change runtime behavior, verify the same user flows as v0.7.5:

- Student login → Student Dashboard.
- Continue/Review `MAJOR_SCALE_NOTATION` opens the trainer.
- Teacher login → Teacher Dashboard renders class/progress.
- Natural shortcut `.` works and `N` does not trigger Natural.
- Checked-answer feedback popup/transition still works.
- 5-question session completes and summarizes normally.
- Attempt/skill results persist normally.
- Stage mastery/progression behaves normally.
- Note input, dragging, selection, accidentals, stems, primary beam, secondary beam remain unchanged.

Architecture-specific:

- App loads without console errors from Exercise Contract/Registry scripts.
- `MAJOR_SCALE_NOTATION` appears exactly once in the Exercise Registry.
- Existing Dashboard runtime behavior is unchanged in this checkpoint.
