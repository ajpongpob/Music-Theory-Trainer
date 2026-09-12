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
  {name:'mobile-landscape',width:844,height:390},
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

async function compactScoreMetrics(page){
  return page.evaluate(()=>{
    const svg=document.getElementById('scoreSvg');
    const systems=Array.from(svg?.querySelectorAll('g[data-system]') || []);
    const systemRects=systems.map(node=>node.getBoundingClientRect());
    const workspace=document.querySelector('.workspace-card');
    const palette=document.querySelector('.workspace-card .notation-palette');
    return {
      systemCount:systems.length,
      viewBox:svg?.getAttribute('viewBox') || null,
      systemTops:systemRects.map(rect=>rect.top),
      systemBottoms:systemRects.map(rect=>rect.bottom),
      systemHeights:systemRects.map(rect=>rect.height),
      workspaceOverflow:workspace ? getComputedStyle(workspace).overflow : null,
      palettePosition:palette ? getComputedStyle(palette).position : null,
      pageOverflowY:getComputedStyle(document.documentElement).overflowY
    };
  });
}

async function assertThirdCompactSystemReachable(page,label){
  await page.evaluate(()=>{
    const third=document.querySelector('#scoreSvg g[data-system="2"]');
    if(!third) throw new Error('missing third compact notation system');
    third.scrollIntoView({block:'center',inline:'nearest'});
  });
  await page.waitForTimeout(50);
  const metrics=await page.evaluate(()=>{
    const third=document.querySelector('#scoreSvg g[data-system="2"]');
    const rect=third.getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,height:rect.height,innerHeight:window.innerHeight};
  });
  assert(metrics.height>0,`${label}: third notation system must render with positive height`);
  assert(metrics.bottom>0 && metrics.top<metrics.innerHeight,`${label}: third notation system must be reachable in the viewport after vertical scrolling`);
}

async function assertMobileTouchCenters(page,label){
  for(const id of ['navPrev','pitchUp','pitchDown','navNext','insertNote','rangeSelectToggle']){
    const locator=page.locator(`#${id}`);
    await locator.scrollIntoViewIfNeeded();
    const box=await locator.boundingBox();
    assert(box,`${label}: ${id} must have a touch box`);
    const point={x:box.x+box.width/2,y:box.y+box.height/2};
    const hitId=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id || null,point);
    assert.equal(hitId,id,`${label}: touch center for ${id} must hit ${id}, not an overlapping control`);
  }
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

  const isLandscape=viewport.width>viewport.height;
  if(isLandscape){
    const landscapeScore=await compactScoreMetrics(page);
    assert.equal(landscapeScore.systemCount,0,`${viewport.name}: landscape score must use one continuous system`);
    assert.equal(landscapeScore.viewBox,'0 0 1400 350',`${viewport.name}: landscape score must use the full three-measure viewBox`);
  }

  if(viewport.width<=815 && !isLandscape){
    await page.waitForFunction(()=>Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').includes('mobile-safari-fix.css')),{timeout:30000});
    await page.waitForTimeout(100);
    const compact=await compactScoreMetrics(page);
    assert.equal(compact.systemCount,3,`${viewport.name}: compact score must expose all three notation systems`);
    assert.equal(compact.viewBox,'0 0 700 660',`${viewport.name}: compact score must use the three-system viewBox`);
    assert(compact.systemTops[1]>compact.systemTops[0] && compact.systemTops[2]>compact.systemTops[1],`${viewport.name}: compact systems must remain vertically ordered`);
    assert(compact.systemHeights.every(height=>height>0),`${viewport.name}: all compact systems must render with positive height`);
    assert.notEqual(compact.workspaceOverflow,'hidden',`${viewport.name}: workspace must not clip compact systems 2-3`);
    assert.notEqual(compact.pageOverflowY,'hidden',`${viewport.name}: narrow Trainer must allow vertical page scrolling`);
    await assertThirdCompactSystemReachable(page,viewport.name);
    if(viewport.width<=699){
      assert.equal(compact.palettePosition,'static',`${viewport.name}: notation palette must not remain sticky over mobile navigation`);
      await assertMobileTouchCenters(page,viewport.name);
    }
  }

  await page.locator('#dashboardButton').click();
  await waitForDashboard(page);
  return {
    name:viewport.name,
    size:`${viewport.width}x${viewport.height}`,
    dashboardOverflow:false,
    trainerOverflow:false,
    compactSystems:isLandscape ? 0 : (viewport.width<=815 ? 3 : null),
    thirdSystemReachable:!isLandscape && viewport.width<=815 ? true : null,
    touchTargets:!isLandscape && viewport.width<=699 ? true : null,
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
