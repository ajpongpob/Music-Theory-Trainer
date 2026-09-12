# Major Scale Notation Trainer v0.7.0

This is the first multi-file mechanical split of the v0.6.26 stable baseline.

## Purpose of this checkpoint

- Separate HTML, CSS, and JavaScript without redesigning application logic.
- Preserve DOM ids, event flow, global bridges, Supabase RPC calls, notation/scoring algorithms, and CSS cascade order.
- Establish a safer baseline for later modular refactoring.

## Files

- `index.html` — application markup and external asset references.
- `styles/app.css` — all 59 original style blocks, retained in source order. The two Google Fonts `@import` rules were moved to the top because CSS requires imports before ordinary rules.
- `src/auth-dashboard.js` — original Auth + Student/Teacher Dashboard script.
- `src/trainer.js` — original Trainer/Notation/Practice/Mastery script.
- `src/keyboard.js` — original Sibelius-style keyboard shortcut script.

## Intentional changes from v0.6.26

Only version metadata changed from `0.6.26` to `0.7.0`, including the practice-session `app_version`. No functional algorithm was intentionally changed.

## Local test

Run a static server from this directory, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deployment

For the current static GitHub Pages architecture, deploy the contents of this directory while preserving the relative folders `styles/` and `src/`.

## Next checkpoint

Do not modularize notation logic until this v0.7.0 baseline has passed regression testing against v0.6.26.
