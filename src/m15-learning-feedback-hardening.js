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

function noteGroupIsHighlighted(group){
  return !!group?.querySelector?.('[fill="#9b6400"],[stroke="#9b6400"]');
}

function highlightedEditableNoteGroups(){
  return [...document.querySelectorAll('#scoreSvg g[data-note-id]')].filter(noteGroupIsHighlighted);
}

function promoteSingleHighlightedNoteToExplicitSelection(){
  const groups=highlightedEditableNoteGroups();
  if(groups.length!==1) return false;

  const noteId=groups[0].getAttribute('data-note-id');
  const navPrev=document.getElementById('navPrev');
  const navNext=document.getElementById('navNext');
  if(!noteId || !navPrev || !navNext) return false;

  // The editor's own cursor navigation calls syncSelectionToCursor(), which is
  // the authoritative path for converting a visible highlight into an explicit
  // editable selection. Move left once; if the cursor is already at slot 0 the
  // same note stays selected and the promotion is complete. Otherwise move
  // right once to restore the exact original slot. This avoids synthetic pointer
  // events and therefore does not interfere with pointer capture/drag behavior.
  navPrev.click();

  const stillOnOriginal=highlightedEditableNoteGroups().some(group=>
    group.getAttribute('data-note-id')===noteId
  );
  if(stillOnOriginal) return true;

  navNext.click();
  return highlightedEditableNoteGroups().some(group=>
    group.getAttribute('data-note-id')===noteId
  );
}

function isRhythmShortcut(event){
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && /^[1-5]$/.test(event.key);
}

function refreshEditorHint(){
  const hint=document.querySelector('.compact-hint');
  if(!hint) return;
  hint.innerHTML='คลิก/แตะเพื่อเขียน • โน้ตที่ไฮไลต์สามารถเปลี่ยนค่า Rhythm ได้ทันที • <kbd>Shift</kbd>+Click เพื่อเลือกช่วง';
}

let masteryStatusCopyObserver=null;

function normalizeMasteryStatusCopy(){
  const status=document.getElementById('masteryProgressStatus');
  if(!status) return false;
  const current=status.textContent || '';
  const normalized=current.replace(
    'ฝึก Score เพิ่มอีกเล็กน้อย',
    'ฝึกแบบฝึกหัดเพิ่มอีกเล็กน้อย'
  );
  if(normalized===current) return false;
  status.textContent=normalized;
  return true;
}

function observeMasteryStatusCopy(){
  const status=document.getElementById('masteryProgressStatus');
  if(!status) return false;
  normalizeMasteryStatusCopy();
  if(masteryStatusCopyObserver) return true;
  masteryStatusCopyObserver=new MutationObserver(normalizeMasteryStatusCopy);
  masteryStatusCopyObserver.observe(status,{
    childList:true,
    subtree:true,
    characterData:true
  });
  return true;
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
observeMasteryStatusCopy();

// Exercise Host dispatches this when the Trainer is shown. This second guard
// prevents any stale review layer from a previous, interrupted session from
// intercepting input in the newly opened exercise.
window.addEventListener('major-scale-trainer-visible',()=>{
  clearQuestionResultOverlay();
  installEditorRegressionStyles();
  refreshEditorHint();
  observeMasteryStatusCopy();
  normalizeMasteryStatusCopy();
});

window.MajorScaleApp.m15FeedbackHardening=Object.freeze({
  clearQuestionResultOverlay,
  installEditorRegressionStyles,
  promoteSingleHighlightedNoteToExplicitSelection,
  refreshEditorHint,
  normalizeMasteryStatusCopy,
  observeMasteryStatusCopy
});
})();
