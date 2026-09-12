'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT=path.resolve(__dirname,'..');

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:900,height:700}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
    await page.setContent(`<!doctype html><html><body>
      <div id="questionResultOverlay">
        <div id="questionResultFeedback">
          <ul>
            <li><b>Treble Pitch</b>: โน้ตตำแหน่ง 2</li>
            <li><b>Primary Beam</b>: Beam โน้ต 3–4</li>
          </ul>
        </div>
        <div id="questionResultNotation">
          <svg class="question-result-score-snapshot" viewBox="0 0 500 160">
            <g class="n1"><ellipse cx="60" cy="80" rx="10" ry="7" fill="#111" stroke="#111"></ellipse></g>
            <g class="n2"><text class="smufl-notehead" x="130" y="80" fill="#111">●</text></g>
            <g class="n3"><ellipse cx="200" cy="80" rx="10" ry="7" fill="#111" stroke="#111"></ellipse></g>
            <g class="n4"><text class="smufl-notehead" x="270" y="80" fill="#111">●</text></g>
            <g class="n5"><ellipse cx="340" cy="80" rx="10" ry="7" fill="#111" stroke="#111"></ellipse></g>
          </svg>
        </div>
      </div>
    </body></html>`);
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'src/feedback-notation-errors.js'),'utf8')});
    await page.waitForFunction(()=>document.querySelector('.n4')?.classList.contains('feedback-wrong-note'));

    const result=await page.evaluate(()=>({
      parsed:window.MajorScaleApp.feedbackNotationErrors.parseWrongNotePositions(document.getElementById('questionResultFeedback').textContent),
      colors:[...document.querySelectorAll('.question-result-score-snapshot > g')].map(group=>{
        const node=group.querySelector('ellipse,text');
        return node.getAttribute('fill');
      }),
      wrong:[...document.querySelectorAll('.question-result-score-snapshot > g')].map(group=>group.classList.contains('feedback-wrong-note')),
      aria:document.querySelector('.question-result-score-snapshot').getAttribute('aria-label')
    }));

    assert.deepEqual(result.parsed,[2,3,4]);
    assert.deepEqual(result.colors,['#111','#c62828','#c62828','#c62828','#111']);
    assert.deepEqual(result.wrong,[false,true,true,true,false]);
    assert(result.aria.includes('สีแดง'));
    assert.deepEqual(errors,[]);
    console.log('PASS feedback notation: wrong note positions and beam ranges render red only in the review snapshot');
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
