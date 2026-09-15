'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'src/dashboard/student-dashboard-v2.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles/student-dashboard-v2.css'),'utf8');
const repository=fs.readFileSync(path.join(ROOT,'src/data/dashboard.repository.js'),'utf8');
const dashboardUtils=fs.readFileSync(path.join(ROOT,'src/dashboard/dashboard-utils.js'),'utf8');

const dashboardIds=['sd2Continue','sd2Summary','sd2SkillSnapshot','sd2LearningPath','sd2Recent'];
let last=-1;
for(const id of dashboardIds){
  const index=source.indexOf(`id=\"${id}\"`);
  assert(index>last,`${id} must appear after the previous Dashboard section`);
  last=index;
}

const progressIds=['sd2ProgressOverall','sd2ProgressSkills','sd2ProgressTrend','sd2ProgressStages','sd2SessionHistory'];
last=-1;
for(const id of progressIds){
  const index=source.indexOf(`id=\"${id}\"`);
  assert(index>last,`${id} must appear after the previous Progress section`);
  last=index;
}

for(const code of ['BN01_TREBLE_PITCH','BN06_STEM_DIRECTION','RH01_DURATION_VALUE','GR02_PRIMARY_BEAM','MS03_SCALE_ACCIDENTAL']){
  assert(source.includes(code),`Student learning UI must support ${code}`);
}

for(const label of ['Continue Learning','Skill Snapshot','Learning Path','Recent Activity','Overall Learning Progress','Skill Mastery Detail','Learning Trend','Stage Progress / History','Session History','Attempt / Detailed Review']){
  assert(source.includes(label),`Student learning UI should expose ${label}`);
}

assert(source.includes('getStudentLearningHistory'),'Progress must bind to repository learning history');
assert(source.includes('getRecommendedNextAction'),'Dashboard next action must come from the recommendation data layer');
assert(source.includes('getStageMastery'),'Skill/Stage mastery must come from trusted mastery RPC output');
assert(source.includes('buildDashboardViewModel'),'Data calculation must be separated from rendering');
assert(source.includes('buildHistoryModel'),'History transformation must be separated from rendering');
assert(source.includes('renderTrendChart'),'Trend rendering must be isolated');
assert(source.includes('renderSessionHistory'),'Session evidence must have an isolated renderer');
assert(source.includes('renderAttempt'),'Attempt drill-down must be expandable rather than dumped into the Progress root');
assert(source.includes('dashboard-continue sd2-continue-action'),'Primary CTA must preserve existing Exercise Host delegation contract');
assert(source.includes("'Practice','practice'"),'Navigation must include Practice');
assert(source.includes("'Progress','progress'"),'Navigation must include Progress');
assert(source.includes("'Profile','profile'"),'Navigation must include Profile');
assert(source.includes("progress.hidden=action!=='progress'"),'Progress must be a distinct page state');
assert(source.includes("dashboard.hidden=action!=='dashboard'"),'Dashboard must hide outside its page state');
assert(source.includes("practice.hidden=action!=='practice'"),'Practice must open as a distinct page state');
assert(source.includes("profile.hidden=action!=='profile'"),'Profile must hide Dashboard/Progress rather than overlay them');
assert(source.includes("if(hash==='#sd2PracticePage') return 'practice'"),'Practice must have an addressable dashboard route');
assert(!source.includes("if(action==='practice'){"),'Practice navigation must not launch the Trainer before the learner chooses Start');
assert(!source.includes('sd2Achievements'),'Dashboard must not retain the nonessential Achievements block');
assert(!/Stage 3 — Major Scale Accidentals/.test(source),'Example content must not be hard-coded as production data');
assert(!/Progress 68%/.test(source),'Example mastery percentage must not be hard-coded');

for(const field of ['first_name','last_name','nickname','student_id','program','avatar_url']) assert(source.includes(`name=\"${field}\"`),`Profile must expose ${field}`);
for(const obsolete of ['year_level','section']) assert(!source.includes(`name=\"${obsolete}\"`),`Profile must not expose ${obsolete}`);

assert(repository.includes("from('practice_sessions')"),'History repository must read practice_sessions');
assert(repository.includes("from('attempts')"),'History repository must read attempts');
assert(repository.includes("from('attempt_skill_results')"),'History repository must read attempt skill evidence');
assert(repository.includes("from('skills')"),'Skill metadata must come from skills');
assert(repository.includes("from('profiles')"),'Profile must come from profiles');
assert(repository.includes("select('id', {count: 'exact', head: true})"),'Session count must be data-backed rather than inferred from the recent page');

assert(dashboardUtils.includes("language==='en'?'Start Practice':'เริ่มฝึก'"),'Never-started learners must see Start Practice / เริ่มฝึก');
assert(dashboardUtils.includes("language==='en'?'Continue Practice':'ฝึกต่อ'"),'Learners with practice evidence must see Continue Practice / ฝึกต่อ');
assert(dashboardUtils.includes('vm.recommendation?.attemptsFound'),'Start-state detection must use actual attempt evidence from the recommendation');
assert(dashboardUtils.includes('session.attempts'),'Start-state fallback must inspect real session attempts');
assert(!dashboardUtils.includes("if(stage.stage_started_at || stage.started_at) return true"),'Provisioned stage timestamps must not be treated as evidence that practice has started');
assert(dashboardUtils.includes("'เกณฑ์ของระดับ'"),'Never-started readiness copy must present requirements rather than a failure state');
assert(dashboardUtils.includes("'Level requirements'"),'English never-started readiness copy must present requirements rather than a failure state');

assert(source.includes("setAttribute('aria-label','Main')"),'Main navigation must have an accessible landmark');
assert(source.includes('aria-current="step"'),'Current stage must expose step semantics');
assert(css.includes('[aria-current="page"]'),'Current destination styles must use aria-current');
assert(css.includes('.sd2-page[hidden]'),'Separate pages must use a real hidden state');
assert(css.includes('@media(min-width:760px)'),'Student UI must define a desktop enhancement breakpoint');
assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'),'Desktop summary cards must become four columns');
assert(css.includes('--sd2-mastered'),'Status color semantics must include Mastered');
assert(css.includes('--sd2-needs'),'Status color semantics must include Needs Practice');
assert(css.includes('--sd2-locked'),'Status color semantics must include Locked');
assert(css.includes('--sd2-primary:var(--accent)'),'Student pages must inherit the Trainer accent theme');
assert(css.includes('position:sticky'),'Site Header must remain available while switching student pages');

console.log('PASS Student learning IA: actionable Dashboard, analytical Progress, isolated Profile, real evidence and responsive contracts');
