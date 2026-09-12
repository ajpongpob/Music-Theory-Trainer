# v0.7.0 Validation Report

## Automated checks passed

- All three extracted JavaScript files pass `node --check` syntax validation.
- All three JavaScript bodies match the original v0.6.26 inline scripts exactly, except the intentional `app_version` change from `0.6.26` to `0.7.0`.
- All CSS source lines from all 59 original `<style>` blocks are preserved in original order.
- The two Google Fonts `@import` rules are preserved in original order and hoisted to the top of `styles/app.css`, as required when consolidating CSS into one file.
- All 97 functional DOM ids from v0.6.26 are preserved in the same sequence. IDs that belonged only to removed `<style>` elements are intentionally absent.
- The target `index.html` has no inline `<style>` blocks.
- The three original inline application scripts are now external classic scripts, while the external Supabase CDN script remains external and in the original load order.
- Critical RPC references remain present: `get_my_student_dashboard`, `get_my_stage_mastery`, `get_my_teacher_dashboard`, and `get_my_teacher_class_dashboard`.
- Existing `MAJOR_SCALE_NOTATION` and trainer global bridge references are preserved.
- No `service_role` string is present in the resulting frontend source.

## Browser smoke-test limitation

An automated Chromium smoke test was attempted, but the execution environment blocks browser navigation to localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore this checkpoint still requires manual browser regression testing on the user's machine before v0.7.0 is accepted as the new stable baseline.

## Acceptance rule

Do not proceed to ES Modules, Vite migration, repository abstraction, or notation-engine modularization until the manual regression checklist passes.
