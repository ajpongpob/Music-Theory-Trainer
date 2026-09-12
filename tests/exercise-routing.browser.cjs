'use strict';
// Optional real-browser QA runner; no build or dependencies required by the site itself.
// Set PLAYWRIGHT_MODULE to an installed Playwright module path when not on NODE_PATH.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dashboards=read('tests/dashboard-runtime-smoke.test.js');
const sdk=dashboards.slice(dashboards.indexOf('function makeClient('),dashboards.indexOf('async function runScenario'));
const fixture=read('tests/trainer-data-flow-smoke.test.js');
const repositories=fixture.slice(fixture.indexOf('class MockElement'),fixture.indexOf('function loadTrainer'));
const injection=`(()=>{${repositories}\nconst qa=makeContext();window.__qaCalls=qa.__calls;Object.assign(window.MajorScaleApp,qa.MajorScaleApp);})();`;
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/checkpoint\//,'') || 'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[],badAssets=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') console.error('BROWSER',m.text());});
    page.on('response',r=>{if(r.url().includes('/checkpoint/')&&r.status()!==200)badAssets.push(r.url());});
    page.on('dialog',d=>d.accept());
    await page.route('**/*supabase-js*',r=>r.fulfill({contentType:'application/javascript',body:`${sdk}\nwindow.supabase={createClient:()=>makeClient('student',window)};`}));
    await page.route('**/src/trainer.js',r=>{
      const source=read('src/trainer.js').replace('initializeTrainerAfterMusicFont();\n})();','window.__qa={state,buildExpected,render,check,selectNoteRange,drawBeams};\ninitializeTrainerAfterMusicFont();\n})();');
      return r.fulfill({contentType:'application/javascript',body:injection+source});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/checkpoint/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!document.getElementById('dashboardContent').hidden && window.__qa?.state.smuflFontReady!==null);
    await page.evaluate(()=>{const start=window.majorScaleTrainerStartForAuthenticatedUser;window.__qaStarts=0;window.majorScaleTrainerStartForAuthenticatedUser=async(...args)=>{window.__qaStarts++;return start(...args);};});
    await page.locator('.dashboard-continue').first().dblclick();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden && window.MajorScaleApp.exerciseHost.getCurrentContext());
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>__qaStarts),1,'one runtime start on double click');
    assert.equal(await page.evaluate(()=>__qaCalls.filter(c=>c[0]==='practice.createPracticeSession').length),0,'legacy session is created lazily on first answer');
    await page.locator('#scoreSvg').focus();
    await page.keyboard.type('cdefgab');
    assert.equal(await page.evaluate(()=>__qa.state.notes.filter(Boolean).length),7,'A-G input');
    const first=page.locator('#scoreSvg g[data-note-id]').first();
    await first.click();
    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),1,'note click selection');
    const head=page.locator('#scoreSvg [data-note-id]').first();
    const box=await head.boundingBox();
    const before=await page.evaluate(()=>__qa.state.notes[0].letter+__qa.state.notes[0].octave);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2-25,{steps:5});await page.mouse.up();
    const after=await page.evaluate(()=>__qa.state.notes[0].letter+__qa.state.notes[0].octave);
    assert.notEqual(after,before,'pitch drag');
    await page.locator('#scoreSvg g[data-note-id]').first().click();
    await page.locator('#scoreSvg g[data-note-id]').nth(3).click({modifiers:['Shift']});
    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),4,'Shift range selection');
    await page.locator('#scoreSvg g[data-note-id]').first().click();
    for(const [key,value] of [['+','#'],['-','b'],['.',''],['*','##'],['/','bb']]){
      await page.keyboard.press(key);assert.equal(await page.evaluate(()=>__qa.state.notes[0].accidental),value);
    }
    for(const [key,value] of [['1','whole'],['2','half'],['3','quarter'],['4','eighth'],['5','sixteenth']]){
      await page.keyboard.press(key);assert.equal(await page.evaluate(()=>__qa.state.notes[0].rhythm),value);
    }
    const stem=await page.evaluate(()=>__qa.state.notes[0].stem);await page.keyboard.press('8');
    assert.notEqual(await page.evaluate(()=>__qa.state.notes[0].stem),stem);await page.keyboard.press('8');
    assert.equal(await page.evaluate(()=>__qa.state.notes[0].stem),stem);
    // Seed an expected answer through test-only hooks; production source stays unchanged.
    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'qa'+i}));__qa.render();});
    await page.locator('#scoreSvg g[data-note-id]').nth(1).click();
    await page.locator('#scoreSvg g[data-note-id]').nth(2).click({modifiers:['Shift']});
    await page.locator('#beamSelected').click();
    assert(await page.evaluate(()=>__qa.state.notes[1].beamGroup && __qa.state.notes[1].beamGroup===__qa.state.notes[2].beamGroup));
    await page.locator('#unbeamSelected').click();assert.equal(await page.evaluate(()=>__qa.state.notes[1].beamGroup),null);
    // The unchanged expected-answer and scoring path, 2+4 beaming and feedback UI.
    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'qa'+i}));__qa.render();});
    await page.locator('#checkAnswer').click();
    await page.waitForFunction(()=>document.getElementById('questionResultScore').textContent==='100%');
    await page.locator('#questionResultOverlay').waitFor({state:'visible'});
    assert.equal(await page.locator('#questionResultContinue').evaluate(el=>!!el.closest('[inert]')),false,'feedback must not have an inert ancestor');
    assert.equal(await page.locator('.session-main').evaluate(el=>el.inert),true,'feedback background is inert');
    await page.waitForFunction(()=>__qaCalls.some(c=>c[0]==='practice.createAttempt'));
    await page.locator('#questionResultContinue').click();
    await page.locator('#levelMasteryOverlay').waitFor({state:'visible'});
    await page.locator('#continueNextLevel').click();
    await page.locator('#levelMasteryOverlay').waitFor({state:'hidden'});
    await page.locator('#dashboardButton').click();
    await page.waitForFunction(()=>!document.getElementById('studentDashboard').hidden);
    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext()),null);
    await page.locator('.dashboard-continue').first().click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden);
    assert.equal(await page.evaluate(()=>__qa.state.notes.filter(Boolean).length),0,'reopen clears answer');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile'+i}));__qa.render();});
    await page.locator('#rangeSelectToggle').click();
    await page.locator('#scoreSvg g[data-note-id]').nth(1).click();
    await page.locator('#scoreSvg g[data-note-id]').nth(3).click();
    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),3,'mobile range selection');
    assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
    console.log('PASS browser: HTTP subpath, Dashboard double click → Host → legacy runtime, A-G, click, drag, Shift/mobile selection, accidentals, durations, stems, beams/remove, 100% answer, popup, attempt save, return/reopen');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
