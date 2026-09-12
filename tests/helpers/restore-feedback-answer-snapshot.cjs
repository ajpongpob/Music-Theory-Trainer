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
  if(file==='index.html'){
    return replaceExact(
      source,
      '    <div class="question-result-notation-block">\n      <div class="question-result-notation-label">คำตอบของคุณ</div>\n      <div class="question-result-notation" id="questionResultNotation" aria-label="คำตอบที่ผู้เรียนเขียน"></div>\n    </div>\n\n    <div class="question-result-feedback" id="questionResultFeedback"></div>\n',
      '    <div class="question-result-feedback" id="questionResultFeedback"></div>\n',
      'popup notation markup'
    );
  }

  if(file==='styles/app.css'){
    source=replaceExact(
      source,
      '.question-result-panel{\n  box-sizing:border-box;\n  width:min(980px,96vw);\n  max-height:min(92dvh,900px);\n',
      '.question-result-panel{\n  box-sizing:border-box;\n  width:min(760px,96vw);\n  max-height:min(88dvh,760px);\n',
      'popup panel size'
    );
    source=replaceExact(
      source,
      '.question-result-notation-block{\n  padding-top:14px;\n}\n.question-result-notation-label{\n  margin-bottom:6px;\n  color:#62635c;\n  font-size:.72rem;\n  font-weight:800;\n}\n.question-result-notation{\n  padding:8px;\n  overflow:hidden;\n  border:1px solid #e5e3dc;\n  border-radius:14px;\n  background:#fff;\n}\n.question-result-notation .question-result-score-snapshot{\n  display:block;\n  width:100%;\n  height:auto;\n  max-height:34dvh;\n  margin:0 auto;\n  object-fit:contain;\n  pointer-events:none;\n  user-select:none;\n}\n.question-result-feedback{\n  padding-top:12px;\n  color:#2f302c;\n}\n',
      '.question-result-feedback{\n  padding-top:14px;\n  color:#2f302c;\n}\n',
      'popup notation styles'
    );
    source=replaceExact(
      source,
      '  .question-result-score{min-width:76px;padding:9px 10px;}\n  .question-result-notation{padding:4px;border-radius:10px;}\n  .question-result-notation .question-result-score-snapshot{max-height:38dvh;}\n  .question-result-feedback .feedback-lo-grid{grid-template-columns:repeat(2,minmax(0,1fr));}\n',
      '  .question-result-score{min-width:76px;padding:9px 10px;}\n  .question-result-feedback .feedback-lo-grid{grid-template-columns:repeat(2,minmax(0,1fr));}\n',
      'popup mobile notation styles'
    );
    return source;
  }

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
