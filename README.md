# Major Scale Notation Trainer v0.7.1

## Checkpoint goal

v0.7.1 is the first architecture refactor after the verified v0.7.0 multi-file baseline.

This checkpoint extracts the Supabase client and authentication data-access operations from `src/auth-dashboard.js` while intentionally leaving Student Dashboard, Teacher Dashboard, Trainer, Notation, scoring, state, DOM IDs, RPC names, and event flow unchanged.

## Structure

```text
index.html
styles/app.css
src/
  data/
    supabase-client.js
    auth.repository.js
  auth-dashboard.js
  trainer.js
  keyboard.js
```

## Responsibilities

- `src/data/supabase-client.js`
  - owns Supabase URL + publishable key
  - creates the single browser Supabase client
  - temporarily exposes `window.majorScaleSupabase` for compatibility with the existing trainer
- `src/data/auth.repository.js`
  - owns direct Supabase Auth calls
  - owns the profile-role query used by authentication routing
- `src/auth-dashboard.js`
  - retains Auth UI/controller behavior plus Student/Teacher Dashboard behavior for this checkpoint
  - consumes the client/repository instead of constructing the Supabase client itself
- `src/trainer.js`
  - unchanged except `app_version` -> `0.7.1`
- `src/keyboard.js`
  - unchanged

## Intentionally deferred

- ES Modules / import-export
- npm Supabase package
- Vite build pipeline
- Student Dashboard module split
- Teacher Dashboard module split
- Practice/Mastery repository extraction
- Notation engine modularization
- Removal of the `window.majorScaleSupabase` compatibility bridge

These changes are deferred so that each architectural checkpoint remains independently testable.
