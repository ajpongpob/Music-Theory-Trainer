(() => {
'use strict';

let scheduled=false;

function parseWrongNotePositions(text){
  const positions=new Set();
  const source=String(text || '');
  for(const match of source.matchAll(/โน้ตตำแหน่ง\s*(\d+)/g)){
    const value=Number(match[1]);
    if(Number.isInteger(value) && value>0) positions.add(value);
  }
  for(const match of source.matchAll(/Beam\s*โน้ต\s*(\d+)\s*[–-]\s*(\d+)/gi)){
    const start=Number(match[1]),end=Number(match[2]);
    if(!Number.isInteger(start)||!Number.isInteger(end)) continue;
    for(let i=Math.min(start,end);i<=Math.max(start,end);i++) if(i>0) positions.add(i);
  }
  return [...positions].sort((a,b)=>a-b);
}

function clearLegacyWrongNoteColors(){
  const snapshot=document.querySelector('#questionResultNotation .question-result-score-snapshot');
  if(!snapshot) return false;

  snapshot.querySelectorAll('.feedback-wrong-note').forEach(node=>{
    node.classList.remove('feedback-wrong-note');
  });

  // Defensive cleanup for snapshots that may have been recolored by an older
  // cached version of this module before the current code loaded.
  snapshot.querySelectorAll('[fill="#c62828"],[fill="#C62828"]').forEach(node=>{
    node.setAttribute('fill','#111');
  });
  snapshot.querySelectorAll('[stroke="#c62828"],[stroke="#C62828"]').forEach(node=>{
    node.setAttribute('stroke','#111');
  });

  snapshot.setAttribute('aria-label','คำตอบของผู้เรียนข้อนี้');
  return true;
}

function applyWrongNoteColors(){
  // Intentionally do not mark incorrect notes. The result view keeps the
  // learner's submitted notation unchanged and feedback remains textual only.
  clearLegacyWrongNoteColors();
  return false;
}

function schedule(){
  if(scheduled) return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    applyWrongNoteColors();
  });
}

function bind(){
  const overlay=document.getElementById('questionResultOverlay');
  const notation=document.getElementById('questionResultNotation');
  const feedback=document.getElementById('questionResultFeedback');
  if(!overlay || !notation || !feedback) return;
  const observer=new MutationObserver(schedule);
  observer.observe(overlay,{attributes:true,attributeFilter:['hidden','class']});
  observer.observe(notation,{childList:true,subtree:true});
  observer.observe(feedback,{childList:true,subtree:true,characterData:true});
  schedule();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();

window.MajorScaleApp=window.MajorScaleApp || {};
window.MajorScaleApp.feedbackNotationErrors=Object.freeze({
  parseWrongNotePositions,
  applyWrongNoteColors,
  clearLegacyWrongNoteColors
});
})();
