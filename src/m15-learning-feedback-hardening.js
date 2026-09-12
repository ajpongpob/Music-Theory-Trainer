(() => {
'use strict';

function clearQuestionResultOverlay(){
  const overlay=document.getElementById('questionResultOverlay');
  if(!overlay) return;
  overlay.classList.remove('is-visible');
  overlay.hidden=true;
  overlay.setAttribute('aria-hidden','true');
  document.querySelectorAll('.session-app > .session-header, .session-app > .session-main').forEach(node=>{
    node.inert=false;
    node.removeAttribute('aria-hidden');
  });
}

function installEditorRegressionStyles(){
  if(document.getElementById('editorRegressionHardeningStyles')) return;
  const style=document.createElement('style');
  style.id='editorRegressionHardeningStyles';
  style.textContent=`
    .mastery-power-fill{
      display:block;
      position:absolute;
      inset:0 auto 0 0;
      height:100%;
      min-width:0;
    }
    .mastery-power-text{
      z-index:1;
      pointer-events:none;
    }
  `;
  document.head.appendChild(style);
}

function highlightedEditableNoteGroups(){
  return [...document.querySelectorAll('#scoreSvg g[data-note-id]')].filter(group=>
    group.querySelector('[fill="#9b6400"],[stroke="#9b6400"]')
  );
}

function promoteSingleHighlightedNoteToExplicitSelection(){
  const groups=highlightedEditableNoteGroups();
  if(groups.length!==1 || typeof window.PointerEvent!=='function') return false;

  const group=groups[0];
  const target=group.querySelector('.note-hit-target') || group;
  const rect=target.getBoundingClientRect();
  if(!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return false;

  const pointerId=2147483000;
  const common={
    bubbles:true,
    cancelable:true,
    composed:true,
    pointerId,
    pointerType:'mouse',
    isPrimary:true,
    button:0,
    clientX:rect.left+Math.max(1,rect.width/2),
    clientY:rect.top+Math.max(1,rect.height/2)
  };

  target.dispatchEvent(new PointerEvent('pointerdown',{...common,buttons:1}));
  target.dispatchEvent(new PointerEvent('pointerup',{...common,buttons:0}));
  return true;
}

function isRhythmShortcut(event){
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && /^[1-5]$/.test(event.key);
}

function refreshEditorHint(){
  const hint=document.querySelector('.compact-hint');
  if(!hint) return;
  hint.innerHTML='คลิก/แตะเพื่อเขียน • โน้ตที่ไฮไลต์สามารถเปลี่ยนค่า Rhythm ได้ทันที • <kbd>Shift</kbd>+Click เพื่อเลือกช่วง';
}

// Dashboard transitions may also be used as a recovery path when an optional
// feedback read fails. Never let a review dialog survive into the next launch.
document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button) return;
  if(button.id==='dashboardButton' || button.id==='m15Dashboard'){
    clearQuestionResultOverlay();
    return;
  }

  // Trainer intentionally keeps the just-entered note highlighted. Treat that
  // visible highlight as an editable single-note selection before the legacy
  // rhythm handler runs, so changing note value works without an extra click.
  if(button.matches('.rhythm')){
    promoteSingleHighlightedNoteToExplicitSelection();
  }
},true);

// Keep keyboard duration shortcuts consistent with the palette buttons.
document.addEventListener('keydown',event=>{
  if(!isRhythmShortcut(event)) return;
  const tag=event.target?.tagName;
  if(tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || event.target?.isContentEditable) return;
  promoteSingleHighlightedNoteToExplicitSelection();
},true);

installEditorRegressionStyles();
refreshEditorHint();

// Exercise Host dispatches this when the Trainer is shown. This second guard
// prevents any stale review layer from a previous, interrupted session from
// intercepting input in the newly opened exercise.
window.addEventListener('major-scale-trainer-visible',()=>{
  clearQuestionResultOverlay();
  installEditorRegressionStyles();
  refreshEditorHint();
});

window.MajorScaleApp.m15FeedbackHardening=Object.freeze({
  clearQuestionResultOverlay,
  installEditorRegressionStyles,
  promoteSingleHighlightedNoteToExplicitSelection,
  refreshEditorHint
});
})();
