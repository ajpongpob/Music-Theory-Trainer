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

let html=read('index.html');
html=replaceExact(
  html,
  '    <div class="question-result-feedback" id="questionResultFeedback"></div>\n',
  '    <div class="question-result-notation-block">\n      <div class="question-result-notation-label">คำตอบของคุณ</div>\n      <div class="question-result-notation" id="questionResultNotation" aria-label="คำตอบที่ผู้เรียนเขียน"></div>\n    </div>\n\n    <div class="question-result-feedback" id="questionResultFeedback"></div>\n',
  'question result notation markup'
);
write('index.html',html);

let trainer=read('src/trainer.js');
trainer=replaceExact(
  trainer,
  '    <div>คะแนนรวมแบบถ่วงน้ำหนัก • Pitch 30% • Stem 10% • Duration 15% • Beam 15% • Accidental 30%</div>\n',
  '',
  'weighted score explanation'
);
const helper=`function renderQuestionResultNotationSnapshot(){
  const container=document.getElementById("questionResultNotation");
  if(!container) return;

  container.innerHTML="";
  if(!scoreSvg || typeof scoreSvg.cloneNode!=="function") return;

  const snapshot=scoreSvg.cloneNode(true);
  snapshot.removeAttribute("id");
  snapshot.removeAttribute("tabindex");
  snapshot.setAttribute("aria-label","คำตอบของผู้เรียนข้อนี้");
  snapshot.setAttribute("focusable","false");
  snapshot.classList.add("question-result-score-snapshot");

  // The review image is evidence of the submitted notation, not an editor.
  // Remove cursor/hit geometry and neutralize selection highlighting so amber
  // does not look like an error marker inside the feedback dialog.
  snapshot.querySelectorAll(".entry-cursor,.note-hit-target").forEach(node=>node.remove());
  snapshot.querySelectorAll("[data-note-id]").forEach(node=>{
    node.removeAttribute("data-note-id");
    node.removeAttribute("style");
  });
  snapshot.querySelectorAll('[fill="#9b6400"]').forEach(node=>node.setAttribute("fill","#111"));
  snapshot.querySelectorAll('[stroke="#9b6400"]').forEach(node=>node.setAttribute("stroke","#111"));

  container.appendChild(snapshot);
}

`;
trainer=replaceExact(
  trainer,
  'function showQuestionResultTransition(result){\n',
  helper+'function showQuestionResultTransition(result){\n',
  'answer snapshot helper insertion'
);
trainer=replaceExact(
  trainer,
  '  feedback.innerHTML=questionFeedback(result);\n\n  setQuestionResultAction({\n',
  '  feedback.innerHTML=questionFeedback(result);\n  renderQuestionResultNotationSnapshot();\n\n  setQuestionResultAction({\n',
  'answer snapshot render call'
);
write('src/trainer.js',trainer);

let css=read('styles/app.css');
css=replaceExact(
  css,
  '.question-result-panel{\n  box-sizing:border-box;\n  width:min(760px,96vw);\n  max-height:min(88dvh,760px);\n',
  '.question-result-panel{\n  box-sizing:border-box;\n  width:min(980px,96vw);\n  max-height:min(92dvh,900px);\n',
  'question result panel size'
);
css=replaceExact(
  css,
  '.question-result-feedback{\n  padding-top:14px;\n  color:#2f302c;\n}\n',
  `.question-result-notation-block{\n  padding-top:14px;\n}\n.question-result-notation-label{\n  margin-bottom:6px;\n  color:#62635c;\n  font-size:.72rem;\n  font-weight:800;\n}\n.question-result-notation{\n  padding:8px;\n  overflow:hidden;\n  border:1px solid #e5e3dc;\n  border-radius:14px;\n  background:#fff;\n}\n.question-result-notation .question-result-score-snapshot{\n  display:block;\n  width:100%;\n  height:auto;\n  max-height:34dvh;\n  margin:0 auto;\n  object-fit:contain;\n  pointer-events:none;\n  user-select:none;\n}\n.question-result-feedback{\n  padding-top:12px;\n  color:#2f302c;\n}\n`,
  'question result notation styles'
);
css=replaceExact(
  css,
  '  .question-result-score{min-width:76px;padding:9px 10px;}\n  .question-result-feedback .feedback-lo-grid{grid-template-columns:repeat(2,minmax(0,1fr));}\n',
  '  .question-result-score{min-width:76px;padding:9px 10px;}\n  .question-result-notation{padding:4px;border-radius:10px;}\n  .question-result-notation .question-result-score-snapshot{max-height:38dvh;}\n  .question-result-feedback .feedback-lo-grid{grid-template-columns:repeat(2,minmax(0,1fr));}\n',
  'mobile answer snapshot styles'
);
write('styles/app.css',css);

