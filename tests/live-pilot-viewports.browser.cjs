'use strict';

// M1.5 live responsive smoke. Uses the same dedicated QA learner as M1.1.
// It opens (but does not answer) the recommended exercise at each viewport,
// so it verifies real deployed Dashboard/Trainer routing without authoring
// additional attempt evidence.

const assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const APP_URL=process.env.LIVE_APP_URL || 'https://ajpongpob.github.io/Music-Theory-Trainer/';
const EMAIL=process.env.QA_STUDENT_EMAIL || '';
const PASSWORD=process.env.QA_STUDENT_PASSWORD || '';
const VIEWPORTS=Object.freeze([
  {name:'desktop-1440',width:1440,height:900},
  {name:'desktop-1280',width:1280,height:800},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'tablet-portrait',width:768,height:1024},
  {name:'mobile-390',width:390,height:844},
  {name:'mobile-360',width:360,height:800}
]);

function guard(){
  assert.equal(process.env.LIVE_TEST_CONFIRM,'YES','Refusing live viewport QA without LIVE_TEST_CONFIRM=YES');
  assert(EMAIL && PASSWORD,'Dedicated QA student credentials are required');
  assert(/^https:\/\//.test(APP_URL),'LIVE_APP_URL must be HTTPS');
}

async function waitForDashboard(page){
  await page.waitForFunction(()=>{
    const shell=document.getElementById('studentDashboard');
    const content=document.getElementById('dashboardContent');
    return shell && !shell.hidden && content && !content.hidden;
  },{timeout:30000});
}

async function waitForLearningPathStageLock(page){
  await page.waitForFunction(()=>{
    const select=document.getElementById('levelSelect');
    return !!select && select.disabled===true;
  },{timeout:30000});
}

async function login(page){
  await page.goto(APP_URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#loginEmail').fill(EMAIL);
  await page.locator('#loginPassword').fill(PASSWORD);
  await page.locator('#loginButton').click();
  await waitForDashboard(page);
}

async function layoutMetrics(page,rootSelector){
  return page.evaluate(selector=>{
    const root=document.querySelector(selector);
    const rect=root?.getBoundingClientRect?.() || null;
    return {
      innerWidth:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth,
      rootVisible:!!root && !root.hidden && !!(rect && rect.width>0 && rect.height>0),
      rootLeft:rect?.left ?? null,
      rootRight:rect?.right ?? null
    };
  },rootSelector);
}

function assertNoPageOverflow(metrics,label){
  assert(metrics.rootVisible,`${label}: primary shell must be visible`);
  assert(metrics.documentWidth<=metrics.innerWidth+2,`${label}: document horizontal overflow ${metrics.documentWidth}px > ${metrics.innerWidth}px`);
  assert(metrics.bodyWidth<=metrics.innerWidth+2,`${label}: body horizontal overflow ${metrics.bodyWidth}px > ${metrics.innerWidth}px`);
  assert(metrics.rootLeft>=-2,`${label}: shell must not clip beyond left viewport`);
  assert(metrics.rootRight<=metrics.innerWidth+2,`${label}: shell must not clip beyond right viewport`);
}

async function visibleAction(page){
  const recommendation=page.locator('.dashboard-recommendation-action:not([disabled])').first();
  if(await recommendation.count() && await recommendation.isVisible()) return recommendation;
  const continuation=page.locator('.dashboard-continue:not([disabled])').first();
  assert(await continuation.count(), 'Dashboard must expose a usable next action for the dedicated QA learner');
  return continuation;
}

async function smokeViewport(page,viewport){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.waitForTimeout(100);

  const dashboardMetrics=await layoutMetrics(page,'#studentDashboard');
  assertNoPageOverflow(dashboardMetrics,`${viewport.name} dashboard`);

  const action=await visibleAction(page);
  const actionBox=await action.boundingBox();
  assert(actionBox && actionBox.width>0 && actionBox.height>=32,`${viewport.name}: next-action control must remain usable`);
  assert(actionBox.x>=-2 && actionBox.x+actionBox.width<=viewport.width+2,`${viewport.name}: next-action control must fit viewport width`);

  await action.click();
  await page.waitForFunction(()=>{
    const trainer=document.getElementById('trainerApp');
    return trainer && !trainer.hidden && window.MajorScaleApp?.exerciseHost?.getCurrentContext?.();
  },{timeout:30000});
  await waitForLearningPathStageLock(page);

  const trainerMetrics=await layoutMetrics(page,'#trainerApp');
  assertNoPageOverflow(trainerMetrics,`${viewport.name} trainer`);
  assert.equal(await page.locator('#levelSelect').isDisabled(),true,`${viewport.name}: Stage/Level must remain Learning-Path controlled`);
  assert(await page.locator('#checkAnswer').isVisible(),`${viewport.name}: Check Answer must remain visible`);
  assert(await page.locator('#dashboardButton').isVisible(),`${viewport.name}: Dashboard return must remain visible`);

  await page.locator('#dashboardButton').click();
  await waitForDashboard(page);
  return {
    name:viewport.name,
    size:`${viewport.width}x${viewport.height}`,
    dashboardOverflow:false,
    trainerOverflow:false,
    routing:true
  };
}

(async()=>{
  guard();
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error.message || error)));

  try{
    await login(page);
    const results=[];
    for(const viewport of VIEWPORTS){
      results.push(await smokeViewport(page,viewport));
    }
    assert.deepEqual(pageErrors,[],'Responsive live smoke must not produce uncaught page errors');
    console.log(JSON.stringify({status:'PASS',browser:'Chrome',viewports:results},null,2));
  }catch(error){
    console.error('LIVE VIEWPORT QA FAILED:',String(error?.message || error).replace(EMAIL,'<qa-student>'));
    process.exitCode=1;
  }finally{
    await context.close();
    await browser.close();
  }
})();
