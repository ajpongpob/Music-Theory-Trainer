# v0.7.0 Manual Regression Checklist

Compare this build directly with the stable v0.6.26 baseline.

## A. Load / Auth
- [ ] Page loads without missing CSS/JS files.
- [ ] Login screen looks the same as v0.6.26.
- [ ] Register works as before.
- [ ] Forgot Password works as before.
- [ ] Reset Password flow works as before.
- [ ] Logout works.

## B. Role routing
- [ ] Student account opens Student Dashboard.
- [ ] Teacher account opens Teacher Dashboard.
- [ ] Teacher Dashboard shows `MT-TEST-01` and assigned Learning Path.
- [ ] Teacher class detail shows student `test2` and its current progress.

## C. Student Dashboard
- [ ] Learning Path status is correct.
- [ ] Exercise status is correct.
- [ ] Stage statuses and mastery scores are correct.
- [ ] Continue/Review opens the same exercise/stage as v0.6.26.

## D. Trainer / notation interaction
- [ ] Note click/tap inserts/selects correctly.
- [ ] Mobile drag changes pitch correctly.
- [ ] Range selection works.
- [ ] Pitch cursor/navigation works.
- [ ] Whole / half / quarter / eighth / sixteenth values work.
- [ ] Sharp / flat / double sharp / double flat work.
- [ ] Stem direction works.
- [ ] Primary beam add/remove works.
- [ ] 2+4 beaming remains correct.
- [ ] 8th + 16th terminal secondary beam hook points inward correctly.
- [ ] 16th + 8th secondary-beam behavior remains correct.
- [ ] Delete and selection controls work on desktop and mobile.

## E. Scoring / session
- [ ] Major-scale pitch spelling scoring matches v0.6.26.
- [ ] Octave acceptance matches v0.6.26.
- [ ] Stem/beaming/rhythm scoring matches v0.6.26.
- [ ] Five-question session completes normally.
- [ ] Session summary matches v0.6.26.
- [ ] Attempts save once only (no duplicates).
- [ ] Stage mastery/progression still updates correctly.

## Acceptance
If all items pass, mark v0.7.0 as the new stable multi-file baseline. Only then proceed to v0.7.1 architecture refactoring.
