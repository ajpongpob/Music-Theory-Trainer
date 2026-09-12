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
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});

async function centerOf(page,selector){
  const locator=page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox();
  assert(box,`missing bounding box for ${selector}`);
  return {x:box.x+box.width/2,y:box.y+box.height/2};
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=[],badAssets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/checkpoint/')&&r.status()!==200)badAssets.push(r.url());});
  page.on('dialog',d=>d.accept());
  await page.route('**/*supabase-js*',r=>r.fulfill({contentType:'application/javascript',body:`${sdk}\nwindow.supabase={createClient:()=>makeClient('student',window)};`}));
  await page.route('**/src/trainer.js',r=>{
    const source=read('src/trainer.js').replace('initializeTrainerAfterMusicFont();\n})();','window.__qa={state,buildExpected,render};\ninitializeTrainerAfterMusicFont();\n})();');
    return r.fulfill({contentType:'application/javascript',body:injection+source});
  });

  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/checkpoint/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!document.getElementById('dashboardContent').hidden && window.__qa?.state.smuflFontReady!==null);
    await page.locator('.dashboard-continue').first().click();
    await page.waitForFunction(()=>{
      const trainer=document.getElementById('trainerApp');
      const select=document.getElementById('levelSelect');
      return trainer && !trainer.hidden && select?.disabled===true;
    });
    await page.waitForFunction(()=>Array.from(document.styleSheets).some(sheet=>String(sheet.href||'').includes('mobile-safari-fix.css')));
    await page.waitForTimeout(100);

    const layout=await page.evaluate(()=>{
      const svg=document.getElementById('scoreSvg');
      const systems=Array.from(svg.querySelectorAll('g[data-system]'));
      const svgRect=svg.getBoundingClientRect();
      const systemRects=systems.map(node=>node.getBoundingClientRect());
      const workspace=document.querySelector('.workspace-card');
      const palette=document.querySelector('.workspace-card .notation-palette');
      const scroller=document.scrollingElement || document.documentElement || document.body;
      return {
        systemCount:systems.length,
        viewBox:svg.getAttribute('viewBox'),
        svgTop:svgRect.top,
        svgBottom:svgRect.bottom,
        systemTops:systemRects.map(rect=>rect.top),
        systemBottoms:systemRects.map(rect=>rect.bottom),
        workspaceOverflow:getComputedStyle(workspace).overflow,
        palettePosition:getComputedStyle(palette).position,
        pageOverflowY:getComputedStyle(document.documentElement).overflowY,
        scrollHeight:scroller?.scrollHeight ?? 0,
        innerHeight:window.innerHeight
      };
    });

    assert.equal(layout.systemCount,3,'mobile compact editor must render all three notation systems');
    assert.equal(layout.viewBox,'0 0 700 660','mobile compact editor must retain the three-system viewBox');
    assert(layout.systemTops[1]>layout.systemTops[0] && layout.systemTops[2]>layout.systemTops[1],'systems must remain vertically ordered');
    assert(layout.systemBottoms[2]<=layout.svgBottom+3,'third notation system must fit inside the visible SVG box');
    assert.notEqual(layout.workspaceOverflow,'hidden','workspace must not clip systems 2-3');
    assert.equal(layout.palettePosition,'static','mobile notation palette must not remain sticky over navigation controls');
    assert.notEqual(layout.pageOverflowY,'hidden','mobile page must permit vertical scrolling');

    for(const id of ['navPrev','pitchUp','pitchDown','navNext','insertNote','rangeSelectToggle']){
      const point=await centerOf(page,`#${id}`);
      const hitId=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id || null,point);
      assert.equal(hitId,id,`touch center for ${id} must hit ${id}, not an overlapping palette control`);
    }

    const beforeNext=await page.evaluate(()=>__qa.state.cursorIndex);
    const nextPoint=await centerOf(page,'#navNext');
    await page.touchscreen.tap(nextPoint.x,nextPoint.y);
    assert.equal(await page.evaluate(()=>__qa.state.cursorIndex),Math.min(beforeNext+1,14),'touching right arrow must execute navNext');

    const beforePitch=await page.evaluate(()=>__qa.state.cursorStaffStep);
    const upPoint=await centerOf(page,'#pitchUp');
    await page.touchscreen.tap(upPoint.x,upPoint.y);
    assert.equal(await page.evaluate(()=>__qa.state.cursorStaffStep),beforePitch+1,'touching up arrow must execute pitchUp');

    assert.deepEqual(errors,[],'mobile Safari regression fixture must not raise page errors');
    assert.deepEqual(badAssets,[],'mobile Safari regression fixture must load every local asset');
    console.log('PASS mobile touch browser: three compact systems remain visible/scrollable and arrow touch centers dispatch to the intended controls');
  }finally{
    await context.close();
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
