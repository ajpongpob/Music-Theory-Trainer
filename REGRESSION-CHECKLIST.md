# v0.7.1 Manual Regression Checklist

Compare all behavior against the accepted v0.7.0 baseline.

## A. Loading
- [ ] GitHub Pages loads without blank screen
- [ ] Browser console has no new uncaught JavaScript errors
- [ ] CSS/layout looks the same as v0.7.0

## B. Authentication
- [ ] Existing student can log in
- [ ] Existing teacher can log in
- [ ] Registration still works
- [ ] Email verification flow is unchanged
- [ ] Forgot Password sends recovery email
- [ ] Recovery URL opens reset-password panel
- [ ] New password can be saved
- [ ] Logout works from trainer
- [ ] Logout works from Student Dashboard
- [ ] Logout works from Teacher Dashboard

## C. Role routing
- [ ] Student login opens Student Dashboard
- [ ] Teacher login opens Teacher Dashboard
- [ ] Student cannot see Teacher Dashboard

## D. Student Dashboard
- [ ] Learning Path loads
- [ ] Exercise status loads
- [ ] Stage statuses load
- [ ] Continue/Review opens the correct exercise/stage

## E. Teacher Dashboard
- [ ] Class list loads
- [ ] Class selector works
- [ ] Assigned Learning Path displays
- [ ] Student list displays
- [ ] Student progression / stage totals / mastery score display
- [ ] Refresh works

## F. Trainer / notation regression
- [ ] Exercise opens normally
- [ ] Mouse note input works
- [ ] Mobile/touch input works if available
- [ ] Pitch drag works
- [ ] Single and range selection work
- [ ] Sharp / flat / double sharp / double flat work
- [ ] Whole / half / quarter / eighth / sixteenth work
- [ ] Stem direction works
- [ ] Primary beaming works
- [ ] 2+4 grouping works
- [ ] Secondary beam hooks still point inward, especially terminal 8th + 16th cases
- [ ] Delete / beam removal works
- [ ] Answer checking behaves the same
- [ ] Five-question session completes
- [ ] Attempt data saves
- [ ] Stage progression / mastery works
- [ ] Dashboard return works after practice

If all items pass, v0.7.1 can become the Auth/Data-layer baseline before v0.7.2 Dashboard modularization.
