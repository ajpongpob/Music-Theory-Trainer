'use strict';

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
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end();return;
  }
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    page.on('dialog',d=>d.accept());

    await page.route('**/*supabase-js*',r=>r.fulfill({contentType:'application/javascript',body:`${sdk}\nwindow.supabase={createClient:()=>makeClient('student',window)};`}));
    await page.route('**/src/trainer.js*',r=>{
      const source=read('src/trainer.js').replace(
        'initializeTrainerAfterMusicFont();\n})();',
        'window.__qa={state,render};\ninitializeTrainerAfterMusicFont();\n})();'
      );
      return r.fulfill({contentType:'application/javascript',body:injection+source});
    });

    await page.goto(`http://127.0.0.1:${server.address().port}/checkpoint/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!document.getElementById('dashboardContent').hidden && window.__qa?.state && window.MajorScaleApp.m15FeedbackHardening);
    await page.locator('.dashboard-continue').first().click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden && window.MajorScaleApp.exerciseHost.getCurrentContext());

    // Regression 1: a CSS width set by the mastery renderer must become a
    // visible fill, not just a percentage label on an inline span.
    await page.evaluate(()=>{
      const fill=document.getElementById('masteryPowerFill');
      const text=document.getElementById('masteryPowerText');
      fill.style.width='63%';
      text.textContent='63%';
    });
    // The production bar intentionally animates width for 350 ms. Measure
    // after the transition so the test verifies the settled visual state.
    await page.waitForTimeout(450);
    const progress=await page.evaluate(()=>{
      const track=document.querySelector('.mastery-power-track');
      const fill=document.getElementById('masteryPowerFill');
      const text=document.getElementById('masteryPowerText');
      const trackRect=track.getBoundingClientRect();
      const fillRect=fill.getBoundingClientRect();
      return {
        label:text.textContent,
        trackWidth:trackRect.width,
        fillWidth:fillRect.width,
        display:getComputedStyle(fill).display,
        position:getComputedStyle(fill).position
      };
    });
    assert.equal(progress.label,'63%');
    assert(progress.trackWidth>0,'mastery track must have measurable width');
    assert(progress.fillWidth/progress.trackWidth>0.60,'63% progress must render as a visible proportional fill');
    assert.notEqual(progress.display,'inline','progress fill must not remain inline');

    // Regression 1b: expanded mastery detail inherits from a dark task card,
    // so it must explicitly reset all text to an accessible dark foreground.
    await page.evaluate(()=>{
      const details=document.getElementById('masteryProgress');
      details.open=true;
      document.getElementById('masteryDetailGrid').innerHTML='<div class="mastery-detail-item fail"><div class="mastery-detail-top"><span>เครื่องหมายแปลงเสียง</span><b>47%</b></div><small>เป้าหมาย 90%</small></div>';
    });
    const detailColors=await page.evaluate(()=>[...document.querySelectorAll('.mastery-details,.mastery-details-head span,.mastery-detail-top span,.mastery-detail-top b,.mastery-detail-item small')]
      .map(node=>getComputedStyle(node).color));
    assert(detailColors.every(color=>color!=='rgb(255, 255, 255)'),`expanded mastery detail must not inherit white text: ${detailColors.join(', ')}`);

    // Regression 2: immediately after inserting a note, the visible highlight
    // must be editable without requiring an extra click on that note.
    await page.locator('#insertNote').click();
    assert.equal(await page.evaluate(()=>__qa.state.notes[0]?.rhythm),'quarter','inserted note starts with current quarter-note tool');
    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),1,'inserted note stays highlighted');
    await page.locator('.rhythm[data-rhythm="eighth"]').click();
    assert.equal(await page.evaluate(()=>__qa.state.notes[0]?.rhythm),'eighth','palette changes the highlighted newly inserted note value');

    // Keyboard duration shortcuts must have the same post-insert behavior.
    await page.locator('#resetScore').click();
    await page.locator('#insertNote').click();
    await page.locator('#scoreSvg').focus();
    await page.keyboard.press('5');
    assert.equal(await page.evaluate(()=>__qa.state.notes[0]?.rhythm),'sixteenth','shortcut 5 changes the highlighted newly inserted note value');

    assert.deepEqual(errors,[]);
    console.log('PASS editor regressions: visible mastery fill + post-insert note value editing by palette and shortcut');
  }finally{
    await browser.close();
    server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
  server.close();
});
