'use strict';
const assert=require('assert');

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
    snapshotHelper+'function showQuestionResultTransition(result){\n',
    'function showQuestionResultTransition(result){\n',
    'snapshot helper'
  );

  source=replaceExact(
    source,
    '  feedback.innerHTML=questionFeedback(result);\n  renderQuestionResultNotationSnapshot();\n\n  setQuestionResultAction({\n',
    '  feedback.innerHTML=questionFeedback(result);\n\n  setQuestionResultAction({\n',
    'snapshot render call'
  );

  source=replaceExact(
    source,
    '    <div class="feedback-scoreline"><span>ผลคะแนนข้อ ${state.questionIndex+1}</span><b>${result.score}%</b></div>\n    <div class="feedback-lo-grid" aria-label="คะแนนแยกตามผลลัพธ์การเรียนรู้">${loScores}</div>\n',
    '    <div class="feedback-scoreline"><span>ผลคะแนนข้อ ${state.questionIndex+1}</span><b>${result.score}%</b></div>\n    <div>คะแนนรวมแบบถ่วงน้ำหนัก • Pitch 30% • Stem 10% • Duration 15% • Beam 15% • Accidental 30%</div>\n    <div class="feedback-lo-grid" aria-label="คะแนนแยกตามผลลัพธ์การเรียนรู้">${loScores}</div>\n',
    'weighted score explanation'
  );

  return source;
};