let unit=read('tests/answer-feedback-transition.test.js');
unit=replaceExact(
  unit,
  'assert(html.includes(\'id="questionResultFeedback"\'), \'question result feedback container must exist\');\n',
  'assert(html.includes(\'id="questionResultFeedback"\'), \'question result feedback container must exist\');\nassert(html.includes(\'id="questionResultNotation"\'), \'question result notation snapshot container must exist\');\n',
  'unit static notation container assertion'
);
unit=replaceExact(
  unit,
  '  querySelectorAll(){return [];}\n  querySelector(){return null;}\n',
  '  querySelectorAll(){return [];}\n  querySelector(){return null;}\n  cloneNode(){const clone=new MockElement(this.id);clone.tagName=this.tagName;clone.innerHTML=this.innerHTML;clone.textContent=this.textContent;clone.attributes={...this.attributes};return clone;}\n',
  'mock cloneNode support'
);
unit=replaceExact(
  unit,
  '  assert(get(\'questionResultFeedback\').innerHTML.includes(\'ไม่พบข้อผิดพลาด\'), \'feedback should show all-correct summary\');\n',
  '  assert(get(\'questionResultFeedback\').innerHTML.includes(\'ไม่พบข้อผิดพลาด\'), \'feedback should show all-correct summary\');\n  assert(!get(\'questionResultFeedback\').innerHTML.includes(\'คะแนนรวมแบบถ่วงน้ำหนัก\'), \'question feedback must not show weighted-score wording\');\n  assert.strictEqual(get(\'questionResultNotation\').children.length,1,\'submitted notation snapshot should be shown with feedback\');\n',
  'unit feedback snapshot assertions'
);
write('tests/answer-feedback-transition.test.js',unit);

let browser=read('tests/exercise-routing.browser.cjs');
browser=replaceExact(
  browser,
  '    await page.locator(\'#questionResultOverlay\').waitFor({state:\'visible\'});\n    assert.equal(await page.locator(\'#questionResultContinue\').evaluate(el=>!!el.closest(\'[inert]\')),false,\'feedback must not have an inert ancestor\');\n',
  '    await page.locator(\'#questionResultOverlay\').waitFor({state:\'visible\'});\n    assert.equal(await page.locator(\'#questionResultNotation svg\').count(),1,\'feedback should show a submitted notation snapshot\');\n    assert.equal(await page.locator(\'#questionResultNotation .entry-cursor\').count(),0,\'review snapshot should not show the editing cursor\');\n    assert.equal(await page.locator(\'#questionResultNotation .note-hit-target\').count(),0,\'review snapshot should not contain interaction hit targets\');\n    assert.equal(await page.locator(\'#questionResultFeedback\').evaluate(el=>el.textContent.includes(\'คะแนนรวมแบบถ่วงน้ำหนัก\')),false,\'weighted-score wording should be removed from feedback\');\n    assert.equal(await page.locator(\'#questionResultContinue\').evaluate(el=>!!el.closest(\'[inert]\')),false,\'feedback must not have an inert ancestor\');\n',
  'browser popup snapshot assertions'
);
write('tests/exercise-routing.browser.cjs',browser);

console.log('Applied feedback answer snapshot patch');
