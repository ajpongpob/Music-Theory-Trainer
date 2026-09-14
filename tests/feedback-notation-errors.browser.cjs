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
            <g class="n2 feedback-wrong-note"><text class="smufl-notehead" x="130" y="80" fill="#c62828">●</text></g>
            <g class="n3 feedback-wrong-note"><ellipse cx="200" cy="80" rx="10" ry="7" fill="#c62828" stroke="#c62828"></ellipse></g>
            <g class="n4 feedback-wrong-note"><text class="smufl-notehead" x="270" y="80" fill="#c62828">●</text></g>
            <g class="n5"><ellipse cx="340" cy="80" rx="10" ry="7" fill="#111" stroke="#111"></ellipse></g>
          </svg>
        </div>
      </div>
    </body></html>`);
    await page.addScriptTag({content:fs.readFileSync(path.join(ROOT,'src/feedback-notation-errors.js'),'utf8')});
    await page.waitForFunction(()=>{
      const snapshot=document.querySelector('.question-result-score-snapshot');
      return snapshot
        && !snapshot.querySelector('.feedback-wrong-note')
        && !snapshot.querySelector('[fill="#c62828"],[fill="#C62828"],[stroke="#c62828"],[stroke="#C62828"]');
    });

    const result=await page.evaluate(()=>({
      parsed:window.MajorScaleApp.feedbackNotationErrors.parseWrongNotePositions(document.getElementById('questionResultFeedback').textContent),
      colors:[...document.querySelectorAll('.question-result-score-snapshot > g')].map(group=>{
        const node=group.querySelector('ellipse,text');
        return node.getAttribute('fill');
      }),
      wrong:[...document.querySelectorAll('.question-result-score-snapshot > g')].map(group=>group.classList.contains('feedback-wrong-note')),
      aria:document.querySelector('.question-result-score-snapshot').getAttribute('aria-label')
    }));

    // Parser remains available for compatibility, but answer review is neutral:
    // no incorrect note is recolored or marked in the submitted notation image.
    assert.deepEqual(result.parsed,[2,3,4]);
    assert.deepEqual(result.colors,['#111','#111','#111','#111','#111']);
    assert.deepEqual(result.wrong,[false,false,false,false,false]);
    assert.equal(result.aria,'คำตอบของผู้เรียนข้อนี้');
    assert.deepEqual(errors,[]);
    console.log('PASS feedback notation: review snapshot keeps the learner answer neutral with no red wrong-note highlighting');
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
