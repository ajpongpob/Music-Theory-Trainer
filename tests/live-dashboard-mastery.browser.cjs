'use strict';

// M1 closeout gate: prove that the learner-facing Mastery panel itself loads
// against the live Supabase project. This complements live-pilot.browser.cjs,
// which verifies the underlying trusted Mastery RPC and persistence path.

const assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const APP_URL=process.env.LIVE_APP_URL || 'https://ajpongpob.github.io/Music-Theory-Trainer/';
const STUDENT_EMAIL=process.env.QA_STUDENT_EMAIL || '';
const STUDENT_PASSWORD=process.env.QA_STUDENT_PASSWORD || '';

function requireLiveGuard(){
  assert.equal(process.env.LIVE_TEST_CONFIRM,'YES','Refusing live QA without LIVE_TEST_CONFIRM=YES');
  assert(STUDENT_EMAIL && STUDENT_PASSWORD,'QA_STUDENT_EMAIL and QA_STUDENT_PASSWORD are required');
  assert(/^https:\/\//.test(APP_URL),'LIVE_APP_URL must be HTTPS');
}

async function waitForDashboard(page){
  await page.waitForFunction(()=>{
    const dashboard=document.getElementById('studentDashboard');
    const content=document.getElementById('dashboardContent');
    return dashboard && !dashboard.hidden && content && !content.hidden;
  },{timeout:30000});
}

async function waitForMasteryPanel(page){
  await page.waitForFunction(()=>{
    const body=document.getElementById('dashboardMasteryBody');
    if(!body) return false;
    const text=(body.textContent || '').trim();
    return text && !/กำลังโหลดผลการเรียน/.test(text);
  },{timeout:30000});

  const state=await page.locator('#dashboardMasteryBody').evaluate(body=>({
    className:body.className || '',
    text:(body.textContent || '').replace(/\s+/g,' ').trim(),
    hasSummary:!!body.querySelector('.dashboard-mastery-summary'),
    hasSkillList:!!body.querySelector('.dashboard-skill-list')
  }));

  assert(!/(^|\s)error(\s|$)/.test(state.className),'Dashboard Mastery panel must not render an error state');
  assert(!/โหลดผลการเรียนไม่สำเร็จ/.test(state.text),'Dashboard Mastery panel must load learner-facing Mastery data');
  assert(state.hasSummary || /สำเร็จ|ผ่านแล้ว|ยังไม่มีขั้น/.test(state.text),'Dashboard Mastery panel must render a valid learner state');
  return state;
}

async function login(page){
  await page.goto(APP_URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#loginEmail').fill(STUDENT_EMAIL);
  await page.locator('#loginPassword').fill(STUDENT_PASSWORD);
  await page.locator('#loginButton').click();
  await waitForDashboard(page);
}

(async()=>{
  requireLiveGuard();
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const relevantConsoleErrors=[];
  const pageErrors=[];

  page.on('pageerror',error=>pageErrors.push(String(error?.message || error)));
  page.on('console',message=>{
    if(message.type()!=='error') return;
    const text=message.text();
    if(/LOAD DASHBOARD MASTERY ERROR|get_my_stage_mastery|blocked by CORS|Failed to fetch/i.test(text)){
      relevantConsoleErrors.push(text);
    }
  });

  try{
    await login(page);
    const initial=await waitForMasteryPanel(page);

    await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    await waitForDashboard(page);
    const reloaded=await waitForMasteryPanel(page);

    assert.deepEqual(pageErrors,[],'Dashboard must not raise uncaught page errors');
    assert.deepEqual(relevantConsoleErrors,[],'Dashboard Mastery must not emit CORS/fetch/Mastery console errors');

    console.log(JSON.stringify({
      status:'PASS',
      appUrl:APP_URL,
      dashboardMastery:{initial,reloaded}
    },null,2));
  }catch(error){
    console.error('LIVE DASHBOARD MASTERY QA FAILED:',String(error?.stack || error));
    if(relevantConsoleErrors.length) console.error('Relevant console errors:',JSON.stringify(relevantConsoleErrors,null,2));
    process.exitCode=1;
  }finally{
    await context.close();
    await browser.close();
  }
})();
