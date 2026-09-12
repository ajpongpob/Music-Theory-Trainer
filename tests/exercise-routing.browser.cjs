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
    assert.equal(await page.locator('#levelSelect').isDisabled(),true,'Learning Path launch must visibly lock Level');
    const enforcedLevel=await page.evaluate(()=>__qa.state.level);
    const tamper=await page.evaluate(()=>{
      const select=document.getElementById('levelSelect');
      select.disabled=false; select.value='4'; select.dispatchEvent(new Event('change',{bubbles:true}));
      return {value:select.value,disabled:select.disabled,level:__qa.state.level};
    });
    assert.equal(tamper.level,enforcedLevel,'manual DOM change cannot alter active path level');
    assert.equal(Number(tamper.value),enforcedLevel,'Level select snaps back after tamper');
    assert.equal(tamper.disabled,true,'Level select relocks after tamper');
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
    assert.equal(await page.locator('#questionResultNotation svg').count(),1,'feedback should show a submitted notation snapshot');
    assert.equal(await page.locator('#questionResultNotation .entry-cursor').count(),0,'review snapshot should not show the editing cursor');
    assert.equal(await page.locator('#questionResultNotation .note-hit-target').count(),0,'review snapshot should not contain interaction hit targets');
    assert.equal(await page.locator('#questionResultFeedback').evaluate(el=>el.textContent.includes('คะแนนรวมแบบถ่วงน้ำหนัก')),false,'weighted-score wording should be removed from feedback');
    assert.equal(await page.locator('#questionResultContinue').evaluate(el=>!!el.closest('[inert]')),false,'feedback must not have an inert ancestor');
    assert.equal(await page.locator('.session-main').evaluate(el=>el.inert),true,'feedback background is inert');
    await page.waitForFunction(()=>__qaCalls.some(c=>c[0]==='practice.createAttempt'));
    assert(!await page.evaluate(()=>__qaCalls.some(c=>c[0]==='practice.getRequiredActiveStageByCode' && c[2]==='STAGE_4')),'tampered higher Stage must never reach persistence');
    await page.locator('#questionResultContinue').click();
    await page.locator('#levelMasteryOverlay').waitFor({state:'visible'});
    await page.locator('#continueNextLevel').click();
    await page.locator('#levelMasteryOverlay').waitFor({state:'hidden'});
    await page.locator('#dashboardButton').click();
    await page.waitForFunction(()=>!document.getElementById('studentDashboard').hidden);
    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext()),null);
    // Diagnostic recommendation uses the same exercise runtime with an explicit pretest mode.
    const diagnostic=page.locator('#dashboardRecommendation .dashboard-continue');
    await diagnostic.click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden && __qa.state.sessionMode==='pretest');
    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext().sessionMode),'pretest','Host carries diagnostic mode');
    assert.equal(await page.locator('#levelSelect').isDisabled(),true,'Diagnostic path Stage must also lock Level');
    assert.equal(await page.evaluate(()=>__qa.state.sessionLength),2,'diagnostic plan uses required Stage items');
    for(let q=0;q<2;q++){
      await page.evaluate(questionIndex=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'diag'+questionIndex+'-'+i}));__qa.render();},q);
      await page.locator('#checkAnswer').click();
      await page.locator('#questionResultOverlay').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.getElementById('questionResultContinue').disabled);
      if(q===0){
        await page.locator('#questionResultContinue').click();
        await page.waitForFunction(()=>document.getElementById('questionResultOverlay').hidden && __qa.state.questionIndex===1);
      }else{
        // M1.5 intentionally inserts a diagnostic feedback/placement summary
        // before returning to the Dashboard.
        await page.waitForFunction(()=>document.getElementById('questionResultContinue').dataset.m15==='diagnostic');
        assert.equal(await page.locator('#questionResultContinue').textContent(),'ดูผลประเมินก่อนเรียน');
        await page.locator('#questionResultContinue').click();
        await page.locator('#sessionSummary').waitFor({state:'visible'});
        assert.equal(await page.locator('#summaryTitle').textContent(),'ผลประเมินก่อนเรียน');
        assert(await page.locator('#summaryMasteryStatus').evaluate(el=>el.textContent.includes('จุดเริ่มต้น') || el.textContent.includes('กำหนดจุดเริ่มต้น')),'diagnostic feedback must explain placement purpose');
        await page.locator('#m15Dashboard').click();
      }
    }
    await page.waitForFunction(()=>!document.getElementById('studentDashboard').hidden);
    assert(await page.evaluate(()=>__qaCalls.some(c=>c[0]==='learning.applyDiagnosticPlacement')),'diagnostic placement persisted after final pretest item');
    assert(await page.evaluate(()=>__qaCalls.some(c=>c[0]==='practice.createPracticeSession' && c[1]?.mode==='pretest')),'pretest session persisted with explicit mode');
    await page.locator('.dashboard-continue').first().click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden);
    assert.equal(await page.evaluate(()=>__qa.state.notes.filter(Boolean).length),0,'reopen clears answer');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile'+i}));__qa.render();});
    const mobileScoreBox=await page.locator('#scoreSvg').boundingBox();
    assert(mobileScoreBox && mobileScoreBox.height/mobileScoreBox.width>0.82,'narrow score should grow vertically instead of letterboxing tiny notation');
    await page.locator('#rangeSelectToggle').click();
    await page.locator('#scoreSvg g[data-note-id]').nth(1).click();
    await page.locator('#scoreSvg g[data-note-id]').nth(3).click();
    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),3,'mobile range selection');
    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile-review'+i}));__qa.state.selectedIds.clear();__qa.render();});
    await page.locator('#checkAnswer').click();
    await page.locator('#questionResultOverlay').waitFor({state:'visible'});
    assert.equal(await page.locator('#questionResultNotation svg.question-result-score-snapshot-compact').count(),1,'narrow review should use compact two-system snapshot');
    assert.equal(await page.locator('#questionResultNotation svg g[data-system]').count(),2,'final whole-note measure should share the second review system');
    const reviewBox=await page.locator('#questionResultNotation svg').boundingBox();
    assert(reviewBox && reviewBox.width>320,'narrow review notation should use the available popup width');
    assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
    console.log('PASS browser: HTTP subpath, Dashboard recommendation → diagnostic feedback/placement → Dashboard, double click → Host → legacy runtime, A-G, click, drag, Shift/mobile selection, accidentals, durations, stems, beams/remove, 100% answer, popup, narrow score sizing + compact review, attempt save, return/reopen');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
