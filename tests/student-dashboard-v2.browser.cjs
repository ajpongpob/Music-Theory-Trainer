'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const skills=[
  {code:'BN01_TREBLE_PITCH',short_name:'Pitch Name',name_th:'ระบุระดับเสียงบนบรรทัดห้าเส้น'},
  {code:'BN06_STEM_DIRECTION',short_name:'Stem Direction',name_th:'กำหนดทิศทางก้านโน้ต'},
  {code:'RH01_DURATION_VALUE',short_name:'Duration Value',name_th:'กำหนดค่าความยาวโน้ต'},
  {code:'GR02_PRIMARY_BEAM',short_name:'Primary Beam',name_th:'จัดกลุ่มบีมหลัก'},
  {code:'MS03_SCALE_ACCIDENTAL',short_name:'Scale Accidental',name_th:'ใช้เครื่องหมายแปลงเสียงของบันไดเสียง'}
];

const dashboardRows=[
  {learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'Music Theory Foundations',exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'Major Scale Notation',exercise_sequence:10,stage_id:'stage-1',stage_code:'STAGE_1',stage_name:'Stage 1 — Foundations',stage_sequence:10,stage_status:'mastered',last_mastery_score:95},
  {learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'Music Theory Foundations',exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'Major Scale Notation',exercise_sequence:10,stage_id:'stage-2',stage_code:'STAGE_2',stage_name:'Stage 2 — Core Scales',stage_sequence:20,stage_status:'in_progress',last_mastery_score:68},
  {learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'Music Theory Foundations',exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'Major Scale Notation',exercise_sequence:10,stage_id:'stage-3',stage_code:'STAGE_3',stage_name:'Stage 3 — Extended Accidentals',stage_sequence:30,stage_status:'locked',last_mastery_score:null},
  {learning_path_code:'MUSIC_THEORY_FOUNDATIONS',learning_path_name:'Music Theory Foundations',exercise_id:'exercise-1',exercise_code:'MAJOR_SCALE_NOTATION',exercise_name:'Major Scale Notation',exercise_sequence:10,stage_id:'stage-4',stage_code:'STAGE_4',stage_name:'Stage 4 — Advanced Major Scales',stage_sequence:40,stage_status:'locked',last_mastery_score:null}
];

const mastery={
  overall_score:68,
  overall_threshold:90,
  skill_results:[
    {skill_code:'BN01_TREBLE_PITCH',score:94,threshold:90,passed:true},
    {skill_code:'BN06_STEM_DIRECTION',score:88,threshold:85,passed:true},
    {skill_code:'RH01_DURATION_VALUE',score:78,threshold:85,passed:false},
    {skill_code:'GR02_PRIMARY_BEAM',score:82,threshold:85,passed:false},
    {skill_code:'MS03_SCALE_ACCIDENTAL',score:61,threshold:90,passed:false}
  ]
};

