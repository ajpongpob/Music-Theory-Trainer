'use strict';
const fs=require('fs');

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,content){fs.writeFileSync(file,content);}
function replaceExact(source,before,after,label){
  const first=source.indexOf(before);
  if(first<0) throw new Error(`Missing patch target: ${label}`);
  if(source.indexOf(before,first+before.length)>=0) throw new Error(`Duplicate patch target: ${label}`);
  return source.slice(0,first)+after+source.slice(first+before.length);
}

const optimizer=`function optimizeQuestionResultSnapshotLayout(snapshot){
  const systems=Array.from(snapshot.querySelectorAll("g[data-system]"));
  if(systems.length!==3) return false;

  const second=systems[1];
  const third=systems[2];
  const secondBody=Array.from(second.children).find(node=>
    node.localName==="g" && node.getAttribute("pointer-events")!=="none"
  );
  const thirdBody=Array.from(third.children).find(node=>
    node.localName==="g" && node.getAttribute("pointer-events")!=="none"
  );
  if(!secondBody || !thirdBody) return false;

  // Review-only layout: keep measure 1 on the first system and place the
  // short final whole-note measure after measure 2 on the second system.
  // The editable score remains unchanged, so interaction geometry is safe.
  secondBody.setAttribute("transform","translate(-600 180)");
  thirdBody.setAttribute("transform","translate(-620 180)");
  Array.from(second.children).forEach(node=>{
    if(node.localName==="line") node.setAttribute("x2","740");
  });
  second.appendChild(thirdBody);
  second.setAttribute("transform","translate(0 -30)");
  third.remove();

  snapshot.setAttribute("viewBox","0 0 750 430");
  snapshot.classList.add("question-result-score-snapshot-compact");
  return true;
}

`;

let trainer=read('src/trainer.js');
trainer=replaceExact(
  trainer,
  'function renderQuestionResultNotationSnapshot(){\n',
  optimizer+'function renderQuestionResultNotationSnapshot(){\n',
  'review snapshot optimizer insertion'
);
trainer=replaceExact(
  trainer,
  '  snapshot.querySelectorAll(\'[stroke="#9b6400"]\').forEach(node=>node.setAttribute("stroke","#111"));\n\n  container.appendChild(snapshot);\n',
  '  snapshot.querySelectorAll(\'[stroke="#9b6400"]\').forEach(node=>node.setAttribute("stroke","#111"));\n\n  optimizeQuestionResultSnapshotLayout(snapshot);\n  container.appendChild(snapshot);\n',
  'review snapshot optimizer call'
);
write('src/trainer.js',trainer);

const narrowCss=`\n/* v0.8.1 feedback preview — narrow-screen notation readability */\n@media(max-width:815px){\n  .workspace-card .score-stage{\n    height:auto !important;\n    min-height:min(94vw,660px) !important;\n    overflow:visible !important;\n    align-items:stretch !important;\n  }\n  .workspace-card #scoreSvg{\n    width:100% !important;\n    height:min(94vw,660px) !important;\n    min-height:min(94vw,660px) !important;\n    max-height:none !important;\n    aspect-ratio:auto !important;\n    flex-shrink:0;\n  }\n  .question-result-notation{\n    overflow:auto;\n  }\n  .question-result-notation .question-result-score-snapshot{\n    max-height:none !important;\n  }\n  .question-result-notation .question-result-score-snapshot-compact{\n    width:100%;\n    height:auto !important;\n    max-height:none !important;\n  }\n}\n`;
let css=read('styles/app.css');
if(css.includes('v0.8.1 feedback preview — narrow-screen notation readability')) throw new Error('narrow-screen CSS already present');
css+=narrowCss;
write('styles/app.css',css);

