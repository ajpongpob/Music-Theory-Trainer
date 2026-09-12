(() => {
'use strict';

const WRONG_COLOR='#c62828';
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

function visibleNoteGroups(snapshot){
  const heads=[...snapshot.querySelectorAll('.smufl-notehead, ellipse')].filter(node=>{
    if(node.closest('defs')) return false;
    const fill=(node.getAttribute('fill')||'').toLowerCase();
    return fill!=='transparent' && fill!=='none';
  });
  const groups=[];
  const seen=new Set();
  heads.forEach(head=>{
    const group=head.closest('g');
    if(!group || seen.has(group)) return;
    seen.add(group);
    groups.push(group);
  });
  return groups;
}

function recolorVisibleNode(node){
  const fill=node.getAttribute('fill');
  if(fill && !['none','transparent'].includes(fill.toLowerCase())) node.setAttribute('fill',WRONG_COLOR);
  const stroke=node.getAttribute('stroke');
  if(stroke && !['none','transparent'].includes(stroke.toLowerCase())) node.setAttribute('stroke',WRONG_COLOR);
}

function markGroupWrong(group){
  group.classList.add('feedback-wrong-note');
  recolorVisibleNode(group);
  group.querySelectorAll('text,ellipse,line,path,polygon').forEach(recolorVisibleNode);
}

function applyWrongNoteColors(){
  const overlay=document.getElementById('questionResultOverlay');
  if(!overlay || overlay.hidden) return false;
  const feedback=document.getElementById('questionResultFeedback');
  const snapshot=document.querySelector('#questionResultNotation .question-result-score-snapshot');
  if(!feedback || !snapshot) return false;

  const positions=parseWrongNotePositions(feedback.textContent);
  const groups=visibleNoteGroups(snapshot);
  groups.forEach(group=>group.classList.remove('feedback-wrong-note'));
  if(!positions.length || !groups.length) return false;

  positions.forEach(position=>{
    const group=groups[position-1];
    if(group) markGroupWrong(group);
  });
  snapshot.setAttribute('aria-label',`คำตอบของผู้เรียนข้อนี้ โน้ตที่ผิด ${positions.length} ตำแหน่งแสดงด้วยสีแดง`);
  return true;
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
  applyWrongNoteColors
});
})();