function learningHistory(){
  const sessions=[];const attempts=[];const skillResults=[];
  const scores=[54,60,63,66,70,74];
  for(let i=0;i<scores.length;i++){
    const id=`session-${i+1}`,attemptId=`attempt-${i+1}`;
    sessions.push({id,mode:'practice',planned_questions:5,completed_questions:5,overall_score:scores[i],started_at:`2026-09-${String(5+i).padStart(2,'0')}T10:00:00Z`,completed_at:`2026-09-${String(5+i).padStart(2,'0')}T10:10:00Z`,exercise_id:'exercise-1',stage_id:'stage-2'});
    attempts.push({id:attemptId,practice_session_id:id,question_number:1,score:scores[i],item_code:'C'});
    skills.forEach((skill,index)=>skillResults.push({attempt_id:attemptId,skill_code:skill.code,correct_count:Math.max(1,5-index+(i>2?1:0)),total_count:6,score:null}));
  }
  return {sessions,attempts,skillResults,totalPracticeSessions:12};
}

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});

    await page.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
      <section id="studentDashboard" class="student-dashboard-shell">
        <div class="student-dashboard-inner">
          <header class="student-dashboard-header">
            <div class="student-dashboard-brand"><div class="student-dashboard-kicker">Student Dashboard</div><h1>Learning Path</h1><p>Legacy dashboard</p></div>
            <div class="student-dashboard-actions"><span id="dashboardUserName">QA Student</span><button id="dashboardLogoutButton" type="button">ออกจากระบบ</button></div>
          </header>
          <main id="dashboardContent">
            <div id="dashboardPathList"><button type="button" class="dashboard-continue" data-exercise-code="MAJOR_SCALE_NOTATION" data-stage-code="STAGE_2" data-session-mode="practice">ฝึกต่อ</button></div>
            <aside id="dashboardCurrentFocus">
              <div id="dashboardFocusLabel"></div><div id="dashboardFocusTitle">Stage 2 — Core Scales</div><div id="dashboardFocusExercise">Major Scale Notation</div><span id="dashboardFocusStatus"></span>
              <div id="dashboardRecommendation"><button type="button" class="dashboard-continue dashboard-recommendation-action" data-exercise-code="MAJOR_SCALE_NOTATION" data-stage-code="STAGE_2" data-session-mode="practice">ฝึกทักษะที่ควรพัฒนา</button></div>
              <div id="dashboardMasteryBody"></div>
            </aside>
          </main>
        </div>
      </section>
    </body></html>`);
    await page.addStyleTag({content:read('styles/app.css')});
    await page.addStyleTag({content:read('styles/student-dashboard-v2.css')});
    await page.evaluate(({dashboardRows,skills,mastery,history})=>{
      window.MajorScaleApp={
        dashboardRepository:{
          getStudentDashboard:async()=>({data:dashboardRows,error:null}),
          getActiveSkills:async()=>({data:skills,error:null}),
          getStageMastery:async()=>({data:[mastery],error:null}),
          getStudentLearningHistory:async()=>({data:history,error:null})
        },
        learningRepository:{
          getRecommendedNextAction:async()=>({data:[{exercise_code:'MAJOR_SCALE_NOTATION',stage_code:'STAGE_2',action_type:'target_skill',target_skill_code:'MS03_SCALE_ACCIDENTAL',reason_th:'เครื่องหมายแปลงเสียงยังต่ำกว่าเกณฑ์'}],error:null})
        }
      };
    },{dashboardRows,skills,mastery,history:learningHistory()});
    await page.addScriptTag({content:read('src/domain/mastery/mastery-learning-core.js')});
    await page.addScriptTag({content:read('src/dashboard/student-dashboard-v2.js')});
    await page.waitForFunction(()=>window.__studentDashboardV2Model && document.querySelector('#sd2TrendChart svg'));

    assert.equal(await page.locator('#sd2ContinueHeading').textContent(),'Major Scale Notation');
    assert((await page.locator('#sd2Continue').textContent()).includes('Stage 2 of 4'));
    assert((await page.locator('#sd2Continue').textContent()).includes('Scale Accidental'));
    assert.equal(await page.locator('#sd2Continue .sd2-progress-meta strong').textContent(),'68% / เกณฑ์ 90%');
    assert.equal(await page.locator('#sd2SkillList .sd2-skill').count(),5);
    assert.equal(await page.locator('#sd2SkillList .sd2-status.mastered').count(),2);
    assert.equal(await page.locator('#sd2SkillList .sd2-status.needs-practice').count(),3);
    assert((await page.locator('#sd2StageList').textContent()).includes('Stage 3 — Extended Accidentals'));
    assert.equal(await page.locator('#sd2StageList .sd2-status.locked').count(),2);
    assert.equal(await page.locator('#sd2RecentList .sd2-recent-item').count(),5);
    assert((await page.locator('#sd2AchievementList').textContent()).includes('10 Sessions'));
    assert.equal(await page.locator('#sd2TrendFilter option').count(),6);
    assert.equal(await page.locator('#sd2TrendChart svg').count(),1);

    const desktopOrder=await page.evaluate(()=>['sd2Continue','sd2Summary','sd2Skills','sd2Trend','sd2Recent','sd2Achievements'].map(id=>[id,document.getElementById(id).getBoundingClientRect().top]));
    for(let i=1;i<desktopOrder.length;i++) assert(desktopOrder[i][1]>=desktopOrder[i-1][1],`${desktopOrder[i][0]} should not appear above ${desktopOrder[i-1][0]}`);
    assert.equal(await page.locator('#sd2TopNav').isVisible(),true);
    assert.equal(await page.locator('#sd2BottomNav').count(),0);

    await page.locator('[data-sd2-skill="MS03_SCALE_ACCIDENTAL"]').click();
    assert.equal(await page.locator('#sd2TrendFilter').inputValue(),'MS03_SCALE_ACCIDENTAL');

    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#sd2TopNav').isVisible(),true);
    assert.equal(await page.locator('#sd2BottomNav').count(),0);
    const mobileOrder=await page.evaluate(()=>['sd2Continue','sd2Summary','sd2Skills','sd2LearningPath','sd2Trend','sd2Recent','sd2Achievements'].map(id=>[id,document.getElementById(id).getBoundingClientRect().top]));
    for(let i=1;i<mobileOrder.length;i++) assert(mobileOrder[i][1]>=mobileOrder[i-1][1],`${mobileOrder[i][0]} should follow ${mobileOrder[i-1][0]} on mobile`);
    const practiceBox=await page.locator('#sd2TopNav [data-sd2-nav="practice"]').boundingBox();
    assert(practiceBox && practiceBox.height>=44,'mobile Practice action must meet touch-target height');
    assert.equal(await page.locator('#sd2Recent').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'recent activity should not require horizontal scrolling');
    assert.equal(await page.locator('header > nav[aria-label="Main"]').count(),1);
    assert.equal(await page.locator('#sd2TopNav > a').count(),4);
    assert.equal(await page.locator('#sd2TopNav button, #sd2TopNav #dashboardUserName').count(),0);
    assert.equal(await page.locator('ol#sd2StageList > li').count(),4);
    assert.equal(await page.locator('#sd2StageList [aria-current="step"]').count(),1);
    assert.equal(await page.locator('#sd2StageList [aria-current="page"]').count(),0);
    assert.equal(await page.locator('#sd2StageList [aria-current="step"] .sd2-stage-icon').textContent(),'2');
    assert.equal(await page.locator('#sd2StageList .completed .sd2-stage-icon').textContent(),'✓');
    for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844},{width:320,height:740}]){
      await page.setViewportSize(viewport);
      const boxes=await page.locator('#sd2StageList > li').evaluateAll(items=>items.map(item=>({x:item.getBoundingClientRect().x,y:item.getBoundingClientRect().y})));
      assert(viewport.width>=980?boxes[1].x>boxes[0].x:boxes[1].y>boxes[0].y,'Steps orientation follows available width');
      assert(await page.locator('#studentDashboard').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Dashboard must fit viewport');
      await page.locator('#sd2TopNav [data-sd2-nav="progress"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#sd2TopNav [aria-current="page"]').textContent(),'Progress');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'sd2Skills');
      await page.locator('#sd2TopNav [data-sd2-nav="profile"]').click();
      assert(await page.locator('#sd2ProfilePanel').isVisible());
      assert.equal(await page.locator('#sd2TopNav [aria-current="page"]').textContent(),'Profile');
      await page.locator('#sd2TopNav [data-sd2-nav="dashboard"]').click();
      assert.equal(await page.locator('#sd2TopNav [aria-current="page"]').textContent(),'Dashboard');
      assert.equal(await page.locator('#sd2ProfilePanel').isVisible(),false);
      if(process.env.QA_SCREENSHOTS){await page.screenshot({path:path.join(process.env.QA_SCREENSHOTS,`student-dashboard-${viewport.width}.png`),fullPage:true});}
      console.log(`PASS semantic header / keyboard navigation / steps / overflow: ${viewport.width}×${viewport.height}`);
    }
    await page.evaluate(()=>{
      window.__launches=0;
      document.querySelector('#sd2Continue .dashboard-continue').addEventListener('click',()=>window.__launches++);
    });
    await page.locator('#sd2TopNav [data-sd2-nav="practice"]').click();
    assert.equal(await page.evaluate(()=>window.__launches),1,'Practice delegates to existing CTA once');
    for(const statuses of [['mastered','mastered','in_progress','locked'],['mastered','mastered','mastered','mastered'],['available','locked','locked','locked'],[]]){
      await page.evaluate(async statuses=>{
        const rows=window.__studentDashboardV2Model.path.rows.slice(0,statuses.length).map((row,i)=>({...row,stage_status:statuses[i]}));
        window.MajorScaleApp.dashboardRepository.getStudentDashboard=async()=>({data:rows,error:null});
        await window.MajorScaleApp.studentDashboardV2.refresh();
      },statuses);
      assert.equal(await page.locator('#sd2StageList [aria-current="step"]').count(),statuses.includes('in_progress')?1:0);
      if(statuses.includes('available'))assert.equal(await page.locator('#sd2StageList > li.upcoming').count(),1);
      if(statuses.includes('in_progress'))assert.equal(await page.locator('#sd2StageList [aria-current="step"] .sd2-stage-icon').textContent(),'3');
    }
    assert.deepEqual(errors,[]);

    console.log('PASS Student Dashboard V2 browser: actionable hierarchy, mastery/status, stage path, trend, recent activity, achievements and responsive navigation');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