const restoreSource=`'use strict';\nconst assert=require('assert');\n\nconst optimizer=${JSON.stringify(optimizer)};\nconst narrowCss=${JSON.stringify(narrowCss)};\n\nfunction replaceExact(source,after,before,label){\n  const i=source.indexOf(after);\n  assert(i>=0,'missing narrow-layout edit: '+label);\n  assert.equal(source.indexOf(after,i+after.length),-1,'duplicate narrow-layout edit: '+label);\n  return source.slice(0,i)+before+source.slice(i+after.length);\n}\n\nmodule.exports=function restoreNarrowNotationLayout(source,file){\n  if(file==='styles/app.css'){\n    return replaceExact(source,narrowCss,'','narrow CSS');\n  }\n  if(file!=='src/trainer.js') return source;\n\n  source=replaceExact(\n    source,\n    optimizer+'function renderQuestionResultNotationSnapshot(){\\n',\n    'function renderQuestionResultNotationSnapshot(){\\n',\n    'snapshot optimizer'\n  );\n  source=replaceExact(\n    source,\n    '  snapshot.querySelectorAll(\\'[stroke="#9b6400"]\\').forEach(node=>node.setAttribute("stroke","#111"));\\n\\n  optimizeQuestionResultSnapshotLayout(snapshot);\\n  container.appendChild(snapshot);\\n',\n    '  snapshot.querySelectorAll(\\'[stroke="#9b6400"]\\').forEach(node=>node.setAttribute("stroke","#111"));\\n\\n  container.appendChild(snapshot);\\n',\n    'snapshot optimizer call'\n  );\n  return source;\n};\n`;
write('tests/helpers/restore-narrow-notation-layout.cjs',restoreSource);

let major=read('tests/major-scale-domain.test.js');
major=replaceExact(
  major,
  "const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  "const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nconst restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  'major-scale narrow restoration chain'
);
write('tests/major-scale-domain.test.js',major);

let boundary=read('tests/notation-boundary.test.js');
boundary=replaceExact(
  boundary,
  "const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(read(file),file),file),file),file),file);\nfor(const [file,hash] of Object.entries(boundary.protectedProduction)){\n  const source=restoreFeedback(read(file),file);\n",
  "const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nconst restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(read(file),file),file),file),file),file),file);\nfor(const [file,hash] of Object.entries(boundary.protectedProduction)){\n  const source=restoreFeedback(restoreNarrow(read(file),file),file);\n",
  'notation narrow restoration chain'
);
write('tests/notation-boundary.test.js',boundary);

let browser=read('tests/exercise-routing.browser.cjs');
browser=replaceExact(
  browser,
  "    await page.setViewportSize({width:390,height:844});\n    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile'+i}));__qa.render();});\n    await page.locator('#rangeSelectToggle').click();\n    await page.locator('#scoreSvg g[data-note-id]').nth(1).click();\n    await page.locator('#scoreSvg g[data-note-id]').nth(3).click();\n    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),3,'mobile range selection');\n    assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);\n    console.log('PASS browser: HTTP subpath, Dashboard double click → Host → legacy runtime, A-G, click, drag, Shift/mobile selection, accidentals, durations, stems, beams/remove, 100% answer, popup, attempt save, return/reopen');\n",
  "    await page.setViewportSize({width:390,height:844});\n    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile'+i}));__qa.render();});\n    const mobileScoreBox=await page.locator('#scoreSvg').boundingBox();\n    assert(mobileScoreBox && mobileScoreBox.height/mobileScoreBox.width>0.82,'narrow score should grow vertically instead of letterboxing tiny notation');\n    await page.locator('#rangeSelectToggle').click();\n    await page.locator('#scoreSvg g[data-note-id]').nth(1).click();\n    await page.locator('#scoreSvg g[data-note-id]').nth(3).click();\n    assert.equal(await page.evaluate(()=>__qa.state.selectedIds.size),3,'mobile range selection');\n    await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'mobile-review'+i}));__qa.state.selectedIds.clear();__qa.render();});\n    await page.locator('#checkAnswer').click();\n    await page.locator('#questionResultOverlay').waitFor({state:'visible'});\n    assert.equal(await page.locator('#questionResultNotation svg.question-result-score-snapshot-compact').count(),1,'narrow review should use compact two-system snapshot');\n    assert.equal(await page.locator('#questionResultNotation svg g[data-system]').count(),2,'final whole-note measure should share the second review system');\n    const reviewBox=await page.locator('#questionResultNotation svg').boundingBox();\n    assert(reviewBox && reviewBox.width>320,'narrow review notation should use the available popup width');\n    assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);\n    console.log('PASS browser: HTTP subpath, Dashboard double click → Host → legacy runtime, A-G, click, drag, Shift/mobile selection, accidentals, durations, stems, beams/remove, 100% answer, popup, narrow score sizing + compact review, attempt save, return/reopen');\n",
  'browser narrow-screen readability assertions'
);
write('tests/exercise-routing.browser.cjs',browser);

console.log('Applied narrow-screen notation readability patch');
