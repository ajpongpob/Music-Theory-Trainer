'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ui=read('src/m15-learning-feedback.js');
const repo=read('src/data/dashboard.repository.js');
const migration=read('supabase/migrations/20260912162713_m15_learning_feedback.sql');
const teacherFold=read('supabase/migrations/20260912163116_m15_teacher_feedback_fold_in.sql');

assert(ui.includes('const SET_SIZE=5'),'practice UX must use five-question sets');
assert(ui.includes("b.dataset.m15='set'"),'fifth checked answer must route to the set summary');
assert(ui.includes('Mastery สะสม'),'session result must be distinguished from rolling mastery');
assert(ui.includes('ทำไมจึง'),'student dashboard must explain why the current stage is or is not passed');
assert(ui.includes('missing_item_codes'),'coverage gaps must remain visible to the learner');
assert(ui.includes('ผลประเมินก่อนเรียน'),'diagnostic result must be shown explicitly');
assert(ui.includes('ข้อมูลการเรียนล่าสุด'),'teacher cards must receive learning detail');
assert(ui.includes('จุดที่ควรระวังในการฝึก:'),'weak-skill copy must not imply a remediation exercise exists');
assert(ui.includes("attributeFilter:['hidden','class','disabled']"),'feedback observer must be limited to UI state changes');
assert(!ui.includes('childList:true'),'feedback observer must not self-trigger from its own rendered HTML');

for(const method of ['getStageEvidence','finalizePracticeSet','getLatestDiagnosticFeedback','getTeacherClassLearningFeedback']){
  assert(repo.includes(method),`dashboard repository must expose ${method}`);
}
assert(repo.includes('m15-learning-feedback.js'),'M1.5 layer must be loaded after the legacy runtime');
assert(repo.includes("get_my_teacher_class_dashboard"),'teacher feedback must reuse the existing authorized dashboard RPC');
assert(!repo.includes("rpc('get_my_teacher_class_learning_feedback'"),'browser must not depend on an additional SECURITY DEFINER teacher RPC');

assert(migration.includes('finalize_my_practice_set'),'migration must provide authoritative five-question summary');
assert(migration.includes('get_my_latest_diagnostic_feedback'),'migration must provide diagnostic feedback');
assert(/finalize_my_practice_set[\s\S]*security invoker/i.test(migration),'learner set finalization must remain SECURITY INVOKER');
assert(/get_my_latest_diagnostic_feedback[\s\S]*security invoker/i.test(migration),'learner diagnostic feedback must remain SECURITY INVOKER');
assert(teacherFold.includes('drop function if exists public.get_my_teacher_class_learning_feedback(uuid)'),'temporary teacher feedback RPC must be removed');
assert(teacherFold.includes('learning_feedback jsonb'),'existing teacher dashboard RPC must carry the added feedback payload');
assert(teacherFold.includes("if not public.is_class_teacher(p_class_id)"),'teacher dashboard must preserve class-level authorization');
assert(teacherFold.includes('revoke all on function public.get_my_teacher_class_dashboard(uuid) from public, anon'),'teacher dashboard must remain unavailable to public/anon');

console.log('PASS M1.5 learning feedback contracts');
