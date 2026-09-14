(() => {
'use strict';

/* Presentation guard only. The domain core stays pure while stale/cached UI
   from the retired pretest and wrong-note-highlighting features is neutralized. */
function suppressLegacyPretestUi(){
  document.querySelectorAll('.m16-pretest-step,#m16PretestPath,.m15-diag').forEach(node=>node.remove());
  document.querySelectorAll('[data-session-mode="pretest"]').forEach(node=>{
    node.setAttribute('data-session-mode','practice');
  });
}

function clearWrongNoteHighlights(){
  const snapshot=document.querySelector('#questionResultNotation .question-result-score-snapshot');
  if(!snapshot) return;
  snapshot.querySelectorAll('.feedback-wrong-note').forEach(node=>node.classList.remove('feedback-wrong-note'));
  snapshot.querySelectorAll('[fill="#c62828"],[fill="#C62828"]').forEach(node=>node.setAttribute('fill','#111'));
  snapshot.querySelectorAll('[stroke="#c62828"],[stroke="#C62828"]').forEach(node=>node.setAttribute('stroke','#111'));
  snapshot.setAttribute('aria-label','คำตอบของผู้เรียนข้อนี้');
}

function enforce(){
  suppressLegacyPretestUi();
  clearWrongNoteHighlights();
}

function init(){
  enforce();
  if(typeof MutationObserver==='undefined' || !document.body) return;
  const observer=new MutationObserver(enforce);
  observer.observe(document.body,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-session-mode','hidden','class','fill','stroke']
  });
}

window.MajorScaleApp=window.MajorScaleApp || {};
window.MajorScaleApp.disabledFeatureUiGuards=Object.freeze({
  suppressLegacyPretestUi,
  clearWrongNoteHighlights,
  enforce
});

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
