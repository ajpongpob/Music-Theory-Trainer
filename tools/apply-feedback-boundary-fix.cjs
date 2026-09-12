'use strict';
const fs=require('fs');

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,content){fs.writeFileSync(file,content);}
function replaceExact(source,before,after,label){
  const first=source.indexOf(before);
  if(first<0) throw new Error(`Missing boundary patch target: ${label}`);
  if(source.indexOf(before,first+before.length)>=0) throw new Error(`Duplicate boundary patch target: ${label}`);
  return source.slice(0,first)+after+source.slice(first+before.length);
}

const snapshotHelper=`function renderQuestionResultNotationSnapshot(){
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

const restoreSource=`'use strict';
const assert=require('assert');

const snapshotHelper=${JSON.stringify(snapshotHelper)};

function replaceExact(source,after,before,label){
  const i=source.indexOf(after);
  assert(i>=0,'missing feedback snapshot edit: '+label);
  assert.equal(source.indexOf(after,i+after.length),-1,'duplicate feedback snapshot edit: '+label);
  return source.slice(0,i)+before+source.slice(i+after.length);
}

module.exports=function restoreFeedbackAnswerSnapshot(source,file){
  if(file!=='src/trainer.js') return source;

  source=replaceExact(
    source,
    snapshotHelper+'function showQuestionResultTransition(result){\\n',
    'function showQuestionResultTransition(result){\\n',
    'snapshot helper'
  );

  source=replaceExact(
    source,
    '  feedback.innerHTML=questionFeedback(result);\\n  renderQuestionResultNotationSnapshot();\\n\\n  setQuestionResultAction({\\n',
    '  feedback.innerHTML=questionFeedback(result);\\n\\n  setQuestionResultAction({\\n',
    'snapshot render call'
  );

  source=replaceExact(
    source,
    '    <div class="feedback-scoreline"><span>ผลคะแนนข้อ \\${state.questionIndex+1}</span><b>\\${result.score}%</b></div>\\n    <div class="feedback-lo-grid" aria-label="คะแนนแยกตามผลลัพธ์การเรียนรู้">\\${loScores}</div>\\n',
    '    <div class="feedback-scoreline"><span>ผลคะแนนข้อ \\${state.questionIndex+1}</span><b>\\${result.score}%</b></div>\\n    <div>คะแนนรวมแบบถ่วงน้ำหนัก • Pitch 30% • Stem 10% • Duration 15% • Beam 15% • Accidental 30%</div>\\n    <div class="feedback-lo-grid" aria-label="คะแนนแยกตามผลลัพธ์การเรียนรู้">\\${loScores}</div>\\n',
    'weighted score explanation'
  );

  return source;
};
`;
write('tests/helpers/restore-feedback-answer-snapshot.cjs',restoreSource);

let major=read('tests/major-scale-domain.test.js');
major=replaceExact(
  major,
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nconst restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  'major-scale exact restoration chain'
);
write('tests/major-scale-domain.test.js',major);

let boundary=read('tests/notation-boundary.test.js');
boundary=replaceExact(
  boundary,
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(read(file),file),file),file),file);\n",
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nconst restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(read(file),file),file),file),file),file);\n",
  'notation exact restoration chain'
);
write('tests/notation-boundary.test.js',boundary);

console.log('Applied feedback exact-boundary restoration support');
