'use strict';

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const skillScores=[
  {skill_code:'BN01_TREBLE_PITCH',score:98,threshold:90,passed:true},
  {skill_code:'BN06_STEM_DIRECTION',score:92,threshold:85,passed:true},
  {skill_code:'RH01_DURATION_VALUE',score:100,threshold:85,passed:true},
  {skill_code:'GR02_PRIMARY_BEAM',score:72,threshold:85,passed:false},
  {skill_code:'MS03_SCALE_ACCIDENTAL',score:63,threshold:90,passed:false}
];
const questionScores=[
  {question_number:1,item_code:'C',score:92},
  {question_number:2,item_code:'G',score:86},
  {question_number:3,item_code:'D',score:78},
  {question_number:4,item_code:'A',score:84},
  {question_number:5,item_code:'E',score:90}
];
const localQuestions=questionScores.map((row,index)=>({
  questionNumber:row.question_number,
  itemCode:row.item_code,
  keyLabel:`${row.item_code} Major`,
  score:row.score,
  skills:skillScores.map(skill=>({
    skillCode:skill.skill_code,
    score:skill.skill_code==='MS03_SCALE_ACCIDENTAL'?[100,75,50,50,40][index]:
      skill.skill_code==='GR02_PRIMARY_BEAM'?[100,80,60,60,60][index]:100,
    correct:skill.skill_code==='MS03_SCALE_ACCIDENTAL'?[15,12,8,8,6][index]:
      skill.skill_code==='GR02_PRIMARY_BEAM'?[5,4,3,3,3][index]:5,
    total:skill.skill_code==='MS03_SCALE_ACCIDENTAL'?15:5,
    threshold:skill.threshold
  })),
  errors:[
    ...(index>0?[{skillCode:'MS03_SCALE_ACCIDENTAL',message:`โน้ตตำแหน่ง ${index+1}: เครื่องหมายแปลงเสียงไม่ตรงกับบันไดเสียง`}]:[]),
    ...(index>1?[{skillCode:'GR02_PRIMARY_BEAM',message:'Beam โน้ต 2–3: ควรรวบ Beam เป็นกลุ่มเดียวกันตาม rhythmic pattern'}]:[])
  ]
}));

const serverPayload={
  session_id:'session-browser-test',
  exercise_code:'MAJOR_SCALE_NOTATION',
  stage_code:'STAGE_2',
  session_questions:5,
  session_overall_score:86,
  session_skill_results:skillScores,
  question_scores:questionScores,
  stage_status:'in_progress',
  mastery_passed:false,
  next_target_skill_code:'MS03_SCALE_ACCIDENTAL',
  next_reason_th:'เครื่องหมายแปลงเสียงเป็นทักษะที่ควรฝึกก่อนในรอบถัดไป'
};

async function assertViewport(page,width,height,label){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>window.scrollTo(0,0));
  const result=page.locator('#diagnosticSessionResult');
  assert.equal(await result.isVisible(),true,`${label}: session result should be visible`);
  assert.equal(await page.locator('#summaryTitle').textContent(),'Session Complete',`${label}: title`);
  assert.equal(await page.locator('#summaryOverall').textContent(),'86%',`${label}: overall score`);
  assert((await result.textContent()).includes('5 / 5 Questions'),`${label}: question count`);
  assert.equal(await page.locator('.df-skill-card').count(),5,`${label}: five skill cards`);
  assert((await page.locator('.df-skill-card').nth(0).textContent()).includes('Treble Pitch'),`${label}: learner-facing skill name`);
  assert.equal(await page.locator('.df-status.mastered').count(),3,`${label}: mastered status count`);
  assert.equal(await page.locator('.df-status.developing').count(),1,`${label}: developing status count`);
  assert.equal(await page.locator('.df-status.needs-practice').count(),1,`${label}: needs-practice status count`);
  assert.equal(await page.locator('.df-weak-card').count(),2,`${label}: only meaningful weak areas`);
  assert((await page.locator('.df-recommendation').textContent()).includes('Scale Accidental Practice'),`${label}: recommendation skill`);
  assert((await page.locator('.df-recommendation').textContent()).includes('Stage 2'),`${label}: recommendation stage`);
  assert.equal(await page.locator('.df-comparison').count(),0,`${label}: no fake previous-session comparison`);
  assert.equal(await page.locator('.df-progress[role="progressbar"]').count(),5,`${label}: accessible progress bars`);
  assert.equal(await page.locator('#diagnosticRecommendedAction').getAttribute('type'),'button',`${label}: CTA button semantics`);
  const cta=await page.locator('#diagnosticRecommendedAction').boundingBox();
  assert(cta && cta.height>=48,`${label}: CTA must meet touch target height`);
  assert.equal(await result.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${label}: no horizontal scrolling`);
  const gridColumns=await page.locator('.df-result-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
  if(width>=820) assert(gridColumns>=2,`${label}: desktop/tablet should use two-column main result layout`);
  else assert.equal(gridColumns,1,`${label}: mobile should stack result sections`);
}

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.setContent(`<!doctype html><html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eef1f5;font-family:system-ui,sans-serif"><div id="sessionSummary" class="summary-overlay" hidden><section class="summary-panel" style="width:min(960px,calc(100% - 24px));margin:20px auto;padding:16px;background:#fff"><div class="summary-kicker">สรุปผล</div><h2 id="summaryTitle"></h2><div id="summaryOverall"></div><div id="summaryMasteryStatus"></div><div class="summary-insight-grid"></div><div id="loSummaryList"></div><div id="questionScoreStrip"></div><div id="m15Roll"></div><div id="m15Actions"><button id="m15Dashboard" type="button">แดชบอร์ด</button></div><button id="restartSession" type="button">เริ่มการฝึกใหม่</button></section></div></body></html>`);
    await page.evaluate(()=>{
      window.__restartClicks=0;
      document.getElementById('restartSession').addEventListener('click',()=>window.__restartClicks++);
      window.MajorScaleApp={majorScaleConfig:{LO_META:{}}};
    });
    await page.addScriptTag({content:read('src/diagnostic-feedback.js')});
    await page.evaluate(({localQuestions,serverPayload})=>{
      const api=window.MajorScaleApp.diagnosticFeedback;
      api.resetSession({stageCode:'STAGE_2',exerciseCode:'MAJOR_SCALE_NOTATION',plannedQuestions:5});
      localQuestions.forEach(question=>api.captureQuestionResult(question));
      api.renderServerSession(serverPayload);
    },{localQuestions,serverPayload});

    assert.equal(await page.locator('#diagnosticRecommendedAction').evaluate(el=>el===document.activeElement),true,'primary CTA should receive focus when session result opens');
    await assertViewport(page,1440,1000,'Desktop');
    await assertViewport(page,1024,768,'Tablet');
    await assertViewport(page,390,844,'Mobile portrait');

    await page.locator('.df-review-all > summary').click();
    assert.equal(await page.locator('.df-question-review').count(),5,'Detailed Review should expose five questions');
    await page.locator('.df-question-review').nth(2).locator('summary').click();
    assert((await page.locator('.df-question-review').nth(2).textContent()).includes('Detailed Errors'),'question detail should expose diagnostic errors');

    await page.locator('#diagnosticRecommendedAction').click();
    assert.equal(await page.evaluate(()=>window.__restartClicks),1,'recommended Practice CTA should reuse existing restart flow exactly once');
    assert.deepEqual(errors,[]);
    console.log('PASS Diagnostic Feedback browser: session hierarchy, skill states, weak areas, recommendation, details, accessibility and Desktop/Tablet/Mobile responsiveness');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
