# v0.7.4 Regression Checklist

Use the deployed GitHub Pages build.

## Auth / Dashboard regression
- [ ] Student login succeeds.
- [ ] Teacher login succeeds.
- [ ] Logout succeeds.
- [ ] Forgot / Reset Password still work.
- [ ] Student Dashboard renders Path / Exercise / Stage / Mastery.
- [ ] Teacher Dashboard renders Class / Path / Student progress.
- [ ] Dashboard refresh and class switching work without console errors.

## Practice persistence — priority for v0.7.4
- [ ] Opening Trainer starts normally.
- [ ] A checked answer creates/saves an Attempt.
- [ ] No duplicate Attempt appears for one question.
- [ ] Skill evidence saves successfully.
- [ ] `completed_questions` advances after a successful saved Attempt.
- [ ] Leaving/returning does not leave an incorrect open practice session.
- [ ] Completing 5 questions records session completion/score normally.

## Mastery / Stage progression — priority for v0.7.4
- [ ] Current Stage opens correctly from Student progress.
- [ ] Mastery Progress panel loads.
- [ ] Missing-key/coverage guidance still appears when appropriate.
- [ ] Mastery RPC result is reflected in UI.
- [ ] Passing a Stage advances to the next Stage exactly as before.
- [ ] Final Stage mastery completes the Exercise/Path as before.

## Notation / scoring protected regression
- [ ] Note click/tap works.
- [ ] Mobile pitch drag works if tested on touch device.
- [ ] Multi-note selection works.
- [ ] Sharp / flat / double sharp / double flat work.
- [ ] Stem direction works.
- [ ] Primary beam grouping works.
- [ ] Secondary beam/hook direction remains correct, especially terminal 8th + 16th cases.
- [ ] Scoring behaves as before.
- [ ] 5-question summary behaves as before.

## Browser developer tools
- [ ] No unexpected JavaScript error in Console.
- [ ] No local asset 404 in Network tab.
- [ ] `practice.repository.js` and `mastery.repository.js` both load successfully.
