'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'src/dashboard/student-dashboard-v2.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles/student-dashboard-v2.css'),'utf8');
const repository=fs.readFileSync(path.join(ROOT,'src/data/dashboard.repository.js'),'utf8');
const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

const orderedIds=['sd2Continue','sd2Summary','sd2Skills','sd2LearningPath','sd2Trend','sd2Recent','sd2Achievements'];
let last=-1;
for(const id of orderedIds){
  const index=source.indexOf(`id=\"${id}\"`);
  assert(index>last,`${id} must appear after the previous dashboard section`);
  last=index;
}

for(const code of [
  'BN01_TREBLE_PITCH','BN06_STEM_DIRECTION','RH01_DURATION_VALUE','GR02_PRIMARY_BEAM','MS03_SCALE_ACCIDENTAL'
]) assert(source.includes(code),`Dashboard V2 must support ${code}`);

for(const label of ['Continue Learning','Overall Learning Progress','Skill Mastery','Learning Path','Learning Trend','Recent Activity','Achievements']){
  assert(source.includes(label),`Dashboard V2 should expose ${label}`);
}

assert(source.includes('getStudentLearningHistory'), 'Dashboard V2 must bind to repository learning history');
assert(source.includes('getRecommendedNextAction'), 'Next activity must come from the recommendation data layer');
assert(source.includes('getStageMastery'), 'Skill/Stage mastery must come from trusted mastery RPC output');
assert(source.includes('buildDashboardViewModel'), 'Dashboard calculation should be separated from rendering');
assert(source.includes('buildHistoryModel'), 'History transformation should be separated from rendering');
assert(source.includes('renderTrendChart'), 'Trend rendering should be isolated');
assert(source.includes('dashboard-continue sd2-continue-action'), 'Primary CTA must preserve existing Exercise Host delegation contract');
assert(source.includes("'Practice','practice'"), 'Navigation must include Practice');
assert(source.includes("'Progress','progress'"), 'Navigation must include Progress');
assert(source.includes("'Profile','profile'"), 'Navigation must include Profile');
assert(!/Stage 3 — Major Scale Accidentals/.test(source), 'Example content must not be hard-coded as production data');
assert(!/Progress 68%/.test(source), 'Example mastery percentage must not be hard-coded');

assert(repository.includes("from('practice_sessions')"), 'History repository must read practice_sessions');
assert(repository.includes("from('attempts')"), 'History repository must read attempts');
assert(repository.includes("from('attempt_skill_results')"), 'History repository must read attempt skill evidence');
assert(repository.includes("select('id', {count: 'exact', head: true})"), 'Session count must be data-backed rather than inferred from the recent page');

assert(indexHtml.includes('styles/student-dashboard-v2.css?v='), 'Production HTML must load Dashboard V2 CSS directly with cache busting');
assert(indexHtml.includes('src/data/dashboard.repository.js?v='), 'Production HTML must cache-bust the dashboard repository bootstrap');
assert(indexHtml.includes('src/dashboard/student-dashboard-v2.js?v='), 'Production HTML must load Dashboard V2 JS directly');
assert(indexHtml.includes('src/dashboard/student-dashboard-v2-compat.js?v='), 'Production HTML must load Dashboard V2 compatibility layer directly');
assert.strictEqual((indexHtml.match(/src\/dashboard\/student-dashboard-v2\.js\?v=/g)||[]).length,1,'Production HTML must load Dashboard V2 JS exactly once');
assert.strictEqual((indexHtml.match(/styles\/student-dashboard-v2\.css\?v=/g)||[]).length,1,'Production HTML must load Dashboard V2 CSS exactly once');

assert(css.includes('.sd2-bottom-nav'), 'Mobile bottom navigation styles must exist');
assert(css.includes('@media(min-width:760px)'), 'Dashboard must define a desktop enhancement breakpoint');
assert(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'), 'Desktop summary cards must become four columns');
assert(css.includes('--sd2-mastered'), 'Status color semantics must include Mastered');
assert(css.includes('--sd2-needs'), 'Status color semantics must include Needs Practice');
assert(css.includes('--sd2-locked'), 'Status color semantics must include Locked');

console.log('PASS Student Dashboard V2: actionable hierarchy, mastery binding, learning history, production wiring, navigation and responsive contracts');
