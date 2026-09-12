# M1 Pilot Acceptance

Baseline entering M1: **v0.9.3 — Authoritative Mastery Evidence** (`d9d2ed7feb787b3f0d540b2358349f7009dece2b`).

M1 is complete only when the learning journey works against the live Supabase project, not only against fixture/browser mocks.

## M1.1 — Live End-to-End Verification

The existing automatic `QA` workflow remains the regression gate for source behavior and real Chrome with a fixture backend.

`Live Pilot QA` is a separate, manually triggered workflow because it intentionally writes disposable learning evidence into the production Supabase project. It must use dedicated QA users only.

### Required GitHub Environment

Create a GitHub Actions environment named `pilot-qa` and configure environment secrets:

- `QA_STUDENT_EMAIL`
- `QA_STUDENT_PASSWORD`

For Teacher Dashboard verification also configure:

- `QA_TEACHER_EMAIL`
- `QA_TEACHER_PASSWORD`

Optional environment variable:

- `QA_CLASS_ID` — class owned by the QA teacher and containing the QA student.

Never use a real student's credentials. Never store QA passwords, JWTs or the Supabase service-role key in source control.

### QA student state

The dedicated QA student must:

1. be authenticated and confirmed;
2. have an assigned active Learning Path;
3. have at least one Stage in `in_progress` state;
4. not be a real learner account;
5. be safe to accumulate disposable practice sessions and attempts.

If the QA Path is fully mastered, reset/recreate the dedicated QA learner before running the live suite.

### Live student assertions

The workflow must prove:

- Login succeeds against live Supabase Auth.
- Student Dashboard loads live Learning Path data.
- Recommendation resolves to the same Exercise/Stage opened by the Exercise Host.
- Stage/Level remains locked by Learning Path authority.
- A disposable live practice session is created with `app_version = 0.9.3`.
- Raw notation is submitted through `submit-major-scale-attempt`.
- A known-correct supported Major Scale response scores 100 server-side.
- Exactly five trusted skill evidence rows are persisted.
- Direct authenticated INSERT into `attempts` is denied.
- Direct authenticated INSERT into `attempt_skill_results` is denied.
- Retrying the same question slot cannot replace the authoritative attempt/score.
- `get_my_stage_mastery` sees the trusted evidence.
- Reload preserves authenticated access and Dashboard recovery.
- Logout/login returns to the learner Dashboard successfully.
- No uncaught browser error occurs.

### Teacher assertions

When `verify_teacher=true`:

- QA teacher login succeeds.
- Teacher Dashboard loads at least one permitted class.
- If `QA_CLASS_ID` is configured, that class is visible to the QA teacher.
- The configured QA class contains the dedicated QA student.
- No direct student-table access is added for the browser; Teacher Dashboard continues to use secure RPCs.

## M1.2 — Learning Flow UX

A pilot learner must be able to answer, without understanding database terminology:

1. ฉันอยู่ขั้นไหน?
2. ตอนนี้ต้องทำอะไรต่อ?
3. ฉันผ่านอะไรแล้ว?
4. ทำไมฉันยังไม่ผ่านขั้นนี้?
5. ฉันยังขาดโจทย์/ทักษะอะไร?
6. เมื่อผ่านแล้ว ระบบจะพาไปไหนต่อ?

Acceptance targets:

- Current Stage is visually dominant.
- One primary next-action CTA is shown.
- Mastery blockers are expressed in learner language, not implementation terminology.
- Coverage gaps identify missing Major keys when available.
- Skill gaps use learner-facing Thai names.
- Completed Stage/Path states do not present a misleading active action.

## M1.3 — Pre-test / Diagnostic + Mastery Experience

Acceptance targets:

- New/eligible learner receives a diagnostic recommendation.
- Pre-test launches with explicit `pretest` mode and Stage authority.
- Diagnostic uses Stage required-item configuration rather than hard-coded question sets.
- Completing diagnostic invokes placement exactly once.
- Placement result is explained to the learner in plain Thai.
- Placement cannot unlock a Stage that backend progression rules do not authorize.
- Returning learner is not repeatedly forced through an already-completed diagnostic unless policy explicitly requires it.

## M1.4 — Student / Teacher Dashboard Pilot Readiness

Student Dashboard must show:

- current Stage;
- completed Stages;
- overall Mastery progress;
- per-skill progress;
- missing coverage or practice requirement;
- deterministic next recommendation.

Teacher Dashboard must support a pilot instructor in identifying:

- learners who have not started;
- current Stage for each learner;
- completed Stage count;
- latest Mastery result;
- learners who appear stuck or need follow-up.

M1 keeps Teacher Dashboard read-only unless a separate requirement is approved.

## M1.5 — Pilot Decision

Final status is one of:

- `READY` — no P0/P1 issue and live student + teacher flows pass.
- `READY WITH MINOR FIXES` — no P0/P1 issue; only non-blocking P2/P3 UX/operations items remain.
- `NOT READY FOR PILOT` — any scoring, evidence, progression, authorization, persistence or core journey defect remains.

### Required device/browser coverage before pilot

- Chrome desktop 1440×900
- Chrome desktop 1280×800
- tablet portrait
- tablet landscape
- mobile 390×844
- mobile 360×800
- at least one real iPhone Safari smoke pass

The automatic fixture Chrome suite and the live Supabase suite are complementary: neither replaces the other.
