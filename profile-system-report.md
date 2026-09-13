# Profile System report

ส่งมอบบน `main` commit `5ecc9086f3f88e21a9b12c8363cd1757ae16c6c6`.

## Schema and RLS

`profiles` เดิมมีเพียง `id, full_name, role, created_at, updated_at`. เพิ่ม `display_name, student_id, program, year_level, section, avatar_url` ด้วย migration ขนาดเล็กสองไฟล์. `email` และ `last_sign_in_at` ไม่ถูกทำซ้ำในตาราง; Student UI อ่านจาก Supabase Auth user.

เพิ่ม trigger ให้ `updated_at` เปลี่ยนอัตโนมัติ. Profile SELECT ใช้ policy เดียว: เจ้าของ profile เอง หรือผู้เรียนที่อยู่ใน class ซึ่งผู้ใช้ปัจจุบันเป็น class creator/teacher ที่ active. ไม่มี global teacher read policy.

Profile UPDATE จำกัดด้วย RLS ให้เป็นเจ้าของเท่านั้น และ revoke table UPDATE จาก `anon/authenticated`; grant column UPDATE เฉพาะ `full_name, display_name, student_id, program, year_level, section, avatar_url`. ตรวจ production แล้ว `authenticated` แก้ `role` ไม่ได้ แต่แก้ `full_name` ได้. `role`, `id`, timestamps และ email/password ไม่อยู่ใน browser update payload.

Migration ที่ apply ใน Supabase project `ptksuomvpuiesbwrzzif`:

- `20260913031824_profile_system`
- `20260913032109_profile_policy_cleanup`

## Student Dashboard

เพิ่ม Profile เป็นหมวดย่อยใน `#sd2ProfilePanel` พร้อม semantic `<form>`, label, required validation ของ full name, Save/Cancel, success/error status และ responsive layout. ฟิลด์ที่แก้ได้ตรงตามข้อกำหนด. Email, role, created date และ last sign-in แสดงแบบอ่านอย่างเดียว.

Repository เพิ่ม `getStudentProfileDetails()` และ `updateStudentProfile()`; method เดิม `getStudentProfile()` คง select contract เดิมเพื่อไม่กระทบ auth/dashboard code.

## Teacher Dashboard

เมื่อคลิกผู้เรียนใน authorized student list ระบบโหลด profile ผ่าน `getTeacherStudentProfile()` และแสดง Profile summary ด้านบนของ Student Detail; ด้านล่างคง Learning Progress, Skill Performance, Current Mastery, Sessions และ Attempts. ถ้า query นอก class authorization ถูกปฏิเสธ/คืนข้อมูลว่างตาม RLS.

## Regression and security checks

- Profile contract test: ผ่าน — fields, own edit payload, role exclusion, teacher profile hook, relationship boundary
- Existing Student Dashboard V2 contract: ผ่าน
- Existing Teacher Dashboard V2 contract: ผ่าน
- Existing Node regression suites: ผ่านครบ
- GitHub Actions QA run `34735413141`: ผ่านครบทุกขั้น (รวม Trainer/scoring/exercise routing, Dashboard, diagnostic feedback, editor, mobile touch)
- GitHub Pages deployment run `34735412634`: ผ่าน
- Supabase verification: profile columns, two intended policies, update privileges verified
- Supabase security advisors: ไม่มี finding ใหม่จาก profile migration; มี warnings เดิมของ SECURITY DEFINER RPCs และ leaked-password protection ที่อยู่นอกขอบเขตงานนี้

ไม่มีการแก้ notation engine, scoring, mastery calculation, practice/session logic, auth behavior, exercise generation หรือ Supabase learning schema.
